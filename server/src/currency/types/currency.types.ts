export interface CurrencyConversionRequest {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  description?: string;
}

export interface CurrencyConversionResponse {
  success: boolean;
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  exchangeRate: number;
  convertedAmount: number;
  description?: string;
  timestamp: string;
  provider: string;
  error?: string;
}

export interface ExchangeRateApiResponse {
  result: string;
  documentation: string;
  terms_of_use: string;
  time_last_update_unix: number;
  time_last_update_utc: string;
  time_next_update_unix: number;
  time_next_update_utc: string;
  base_code: string;
  target_code: string;
  conversion_rate: number;
  conversion_result: number;
}

export interface SupportedCurrenciesResponse {
  result: string;
  documentation: string;
  terms_of_use: string;
  supported_codes: [string, string][]; // [code, name] pairs
}

export const POPULAR_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'SEK', 'NZD',
  'MXN', 'SGD', 'HKD', 'NOK', 'KRW', 'TRY', 'RUB', 'INR', 'BRL', 'ZAR'
] as const;

export type PopularCurrency = typeof POPULAR_CURRENCIES[number]; 