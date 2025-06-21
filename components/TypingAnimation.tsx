'use client';

import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

export default function TypingAnimation() {
  const isMobile = useIsMobile();

  return (
    <div className={cn(
      "flex",
      isMobile ? "gap-2" : "gap-4"
    )}>
      {/* Icono AI con animación personalizada */}
      <div className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-full bg-muted/70 border border-border/30 relative",
        isMobile ? "h-6 w-6" : "h-8 w-8"
      )}>
        {/* Icono AI base */}
        <svg 
          className={cn(
            "text-foreground/80",
            isMobile ? "w-3 h-3" : "w-4 h-4"
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
        
        {/* Círculos concéntricos animados */}
        <div className="absolute inset-0 rounded-full">
          <div className="absolute inset-0 rounded-full border border-foreground/20 animate-ping" style={{animationDuration: '2s'}} />
          <div className="absolute inset-1 rounded-full border border-foreground/30 animate-ping" style={{animationDuration: '2.5s', animationDelay: '0.5s'}} />
        </div>
        
        {/* Punto de actividad giratorio */}
        <div className={cn(
          "absolute",
          isMobile ? "-top-0.5 -right-0.5" : "-top-0.5 -right-0.5"
        )}>
          <div className={cn(
            "relative",
            isMobile ? "w-2 h-2" : "w-2.5 h-2.5"
          )}>
            <div className="absolute inset-0 rounded-full bg-foreground/60 animate-pulse" />
            <div className={cn(
              "absolute bg-foreground/80 rounded-full animate-spin",
              isMobile 
                ? "top-0.5 left-0.5 w-1 h-1" 
                : "top-0.5 left-0.5 w-1.5 h-1.5"
            )} style={{animationDuration: '3s'}} />
          </div>
        </div>
      </div>
      
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className={cn(
          "flex items-center bg-muted/20 rounded-2xl",
          isMobile ? "gap-2 px-3 py-2" : "gap-3 px-4 py-3"
        )}>
          {/* Puntos rebotantes mejorados */}
          <div className="flex items-center gap-1.5">
            <div className="flex space-x-1">
              <div className={cn(
                "bg-foreground/40 rounded-full animate-bounce",
                isMobile ? "w-1.5 h-1.5" : "w-2 h-2"
              )} style={{animationDelay: '0ms', animationDuration: '1.4s'}} />
              <div className={cn(
                "bg-foreground/50 rounded-full animate-bounce",
                isMobile ? "w-1.5 h-1.5" : "w-2 h-2"
              )} style={{animationDelay: '150ms', animationDuration: '1.4s'}} />
              <div className={cn(
                "bg-foreground/60 rounded-full animate-bounce",
                isMobile ? "w-1.5 h-1.5" : "w-2 h-2"
              )} style={{animationDelay: '300ms', animationDuration: '1.4s'}} />
            </div>
            
            {/* Separador sutil */}
            <div className={cn(
              "bg-foreground/20",
              isMobile ? "w-px h-3 mx-1" : "w-px h-4 mx-2"
            )} />
            
            {/* Ondas de procesamiento */}
            <div className="flex items-center space-x-0.5">
              <div className={cn(
                "bg-foreground/30 rounded-full animate-wave-pulse",
                isMobile ? "w-0.5 h-2" : "w-1 h-3"
              )} style={{animationDelay: '0ms'}} />
              <div className={cn(
                "bg-foreground/40 rounded-full animate-wave-pulse",
                isMobile ? "w-0.5 h-3" : "w-1 h-4"
              )} style={{animationDelay: '100ms'}} />
              <div className={cn(
                "bg-foreground/50 rounded-full animate-wave-pulse",
                isMobile ? "w-0.5 h-4" : "w-1 h-5"
              )} style={{animationDelay: '200ms'}} />
              <div className={cn(
                "bg-foreground/40 rounded-full animate-wave-pulse",
                isMobile ? "w-0.5 h-3" : "w-1 h-4"
              )} style={{animationDelay: '300ms'}} />
              <div className={cn(
                "bg-foreground/30 rounded-full animate-wave-pulse",
                isMobile ? "w-0.5 h-2" : "w-1 h-3"
              )} style={{animationDelay: '400ms'}} />
            </div>
          </div>
          
          {/* Texto de estado */}
          <span className={cn(
            "text-foreground/70 font-medium",
            isMobile ? "text-xs" : "text-xs"
          )}>
            Procesando
          </span>
        </div>
      </div>
    </div>
  );
}