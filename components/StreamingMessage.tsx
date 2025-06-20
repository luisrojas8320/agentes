'use client';

import { Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface StreamingMessageProps {
  content: string;
  isComplete?: boolean;
}

export default function StreamingMessage({ content, isComplete = false }: StreamingMessageProps) {
  const [displayedContent, setDisplayedContent] = useState('');
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    if (content.length === 0) {
      setDisplayedContent('');
      return;
    }

    // Simular efecto de escritura más natural
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < content.length) {
        // Agregar caracteres de forma más natural (a veces más rápido, a veces más lento)
        const charsToAdd = Math.random() > 0.7 ? Math.floor(Math.random() * 3) + 1 : 1;
        const nextIndex = Math.min(currentIndex + charsToAdd, content.length);
        setDisplayedContent(content.slice(0, nextIndex));
        currentIndex = nextIndex;
      } else {
        clearInterval(interval);
        if (isComplete) {
          setShowCursor(false);
        }
      }
    }, Math.random() * 50 + 20); // Velocidad variable entre 20-70ms

    return () => clearInterval(interval);
  }, [content, isComplete]);

  // Efecto de parpadeo del cursor
  useEffect(() => {
    if (!showCursor) return;
    
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 500);

    return () => clearInterval(cursorInterval);
  }, [showCursor]);

  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-secondary">
        <Bot className="h-4 w-4" />
      </div>
      
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="prose prose-invert inline-block text-left max-w-none">
          <div className="relative">
            <div className="prose prose-invert max-w-none text-sm">
              <ReactMarkdown>
                {displayedContent}
              </ReactMarkdown>
            </div>
            {!isComplete && (
              <span 
                className={cn(
                  "inline-block w-2 h-4 bg-primary ml-1 transition-opacity duration-100",
                  showCursor ? "opacity-100" : "opacity-0"
                )}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}