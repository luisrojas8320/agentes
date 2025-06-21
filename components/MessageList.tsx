'use client';

import { useRef, useEffect, useState } from 'react';
import { useChat } from '@/contexts/ChatContext';
import ChatMessage from '@/components/ChatMessage';
import TypingAnimation from '@/components/TypingAnimation';
import { useAuth } from '@/contexts/AuthContext';

export default function MessageList() {
  const { messages, isLoading } = useChat();
  const { user } = useAuth();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [showWelcome, setShowWelcome] = useState(true);

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
    <div ref={chatContainerRef} className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {showWelcome && messages.length === 0 ? (
          // Pantalla ultra minimalista como Gemini
          <div className="flex flex-col items-start justify-center min-h-[70vh] animate-fade-in">
            <div className="space-y-2">
              <h1 className="text-5xl font-normal text-foreground">
                Hola, <span className="text-muted-foreground">{getUserName()}</span>
              </h1>
            </div>
          </div>
        ) : (
          // Lista de mensajes minimalista
          <div className="space-y-6">
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
          </div>
        )}
      </div>
    </div>
  );
}