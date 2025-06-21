// ================================
// 1. ARREGLAR MessageList.tsx - Pantalla de Bienvenida
// ================================

'use client';

import { useRef, useEffect, useState } from 'react';
import { useChat } from '@/contexts/ChatContext';
import ChatMessage from '@/components/ChatMessage';
import TypingAnimation from '@/components/TypingAnimation';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export default function MessageList() {
  const { messages, isLoading } = useChat();
  const { user } = useAuth();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0) {
      setShowWelcome(false);
    }
  }, [messages]);

  const isAnyMessageStreaming = messages.some(m => m.isStreaming && !m.isComplete);

  // Extraer el nombre del usuario del email
  const getUserName = () => {
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'Usuario';
  };

  return (
    <div 
      ref={chatContainerRef} 
      className={cn(
        "flex-1 overflow-y-auto",
        // ARREGLO: Asegurar que el scroll funcione bien en mobile
        isMobile && "overscroll-contain"
      )}
      style={{
        // Prevenir el rebote en iOS
        WebkitOverflowScrolling: 'touch'
      }}
    >
      <div className={cn(
        "mx-auto",
        // ARREGLO: Mejor espaciado para mobile
        isMobile 
          ? "max-w-full px-4 py-6 chat-container" 
          : "max-w-4xl px-6 py-8"
      )}>
        {showWelcome && messages.length === 0 ? (
          // ARREGLO: Pantalla de bienvenida optimizada para mobile
          <div className={cn(
            "flex flex-col items-center justify-center animate-fade-in",
            // ARREGLO: Altura más pequeña en mobile para evitar solapamiento
            isMobile 
              ? "min-h-[40vh] px-4 text-center" 
              : "min-h-[70vh]"
          )}>
            <div className="space-y-3">
              <h1 className={cn(
                "font-normal text-foreground",
                // ARREGLO: Texto más pequeño en mobile
                isMobile 
                  ? "text-2xl leading-tight" 
                  : "text-5xl"
              )}>
                Hola, <span className="text-foreground/60">{getUserName()}</span>
              </h1>
              
              {/* ARREGLO: Mensaje más corto y claro para mobile */}
              <p className={cn(
                "text-foreground/50 leading-relaxed",
                isMobile 
                  ? "text-sm max-w-xs mx-auto mt-3" 
                  : "text-base max-w-md mx-auto mt-4"
              )}>
                {isMobile 
                  ? "¿En qué puedo ayudarte?" 
                  : "¿En qué puedo ayudarte hoy?"}
              </p>
              
              {/* ARREGLO: Sugerencias rápidas solo en mobile */}
              {isMobile && (
                <div className="mt-6 space-y-2">
                  <p className="text-xs text-foreground/40 mb-3">Prueba preguntando:</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <span className="px-3 py-1 bg-muted/30 rounded-full text-xs text-foreground/60">
                      Busca en internet
                    </span>
                    <span className="px-3 py-1 bg-muted/30 rounded-full text-xs text-foreground/60">
                      Analiza documentos
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Lista de mensajes optimizada
          <div className={cn(
            "spacing-responsive",
            // ARREGLO: Mejor espaciado entre mensajes en mobile
            isMobile ? "space-y-6" : "space-y-6"
          )}>
            {messages.map((message) => (
              <div key={message.id} className="animate-slide-up">
                <ChatMessage 
                  message={message}
                  isStreaming={message.isStreaming}
                  isComplete={message.isComplete}
                />
              </div>
            ))}
            
            {isLoading && !isAnyMessageStreaming && (
              <div className="animate-slide-up">
                <TypingAnimation />
              </div>
            )}

            {/* ARREGLO: Más espacio al final para mobile */}
            {isMobile && messages.length > 0 && (
              <div className="h-8" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}