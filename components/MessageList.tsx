// Ruta: components/MessageList.tsx
'use client';
import { useRef, useEffect } from 'react';
import { useChat } from '@/contexts/ChatContext';
import ChatMessage from '@/components/ChatMessage';

export const MessageList = () => {
  const { messages } = useChat(); // <-- Obtiene mensajes del contexto
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // El efecto de scroll se mueve aquí porque pertenece a esta vista
  useEffect(() => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  return (
    // <-- Este es el JSX que cortaste de page.tsx
    <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length > 0 ? (
        messages.map((m) => <ChatMessage key={m.id} message={m} />)
      ) : (
        <div className="flex h-full items-center justify-center text-center">
          <div>
            <h1 className="text-5xl font-bold">Playground de Agentes</h1>
            <p className="text-gray-400 text-xl mt-2">¿En qué puedo ayudarte hoy?</p>
          </div>
        </div>
      )}
    </div>
  );
};