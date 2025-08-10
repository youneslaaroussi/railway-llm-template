
import { memo } from 'react';
import { parseMessageContent, ContentBlock } from './parser';
import { ToolCallBlock } from './tool-call-block';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AdvancedMessageContentProps {
  content: string;
}

export const AdvancedMessageContent = memo(({ content }: AdvancedMessageContentProps) => {
  const blocks = parseMessageContent(content);

  return (
    <div className="space-y-4 w-full">
      {blocks.map((block: ContentBlock, index: number) => {
        if (block.type === 'text' && block.content) {
          return (
            <div key={index} className="prose prose-sm max-w-none prose-gray w-full">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="mb-3 last:mb-0 pl-4 list-disc">{children}</ul>,
                  ol: ({ children }) => <ol className="mb-3 last:mb-0 pl-4 list-decimal">{children}</ol>,
                  li: ({ children }) => <li className="mb-1">{children}</li>,
                  code: ({ children, ...props }) => {
                    const inline = !props.className?.includes('language-')
                    return inline ? (
                      <code className="bg-gray-100 px-1 py-0.5 rounded text-sm">{children}</code>
                    ) : (
                      <pre className="bg-gray-100 p-3 rounded-lg overflow-x-auto">
                        <code>{children}</code>
                      </pre>
                    )
                  },
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-gray-300 pl-4 italic">{children}</blockquote>
                  ),
                }}
              >
                {block.content}
              </ReactMarkdown>
            </div>
          );
        }
        if (block.type === 'tool') {
          return <ToolCallBlock key={block.toolCall.id} toolCall={block.toolCall} />;
        }
        return null;
      })}
    </div>
  );
});

AdvancedMessageContent.displayName = 'AdvancedMessageContent'; 