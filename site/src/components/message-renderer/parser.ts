
import { ToolCallContent } from '@/types/chat';

export type ContentBlock = 
  | { type: 'text'; content: string }
  | { type: 'tool'; toolCall: ToolCallContent };

export function parseMessageContent(content: string): ContentBlock[] {
  const toolBlockRegex = /({% (tool_start|tool_complete) '([^']*)' '([^']*)' %})([\s\S]*?)(?:{% endtool %})/g;

  const blocks: ContentBlock[] = [];
  const toolCalls: { [id: string]: ToolCallContent } = {};
  let lastIndex = 0;
  let match;

  // Store the original content for debugging
  console.log('[PARSER] Parsing content length:', content.length, 'preview:', content.substring(0, 200));

  // First pass: identify all tool calls and group them
  const toolMatches: any[] = [];
  while ((match = toolBlockRegex.exec(content)) !== null) {
    toolMatches.push({
      fullMatch: match[0],
      tag: match[1],
      status: match[2],
      toolName: match[3],
      id: match[4],
      innerContent: match[5],
      index: match.index,
      lastIndex: toolBlockRegex.lastIndex
    });
  }

  console.log('[PARSER] Found tool matches:', toolMatches.length);

  // Reset regex for actual processing
  toolBlockRegex.lastIndex = 0;
  lastIndex = 0;

  for (const matchData of toolMatches) {
    const { status, toolName, id, innerContent, index } = matchData;

    // Add text before this tool call
    if (index > lastIndex) {
      const textContent = content.substring(lastIndex, index);
      if (textContent.trim()) {
        blocks.push({ type: 'text', content: textContent });
      }
    }
    
    // Find or create the tool call object
    if (!toolCalls[id]) {
      toolCalls[id] = { id, toolName, description: '', isComplete: false, data: null };
      blocks.push({ type: 'tool', toolCall: toolCalls[id] });
    }

    const toolCall = toolCalls[id];

    if (status === 'tool_complete') {
      toolCall.isComplete = true;
      try {
        if(innerContent && innerContent.trim().startsWith('{')) {
          toolCall.data = JSON.parse(innerContent.trim());
        } else {
          toolCall.data = innerContent.trim();
        }
      } catch (e) {
        console.warn('[PARSER] Failed to parse tool data:', e);
        toolCall.data = innerContent.trim();
      }
    }

    // Extract description
    const descriptionMatch = innerContent.match(/{% tool_description %}([\s\S]*?){% end_tool_description %}/);
    if (descriptionMatch) {
      toolCall.description = descriptionMatch[1];
    }
    
    lastIndex = matchData.lastIndex;
  }

  // Add any remaining text after all tool calls
  if (lastIndex < content.length) {
    const remainingText = content.substring(lastIndex);
    if (remainingText.trim()) {
      blocks.push({ type: 'text', content: remainingText });
    }
  }

  console.log('[PARSER] Parsed blocks:', blocks.length, 'text blocks:', blocks.filter(b => b.type === 'text').length, 'tool blocks:', blocks.filter(b => b.type === 'tool').length);

  // Return blocks without removing tool syntax from text (since it should already be processed)
  return blocks.filter(block => block.type !== 'text' || block.content.trim());
} 