import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { 
  CurrencyConversionRequest, 
  CurrencyConversionResponse, 
  ExchangeRateApiResponse,
  SupportedCurrenciesResponse,
  POPULAR_CURRENCIES 
} from './types/currency.types';

interface CurrencyConfig {
  apiKey?: string;
  baseUrl: string;
  timeout: number;
  cacheTTL: number; // Cache time-to-live in milliseconds
}

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

@Injectable()
export class CurrencyService implements OnModuleInit {
  private readonly logger = new Logger(CurrencyService.name);
  private httpClient: AxiosInstance;
  private config: CurrencyConfig;
  private cache = new Map<string, CacheEntry>();

  constructor(private configService: ConfigService) {
    this.config = {
      apiKey: this.configService.get<string>('EXCHANGE_RATE_API_KEY'), // Optional for free tier
      baseUrl: this.configService.get<string>('EXCHANGE_RATE_BASE_URL', 'https://v6.exchangerate-api.com/v6'),
      timeout: parseInt(this.configService.get<string>('EXCHANGE_RATE_TIMEOUT', '10000')),
      cacheTTL: parseInt(this.configService.get<string>('EXCHANGE_RATE_CACHE_TTL', '3600000')), // 1 hour default
    };

    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => {
        this.logger.error('Currency API request failed:', {
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url,
        });
        return Promise.reject(error);
      },
    );
  }

  async onModuleInit() {
    this.logger.log('Currency service initialized successfully');
    
    // Start cache cleanup interval (every hour)
    setInterval(() => {
      this.cleanupCache();
    }, 3600000);
  }

  async convertCurrency(request: CurrencyConversionRequest): Promise<CurrencyConversionResponse> {
    this.logger.log(`Converting ${request.amount} ${request.fromCurrency} to ${request.toCurrency}`);

    try {
      // Validate currency codes
      this.validateCurrencyCode(request.fromCurrency);
      this.validateCurrencyCode(request.toCurrency);

      // Validate amount
      if (request.amount < 0) {
        throw new Error('Amount must be a positive number');
      }

      // Check if same currency
      if (request.fromCurrency === request.toCurrency) {
        return {
          success: true,
          amount: request.amount,
          fromCurrency: request.fromCurrency,
          toCurrency: request.toCurrency,
          exchangeRate: 1,
          convertedAmount: request.amount,
          description: request.description,
          timestamp: new Date().toISOString(),
          provider: 'Local (same currency)',
        };
      }

      // Check cache first
      const cacheKey = `${request.fromCurrency}_${request.toCurrency}`;
      const cachedRate = this.getFromCache(cacheKey);
      
      let exchangeRate: number;
      let timestamp: string;
      let provider: string;

      if (cachedRate) {
        exchangeRate = cachedRate.conversion_rate;
        timestamp = cachedRate.time_last_update_utc;
        provider = 'ExchangeRate-API (cached)';
        this.logger.log(`Using cached exchange rate: 1 ${request.fromCurrency} = ${exchangeRate} ${request.toCurrency}`);
      } else {
        // Fetch fresh rate from API
        const response = await this.fetchExchangeRate(request.fromCurrency, request.toCurrency, request.amount);
        exchangeRate = response.conversion_rate;
        timestamp = response.time_last_update_utc;
        provider = 'ExchangeRate-API';

        // Cache the result
        this.setCache(cacheKey, response);
        this.logger.log(`Fetched fresh exchange rate: 1 ${request.fromCurrency} = ${exchangeRate} ${request.toCurrency}`);
      }

      const convertedAmount = request.amount * exchangeRate;

      return {
        success: true,
        amount: request.amount,
        fromCurrency: request.fromCurrency,
        toCurrency: request.toCurrency,
        exchangeRate,
        convertedAmount: Math.round(convertedAmount * 100) / 100, // Round to 2 decimal places
        description: request.description,
        timestamp,
        provider,
      };

    } catch (error) {
      this.logger.error(`Currency conversion failed: ${error.message}`);
      
      return {
        success: false,
        amount: request.amount,
        fromCurrency: request.fromCurrency,
        toCurrency: request.toCurrency,
        exchangeRate: 0,
        convertedAmount: 0,
        description: request.description,
        timestamp: new Date().toISOString(),
        provider: 'ExchangeRate-API',
        error: `Currency conversion failed: ${error.message}`,
      };
    }
  }

  private async fetchExchangeRate(
    fromCurrency: string, 
    toCurrency: string, 
    amount: number
  ): Promise<ExchangeRateApiResponse> {
    const endpoint = this.config.apiKey 
      ? `/${this.config.apiKey}/pair/${fromCurrency}/${toCurrency}/${amount}`
      : `/latest/${fromCurrency}`;

    try {
      const response = await this.httpClient.get<ExchangeRateApiResponse>(endpoint);
      
      if (response.data.result !== 'success') {
        throw new Error(`API returned error: ${response.data.result}`);
      }

      // If using the free endpoint without amount, we need to calculate manually
      if (!this.config.apiKey) {
        const rates = (response.data as any).conversion_rates;
        if (!rates || !rates[toCurrency]) {
          throw new Error(`Exchange rate not found for ${toCurrency}`);
        }
        
        return {
          ...response.data,
          base_code: fromCurrency,
          target_code: toCurrency,
          conversion_rate: rates[toCurrency],
          conversion_result: amount * rates[toCurrency],
        } as ExchangeRateApiResponse;
      }

      return response.data;
    } catch (error) {
      if (error.response?.status === 403) {
        throw new Error('Invalid API key or rate limit exceeded');
      } else if (error.response?.status === 404) {
        throw new Error(`Unsupported currency pair: ${fromCurrency}/${toCurrency}`);
      }
      throw error;
    }
  }

  private validateCurrencyCode(code: string): void {
    if (!code || typeof code !== 'string') {
      throw new Error('Currency code is required');
    }
    
    if (code.length !== 3) {
      throw new Error('Currency code must be exactly 3 characters (ISO 4217)');
    }
    
    if (!/^[A-Z]{3}$/.test(code)) {
      throw new Error('Currency code must be 3 uppercase letters');
    }
  }

  private getFromCache(key: string): any {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    if (now > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: this.config.cacheTTL,
    });
  }

  private cleanupCache(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.logger.log(`Cleaned up ${cleaned} expired cache entries`);
    }
  }

  // Utility method to get supported currencies (useful for validation)
  async getSupportedCurrencies(): Promise<string[]> {
    const cacheKey = 'supported_currencies';
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const endpoint = this.config.apiKey 
        ? `/${this.config.apiKey}/codes`
        : '/latest/USD'; // Fallback to getting rates from USD
      
      const response = await this.httpClient.get<SupportedCurrenciesResponse>(endpoint);
      
      let currencies: string[];
      if (response.data.supported_codes) {
        currencies = response.data.supported_codes.map(([code]) => code);
      } else {
        // Fallback to popular currencies if API doesn't provide supported codes
        currencies = [...POPULAR_CURRENCIES];
      }
      
      // Cache for 24 hours
      this.setCache(cacheKey, currencies);
      return currencies;
    } catch (error) {
      this.logger.warn('Could not fetch supported currencies, using popular currencies list');
      return [...POPULAR_CURRENCIES];
    }
  }

  getConfig(): CurrencyConfig {
    return { ...this.config };
  }
} 