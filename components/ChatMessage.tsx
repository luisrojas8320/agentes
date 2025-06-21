'use client';

import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
  message: {
    role: 'user' | 'assistant';
    content: string;
  };
  isStreaming?: boolean;
  isComplete?: boolean;
}

export default function ChatMessage({ message, isStreaming = false, isComplete = true }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div className={cn(
        'flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full',
        isUser ? 'bg-foreground text-background' : 'bg-muted'
      )}>
        <div className="w-4 h-4 rounded-full bg-current opacity-60" />
      </div>
      
      <div className={cn(
        'flex-1 space-y-2 overflow-hidden',
        isUser && 'text-right'
      )}>
        <div className={cn(
          'inline-block text-left max-w-[85%]',
          isUser 
            ? 'message-user-minimal' 
            : 'message-assistant-minimal'
        )}>
          {isUser ? (
            <p className="mb-0 text-sm leading-relaxed">{message.content}</p>
          ) : (
            <div className="relative">
              <div className="prose prose-invert max-w-none text-sm leading-relaxed">
                <ReactMarkdown>
                  {message.content}
                </ReactMarkdown>
              </div>
              {isStreaming && !isComplete && (
                <span className="inline-block w-2 h-4 bg-muted-foreground/50 ml-1 animate-pulse" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}