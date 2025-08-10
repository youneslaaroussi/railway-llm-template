
'use client';

import { memo } from 'react';
import { Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToolCallContent } from '@/types/chat';
import { ToolResultHandler } from '@/components/tool-result-handler';

interface ToolCallBlockProps {
  toolCall: ToolCallContent;
}

const getToolIcon = (_tool: string) => {
  return <Clock className="w-4 h-4" />;
};

const getToolDisplayName = (tool: string) => {
    const toolNames: Record<string, string> = {
      'save_to_memory': 'Save to memory',
      'convert_currency': 'Convert currency',
    }
    return toolNames[tool] || tool.replace(/_/g, ' ')
};

export const ToolCallBlock = memo(({ toolCall }: ToolCallBlockProps) => {
  const { toolName, description, isComplete, data } = toolCall;

  const shouldRenderCustomResults = isComplete && data;

  return (
    <div className="w-full">
      <div
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg border w-full',
          isComplete
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-blue-50 border-blue-200 text-blue-800'
        )}
      >
        <div className="flex-shrink-0">
          {isComplete ? (
            getToolIcon(toolName)
          ) : (
            <Loader2 className="w-4 h-4 animate-spin" />
          )}
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="text-sm font-medium truncate">{getToolDisplayName(toolName)}</div>
          {description && (
            <div className="text-xs opacity-75 truncate">{description}</div>
          )}
        </div>
      </div>
      {shouldRenderCustomResults && <ToolResultHandler data={data} />}
    </div>
  );
});

ToolCallBlock.displayName = 'ToolCallBlock';