import { Injectable } from '@nestjs/common';
import { Tool } from './tool.interface';
import { ConvertCurrencyToolService } from './convert-currency-tool.service';
import { MemoryToolService } from './memory-tool.service';

@Injectable()
export class ToolRegistry {
  private readonly tools: Map<string, Tool> = new Map();

  constructor(
    private readonly convertCurrencyTool: ConvertCurrencyToolService,
    private readonly memoryTool: MemoryToolService,
  ) {
    this.registerTools([
      this.convertCurrencyTool,
      this.memoryTool,
    ]);
  }

  private registerTools(tools: Tool[]) {
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
    }
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }
} 