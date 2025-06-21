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
        // Asegurar que el scroll funcione bien en mobile
        isMobile && "overscroll-contain"
      )}
      style={{
        // Prevenir el rebote en iOS
        WebkitOverflowScrolling: 'touch'
      }}
    >
      <div className={cn(
        "mx-auto",
        isMobile 
          ? "max-w-full px-3 py-4 chat-container" 
          : "max-w-4xl px-6 py-8"
      )}>
        {showWelcome && messages.length === 0 ? (
          // Pantalla ultra minimalista centrada como Gemini - Responsive
          <div className={cn(
            "flex flex-col items-center justify-center animate-fade-in",
            isMobile 
              ? "min-h-[60vh] px-4" 
              : "min-h-[70vh]"
          )}>
            <div className="text-center space-y-2">
              <h1 className={cn(
                "font-normal text-foreground",
                isMobile 
                  ? "text-3xl leading-tight" 
                  : "text-5xl"
              )}>
                Hola, <span className="text-foreground/60">{getUserName()}</span>
              </h1>
              
              {/* Mensaje adicional para mobile */}
              {isMobile && (
                <p className="text-sm text-foreground/50 mt-4 max-w-xs mx-auto leading-relaxed">
                  ¿En qué puedo ayudarte hoy?
                </p>
              )}
            </div>
          </div>
        ) : (
          // Lista de mensajes minimalista - Responsive
          <div className={cn(
            "spacing-responsive",
            isMobile ? "space-y-4" : "space-y-6"
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

            {/* Espacio adicional al final para mobile */}
            {isMobile && messages.length > 0 && (
              <div className="h-4" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}