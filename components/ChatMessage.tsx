'use client';

import { Bot, User } from 'lucide-react';
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
        isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary'
      )}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      
      <div className={cn(
        'flex-1 space-y-2 overflow-hidden',
        isUser && 'text-right'
      )}>
        <div className={cn(
          'inline-block text-left max-w-[80%]',
          isUser 
            ? 'bg-primary text-primary-foreground rounded-lg px-4 py-2 ml-auto' 
            : 'prose prose-invert'
        )}>
          {isUser ? (
            <p className="mb-0 text-sm">{message.content}</p>
          ) : (
            <div className="relative">
              <div className="prose prose-invert max-w-none text-sm">
                <ReactMarkdown>
                  {message.content}
                </ReactMarkdown>
              </div>
              {isStreaming && !isComplete && (
                <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}