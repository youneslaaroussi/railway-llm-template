import * as dotenv from 'dotenv';
import { ConfigService } from '@nestjs/config';
import { CurrencyService } from '../src/currency/currency.service';
import { CurrencyConversionRequest } from '../src/currency/types/currency.types';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Create a mock config service for testing
class MockConfigService extends ConfigService {
  get<T = any>(propertyPath: string, defaultValue?: T): T {
    const value = process.env[propertyPath];
    return value !== undefined ? (value as T) : (defaultValue as T);
  }
}

async function testCurrencyConversion() {
  console.log('🧪 Testing Currency Conversion Service...\n');

  const configService = new MockConfigService();
  const currencyService = new CurrencyService(configService);

  // Initialize the service
  await currencyService.onModuleInit();

  // Test cases
  const testCases: CurrencyConversionRequest[] = [
    {
      amount: 100,
      fromCurrency: 'USD',
      toCurrency: 'EUR',
      description: 'Test USD to EUR conversion'
    },
    {
      amount: 500,
      fromCurrency: 'EUR',
      toCurrency: 'GBP',
      description: 'Test EUR to GBP conversion'
    },
    {
      amount: 1000,
      fromCurrency: 'USD',
      toCurrency: 'JPY',
      description: 'Test USD to JPY conversion'
    },
    {
      amount: 250,
      fromCurrency: 'GBP',
      toCurrency: 'USD',
      description: 'Test GBP to USD conversion'
    },
    {
      amount: 100,
      fromCurrency: 'USD',
      toCurrency: 'USD',
      description: 'Test same currency conversion'
    }
  ];

  console.log('📊 Running test conversions:\n');

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`Test ${i + 1}: ${testCase.description}`);
    console.log(`Converting ${testCase.amount} ${testCase.fromCurrency} to ${testCase.toCurrency}`);
    
    try {
      const result = await currencyService.convertCurrency(testCase);
      
      if (result.success) {
        console.log(`✅ Success: ${result.amount} ${result.fromCurrency} = ${result.convertedAmount} ${result.toCurrency}`);
        console.log(`   Exchange Rate: 1 ${result.fromCurrency} = ${result.exchangeRate} ${result.toCurrency}`);
        console.log(`   Provider: ${result.provider}`);
        console.log(`   Timestamp: ${result.timestamp}`);
      } else {
        console.log(`❌ Failed: ${result.error}`);
      }
    } catch (error) {
      console.log(`💥 Error: ${error.message}`);
    }
    
    console.log('');
  }

  // Test error cases
  console.log('🚨 Testing error cases:\n');

  const errorCases: CurrencyConversionRequest[] = [
    {
      amount: -100,
      fromCurrency: 'USD',
      toCurrency: 'EUR',
      description: 'Negative amount test'
    },
    {
      amount: 100,
      fromCurrency: 'INVALID',
      toCurrency: 'EUR',
      description: 'Invalid source currency test'
    },
    {
      amount: 100,
      fromCurrency: 'USD',
      toCurrency: 'INVALID',
      description: 'Invalid target currency test'
    }
  ];

  for (let i = 0; i < errorCases.length; i++) {
    const testCase = errorCases[i];
    console.log(`Error Test ${i + 1}: ${testCase.description}`);
    
    try {
      const result = await currencyService.convertCurrency(testCase);
      
      if (result.success) {
        console.log(`⚠️  Unexpected success: ${result.convertedAmount} ${result.toCurrency}`);
      } else {
        console.log(`✅ Expected failure: ${result.error}`);
      }
    } catch (error) {
      console.log(`✅ Expected error: ${error.message}`);
    }
    
    console.log('');
  }

  // Test supported currencies
  console.log('🌍 Testing supported currencies:\n');
  try {
    const supportedCurrencies = await currencyService.getSupportedCurrencies();
    console.log(`✅ Found ${supportedCurrencies.length} supported currencies`);
    console.log(`   Sample currencies: ${supportedCurrencies.slice(0, 10).join(', ')}...`);
  } catch (error) {
    console.log(`❌ Failed to get supported currencies: ${error.message}`);
  }

  console.log('\n🎉 Currency conversion testing complete!');
}

// Run the test
if (require.main === module) {
  testCurrencyConversion().catch(console.error);
} 