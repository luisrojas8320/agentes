// Ruta: contexts/ChatContext.tsx
'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuth } from './AuthContext';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

interface Chat {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatContextType {
  messages: Message[];
  chats: Chat[];
  activeThreadId: string | null;
  isLoading: boolean;
  sendMessage: (content: string) => Promise<void>;
  startNewChat: () => void;
  loadChat: (chatId: string) => Promise<void>;
  uploadFile?: (file: File) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { user } = useAuth();
  const supabase = createClient();

  const loadUserChats = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (!error && data) {
      setChats(data);
    }
  }, [user, supabase]);

  useEffect(() => {
    if (user) {
      loadUserChats();
    }
  }, [user, loadUserChats]);

  const loadChat = async (chatId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data);
        setActiveThreadId(chatId);
      }
    } catch (error) {
      console.error('Error loading chat:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setActiveThreadId(null);
  };

  const sendMessage = async (content: string) => {
    if (!user) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      let chatId = activeThreadId;
      if (!chatId) {
        const { data: newChat, error: chatError } = await supabase
          .from('chats')
          .insert({
            user_id: user.id,
            title: content.slice(0, 50),
          })
          .select()
          .single();

        if (chatError) throw chatError;
        chatId = newChat.id;
        setActiveThreadId(chatId);
        loadUserChats();
      }

      await supabase.from('messages').insert({
        chat_id: chatId,
        role: 'user',
        content,
      });

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          messages: newMessages,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Error en la respuesta del servidor');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessageContent = '';
      const assistantId = crypto.randomUUID();

      setMessages((prev) => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: ''
      }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                assistantMessageContent += parsed.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: assistantMessageContent }
                      : m
                  )
                );
              }
            } catch (e) {
              console.error('Error parsing SSE:', e);
            }
          }
        }
      }

      if (assistantMessageContent) {
        await supabase.from('messages').insert({
          chat_id: chatId,
          role: 'assistant',
          content: assistantMessageContent,
        });
      }

      await supabase
        .from('chats')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', chatId);

    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Lo siento, hubo un error al procesar tu mensaje.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const uploadFile = async (file: File) => {
    if (!user) return;

    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Error al subir el archivo: ${errorBody}`);
      }

      const result = await response.json();
      console.log('Archivo subido:', result);
       setMessages(prev => [...prev, {
         id: crypto.randomUUID(),
         role: 'assistant',
         content: `Archivo "${file.name}" subido con éxito. Ya puedes hacer preguntas sobre él.`
       }])

    } catch (error) {
      console.error('Error uploading file:', error);
       setMessages(prev => [...prev, {
         id: crypto.randomUUID(),
         role: 'assistant',
         content: `Error al subir el archivo: ${error instanceof Error ? error.message : 'Error desconocido'}.`
       }])
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ChatContext.Provider
      value={{
        messages,
        chats,
        activeThreadId,
        isLoading,
        sendMessage,
        startNewChat,
        loadChat,
        uploadFile,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};