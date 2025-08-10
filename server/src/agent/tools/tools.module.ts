import { Module } from '@nestjs/common';
import { CurrencyModule } from '../../currency/currency.module';
import { ConvertCurrencyToolService } from './convert-currency-tool.service';
import { MemoryToolService } from './memory-tool.service';
import { ToolRegistry } from './tool-registry.service';

@Module({
  imports: [CurrencyModule],
  providers: [
    ToolRegistry,
    ConvertCurrencyToolService,
    MemoryToolService,
  ],
  exports: [ToolRegistry],
})
export class ToolsModule {} 