import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';
import { CurrencyModule } from '../currency/currency.module';
import { ToolsModule } from './tools/tools.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CurrencyModule, ToolsModule, CommonModule],
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {} 