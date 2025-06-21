'use client';

import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TypingAnimation() {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/20">
        <Bot className="h-4 w-4 text-primary" />
      </div>
      
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="prose prose-invert inline-block text-left">
          <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 rounded-2xl backdrop-blur">
            {/* Círculo principal giratorio */}
            <div className="relative">
              <div className="h-6 w-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              <div className="absolute inset-0 h-6 w-6 rounded-full border border-primary/10 animate-pulse" />
            </div>
            
            {/* Puntos animados */}
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" />
            </div>
            
            {/* Texto con efecto de escritura */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground font-medium">
                Procesando
              </span>
              <div className="flex gap-0.5">
                <span className="animate-pulse [animation-delay:0s]">.</span>
                <span className="animate-pulse [animation-delay:0.2s]">.</span>
                <span className="animate-pulse [animation-delay:0.4s]">.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}