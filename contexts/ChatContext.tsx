// Ruta: contexts/ChatContext.tsx
'use client';

import { createContext, useContext, useState, ReactNode, FC } from 'react';
import { streamChatMessage } from '@/lib/chat';

// ... (Interfaz Message y ChatContextType sin cambios)
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
    const assistantMessageId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, newUserMessage, { id: assistantMessageId, role: 'assistant', content: '' }]);

    await streamChatMessage(
      [...messages, newUserMessage],
      (chunk) => {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, content: msg.content + chunk }
              : msg
          )
        );
      },
      (error) => {
        // <-- MEJORA CLAVE: Mostrar el mensaje de error en la UI
        setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: `**Error:** ${error.message}` } // <-- Muestra el error
                : msg
            )
          );
        setIsLoading(false);
      },
      () => {
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

// ... (hook useChat sin cambios)
export const useChat = () => {
    const context = useContext(ChatContext);
    if (context === undefined) {
      throw new Error('useChat debe ser usado dentro de un ChatProvider');
    }
    return context;
  };