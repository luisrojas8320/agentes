// Ruta: contexts/ChatContext.tsx
'use client';

import { createContext, useContext, useState, ReactNode, FC } from 'react';
// <-- Lógica de API importada aquí
import { postChatMessage } from '@/lib/chat'; 

// <-- Interfaz movida aquí
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
  // <-- Hooks de estado movidos aquí
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // <-- Función de envío movida aquí
  const sendMessage = async (messageContent: string) => {
    if (isLoading || !messageContent.trim()) return;

    setIsLoading(true);
    const newUserMessage: Message = { id: Date.now().toString(), role: 'user', content: messageContent };
    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);

    try {
      const assistantResponseContent = await postChatMessage(updatedMessages);
      const assistantMessage: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: assistantResponseContent 
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error inesperado al enviar mensaje:", error);
      const errorMessage: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: "Ocurrió un error crítico en la aplicación." 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
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