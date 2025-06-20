'use client';

import { useRef, useEffect } from 'react';
import { useChat } from '@/contexts/ChatContext';
import ChatMessage from '@/components/ChatMessage';
import TypingAnimation from '@/components/TypingAnimation';

export default function MessageList() {
  const { messages, isLoading } = useChat();
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  // Verificar si hay un mensaje siendo streaming
  const isAnyMessageStreaming = messages.some(m => m.isStreaming && !m.isComplete);

  return (
    <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4">
      <div className="max-w-3xl mx-auto">
        {messages.length > 0 ? (
          <div className="space-y-4">
            {messages.map((message) => (
              <ChatMessage 
                key={message.id} 
                message={message}
                isStreaming={message.isStreaming}
                isComplete={message.isComplete}
              />
            ))}
            {/* Mostrar animación de pensando solo si está cargando y no hay streaming */}
            {isLoading && !isAnyMessageStreaming && (
              <TypingAnimation />
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-center py-32">
            <div>
              <h1 className="text-4xl font-bold mb-2">AI Playground</h1>
              <p className="text-muted-foreground text-lg">
                ¿En qué puedo ayudarte hoy?
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}