'use client';

import { cn } from '@/lib/utils';

export default function TypingAnimation() {
  return (
    <div className="flex gap-4">
      {/* Icono AI con animación personalizada */}
      <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-muted/70 border border-border/30 relative">
        {/* Icono AI base */}
        <svg 
          className="w-4 h-4 text-foreground/80" 
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
        
        {/* Círculos concéntricos animados */}
        <div className="absolute inset-0 rounded-full">
          <div className="absolute inset-0 rounded-full border border-foreground/20 animate-ping" style={{animationDuration: '2s'}} />
          <div className="absolute inset-1 rounded-full border border-foreground/30 animate-ping" style={{animationDuration: '2.5s', animationDelay: '0.5s'}} />
        </div>
        
        {/* Punto de actividad giratorio */}
        <div className="absolute -top-0.5 -right-0.5">
          <div className="w-2.5 h-2.5 relative">
            <div className="absolute inset-0 rounded-full bg-foreground/60 animate-pulse" />
            <div className="absolute top-0.5 left-0.5 w-1.5 h-1.5 bg-foreground/80 rounded-full animate-spin" style={{animationDuration: '3s'}} />
          </div>
        </div>
      </div>
      
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 bg-muted/20 rounded-2xl">
          {/* Puntos rebotantes mejorados */}
          <div className="flex items-center gap-1.5">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{animationDelay: '0ms', animationDuration: '1.4s'}} />
              <div className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce" style={{animationDelay: '150ms', animationDuration: '1.4s'}} />
              <div className="w-2 h-2 bg-foreground/60 rounded-full animate-bounce" style={{animationDelay: '300ms', animationDuration: '1.4s'}} />
            </div>
            
            {/* Separador sutil */}
            <div className="w-px h-4 bg-foreground/20 mx-2" />
            
            {/* Ondas de procesamiento */}
            <div className="flex items-center space-x-0.5">
              <div className="w-1 h-3 bg-foreground/30 rounded-full animate-wave-pulse" style={{animationDelay: '0ms'}} />
              <div className="w-1 h-4 bg-foreground/40 rounded-full animate-wave-pulse" style={{animationDelay: '100ms'}} />
              <div className="w-1 h-5 bg-foreground/50 rounded-full animate-wave-pulse" style={{animationDelay: '200ms'}} />
              <div className="w-1 h-4 bg-foreground/40 rounded-full animate-wave-pulse" style={{animationDelay: '300ms'}} />
              <div className="w-1 h-3 bg-foreground/30 rounded-full animate-wave-pulse" style={{animationDelay: '400ms'}} />
            </div>
          </div>
          
          {/* Texto de estado */}
          <span className="text-xs text-foreground/70 font-medium">
            Procesando
          </span>
        </div>
      </div>
    </div>
  );
}