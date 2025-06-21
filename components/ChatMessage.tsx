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
    <div className={cn('flex gap-4', isUser && 'flex-row-reverse')}>
      {/* Iconos minimalistas bonitos */}
      <div className={cn(
        'flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full transition-all duration-200',
        isUser 
          ? 'bg-foreground/90 shadow-sm' 
          : 'bg-muted/70 border border-border/30'
      )}>
        {isUser ? (
          // Icono de usuario minimalista
          <svg 
            className="w-4 h-4 text-background" 
            fill="currentColor" 
            viewBox="0 0 24 24"
          >
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        ) : (
          // Icono de AI minimalista con animación sutil
          <div className="relative">
            <svg 
              className={cn(
                "w-4 h-4 text-muted-foreground/80 transition-transform duration-500",
                isStreaming && "animate-pulse"
              )} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" 
              />
            </svg>
            {/* Punto de actividad para AI */}
            {isStreaming && (
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-muted-foreground/60 rounded-full animate-ping" />
            )}
          </div>
        )}
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
                <span className="inline-block w-0.5 h-4 bg-muted-foreground/60 ml-1 animate-pulse rounded-full" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}