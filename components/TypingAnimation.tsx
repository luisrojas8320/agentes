'use client';

import { cn } from '@/lib/utils';

export default function TypingAnimation() {
  return (
    <div className="flex gap-4">
      {/* Icono AI con animación de pensamiento */}
      <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-muted/70 border border-border/30 relative">
        <svg 
          className="w-4 h-4 text-muted-foreground/80 animate-pulse" 
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
        
        {/* Indicador de actividad giratorio */}
        <div className="absolute -top-1 -right-1">
          <div className="w-3 h-3 border border-muted-foreground/40 border-t-muted-foreground/80 rounded-full animate-spin" />
        </div>
      </div>
      
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 bg-muted/20 rounded-2xl">
          {/* Animación de ondas de pensamiento */}
          <div className="flex items-center gap-1.5">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
              <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
              <div className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
            </div>
            
            {/* Separador sutil */}
            <div className="w-px h-4 bg-muted-foreground/20 mx-2" />
            
            {/* Ondas de procesamiento */}
            <div className="flex items-center space-x-0.5">
              <div className="w-1 h-3 bg-muted-foreground/30 rounded-full animate-pulse" style={{animationDelay: '0ms'}} />
              <div className="w-1 h-4 bg-muted-foreground/40 rounded-full animate-pulse" style={{animationDelay: '100ms'}} />
              <div className="w-1 h-5 bg-muted-foreground/50 rounded-full animate-pulse" style={{animationDelay: '200ms'}} />
              <div className="w-1 h-4 bg-muted-foreground/40 rounded-full animate-pulse" style={{animationDelay: '300ms'}} />
              <div className="w-1 h-3 bg-muted-foreground/30 rounded-full animate-pulse" style={{animationDelay: '400ms'}} />
            </div>
          </div>
          
          {/* Texto de estado */}
          <span className="text-xs text-muted-foreground/70 font-medium">
            Procesando
          </span>
        </div>
      </div>
    </div>
  );
}