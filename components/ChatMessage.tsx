'use client';

import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();

  return (
    <div className={cn(
      'flex',
      isMobile ? 'gap-2' : 'gap-4',
      isUser && 'flex-row-reverse'
    )}>
      {/* Iconos minimalistas bonitos - Responsive */}
      <div className={cn(
        'flex shrink-0 select-none items-center justify-center rounded-full transition-all duration-200 relative',
        isMobile ? 'h-6 w-6' : 'h-8 w-8',
        isUser 
          ? 'bg-foreground/90 shadow-sm' 
          : 'bg-muted/70 border border-border/30'
      )}>
        {isUser ? (
          // Icono de usuario minimalista
          <svg 
            className={cn(
              "text-background",
              isMobile ? "w-3 h-3" : "w-4 h-4"
            )}
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
                "text-muted-foreground/80 transition-transform duration-500",
                isMobile ? "w-3 h-3" : "w-4 h-4",
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
              <div className={cn(
                "absolute bg-muted-foreground/60 rounded-full animate-ping",
                isMobile 
                  ? "-top-0.5 -right-0.5 w-2 h-2" 
                  : "-top-0.5 -right-0.5 w-2.5 h-2.5"
              )} />
            )}
          </div>
        )}
      </div>
      
      <div className={cn(
        'flex-1 space-y-2 overflow-hidden min-w-0',
        isUser && 'text-right'
      )}>
        <div className={cn(
          'inline-block text-left',
          isMobile ? 'max-w-[92%]' : 'max-w-[85%]',
          isUser 
            ? 'message-user-minimal' 
            : 'message-assistant-minimal'
        )}>
          {isUser ? (
            <p className={cn(
              "mb-0 leading-relaxed",
              isMobile ? "text-sm" : "text-sm"
            )}>
              {message.content}
            </p>
          ) : (
            <div className="relative">
              <div className={cn(
                "prose prose-invert max-w-none leading-relaxed",
                isMobile ? "text-sm prose-sm" : "text-sm"
              )}>
                <ReactMarkdown
                  components={{
                    // Componentes personalizados para mejor responsive
                    p: ({ children }) => (
                      <p className={cn(
                        "mb-3 last:mb-0",
                        isMobile ? "leading-relaxed" : "leading-relaxed"
                      )}>
                        {children}
                      </p>
                    ),
                    h1: ({ children }) => (
                      <h1 className={cn(
                        "font-semibold mb-3",
                        isMobile ? "text-base" : "text-lg"
                      )}>
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className={cn(
                        "font-semibold mb-3",
                        isMobile ? "text-sm" : "text-base"
                      )}>
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className={cn(
                        "font-semibold mb-2",
                        isMobile ? "text-sm" : "text-sm"
                      )}>
                        {children}
                      </h3>
                    ),
                    ul: ({ children }) => (
                      <ul className={cn(
                        "list-disc ml-4 mb-3 space-y-1",
                        isMobile ? "ml-3" : "ml-4"
                      )}>
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className={cn(
                        "list-decimal ml-4 mb-3 space-y-1",
                        isMobile ? "ml-3" : "ml-4"
                      )}>
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className={cn(
                        isMobile ? "text-sm leading-relaxed" : "text-sm leading-relaxed"
                      )}>
                        {children}
                      </li>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className={cn(
                        "border-l-2 border-muted-foreground/30 pl-3 italic mb-3",
                        isMobile ? "pl-2 text-sm" : "pl-3 text-sm"
                      )}>
                        {children}
                      </blockquote>
                    ),
                    code: ({ children, ...props }) => {
                      const isInline = !props.className;
                      if (isInline) {
                        return (
                          <code className={cn(
                            "bg-muted px-1 py-0.5 rounded text-foreground/90",
                            isMobile ? "text-xs" : "text-xs"
                          )}>
                            {children}
                          </code>
                        );
                      }
                      return (
                        <code className={cn(
                          "block bg-muted p-3 rounded-lg overflow-x-auto",
                          isMobile ? "text-xs p-2" : "text-sm"
                        )}>
                          {children}
                        </code>
                      );
                    },
                    pre: ({ children }) => (
                      <pre className={cn(
                        "bg-muted rounded-lg overflow-x-auto mb-3",
                        isMobile ? "p-2" : "p-3"
                      )}>
                        {children}
                      </pre>
                    ),
                    table: ({ children }) => (
                      <div className="overflow-x-auto mb-3">
                        <table className={cn(
                          "min-w-full border-collapse border border-border",
                          isMobile ? "text-xs" : "text-sm"
                        )}>
                          {children}
                        </table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th className={cn(
                        "border border-border bg-muted font-semibold text-left",
                        isMobile ? "p-1" : "p-2"
                      )}>
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className={cn(
                        "border border-border",
                        isMobile ? "p-1" : "p-2"
                      )}>
                        {children}
                      </td>
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
              {isStreaming && !isComplete && (
                <span className={cn(
                  "inline-block bg-muted-foreground/60 ml-1 animate-pulse rounded-full",
                  isMobile ? "w-0.5 h-3" : "w-0.5 h-4"
                )} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}