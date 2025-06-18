// Ruta: contexts/ChatContext.tsx
'use client';

import { createContext, useContext, useState, ReactNode, FC } from 'react';
import { streamChatMessage } from '@/lib/chat'; // <-- Importamos la nueva función

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface ChatContextType {
  messages: Message[];
  isLoading: boolean;
  sendMessage: (messageContent: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (messageContent: string) => {
    if (isLoading || !messageContent.trim()) return;

    setIsLoading(true);
    const newUserMessage: Message = { id: Date.now().toString(), role: 'user', content: messageContent };
    
    // Creamos un ID para el mensaje del asistente por adelantado
    const assistantMessageId = (Date.now() + 1).toString();
    
    // Añadimos el mensaje del usuario y un mensaje vacío del asistente
    setMessages(prev => [...prev, newUserMessage, { id: assistantMessageId, role: 'assistant', content: '' }]);

    await streamChatMessage(
      [...messages, newUserMessage], // Enviamos el historial actualizado
      (chunk) => {
        // Callback 'onChunk': actualiza el último mensaje del asistente con el nuevo trozo
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, content: msg.content + chunk }
              : msg
          )
        );
      },
      (error) => {
        // Callback 'onError': muestra un mensaje de error
        setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: `Error: ${error.message}` }
                : msg
            )
          );
        setIsLoading(false);
      },
      () => {
        // Callback 'onDone': se ejecuta cuando el stream termina
        setIsLoading(false);
      }
    );
  };

  return (
    <ChatContext.Provider value={{ messages, isLoading, sendMessage }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat debe ser usado dentro de un ChatProvider');
  }
  return context;
};