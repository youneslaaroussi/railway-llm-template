import { Injectable } from '@nestjs/common';
import { CurrencyService } from '../../currency/currency.service';
import { CurrencyConversionRequest } from '../../currency/types/currency.types';
import { Tool } from './tool.interface';

@Injectable()
export class ConvertCurrencyToolService implements Tool {
  name = 'convert_currency';
  description = 'Convert currency';

  constructor(private readonly currencyService: CurrencyService) {}

  async execute(args: any): Promise<any> {
    const { amount, fromCurrency, toCurrency, description } = args;
    if (!amount || !fromCurrency || !toCurrency) {
      throw new Error(
        'Amount, fromCurrency, and toCurrency are required for currency conversion.',
      );
    }

    const conversionRequest: CurrencyConversionRequest = {
      amount,
      fromCurrency: fromCurrency.toUpperCase(),
      toCurrency: toCurrency.toUpperCase(),
      description,
    };

    return this.currencyService.convertCurrency(conversionRequest);
  }
} 