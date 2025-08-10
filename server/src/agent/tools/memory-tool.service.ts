import { Injectable, Logger } from '@nestjs/common';
import { Tool } from './tool.interface';

@Injectable()
export class MemoryToolService implements Tool {
  private readonly logger = new Logger(MemoryToolService.name);
  
  name = 'save_to_memory';
  description = 'Save important information about the user, their preferences, travel history, or context to memory for future reference. Use this when you learn something important about the user that would be helpful to remember in future conversations.';

  async execute(args: any): Promise<any> {
    const { key, value, category } = args;
    
    if (!key || !value) {
      throw new Error('Both key and value are required for saving to memory.');
    }

    this.logger.log(`Memory save attempt - Key: ${key}, Category: ${category || 'general'}`);

    // Since we're not saving server-side, just return a success message
    // The client will be responsible for capturing and storing these memory items
    return {
      success: true,
      message: `Successfully saved to memory: ${key}`,
      memoryItem: {
        key,
        value,
        category: category || 'general',
        timestamp: new Date().toISOString()
      }
    };
  }
}