'use client';

import { cn } from '@/lib/utils';

export default function TypingAnimation() {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-muted/50">
        <div className="h-4 w-4 rounded-full bg-muted-foreground/30" />
      </div>
      
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 bg-muted/20 rounded-2xl">
          {/* Puntos animados ultra minimalistas */}
          <div className="flex items-center gap-1">
            <div className="w-1 h-1 bg-muted-foreground/50 rounded-full animate-pulse [animation-delay:-0.3s]" />
            <div className="w-1 h-1 bg-muted-foreground/50 rounded-full animate-pulse [animation-delay:-0.15s]" />
            <div className="w-1 h-1 bg-muted-foreground/50 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}