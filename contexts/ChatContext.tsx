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
  title: string | null; // El título puede ser nulo
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
    } else {
      setChats([]);
      setMessages([]);
      setActiveThreadId(null);
    }
  }, [user, loadUserChats]);

  const loadChat = async (chatId: string) => {
    if (isLoading) return;
    setIsLoading(true);
    setActiveThreadId(chatId); // Marcar como activo inmediatamente
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading chat:', error);
      setMessages([{ id: crypto.randomUUID(), role: 'assistant', content: 'Error al cargar este chat.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewChat = () => {
    setActiveThreadId(null);
    setMessages([]);
  };

  const sendMessage = async (content: string) => {
    if (!user || isLoading || !content.trim()) return;

    setIsLoading(true);

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
    };
    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    
    let currentChatId = activeThreadId;
    let newChatCreated = false;

    try {
      // 1. Crear chat si es necesario
      if (!currentChatId) {
        newChatCreated = true;
        const { data: newChat, error: chatError } = await supabase
          .from('chats')
          .insert({ user_id: user.id, title: content.slice(0, 50) })
          .select()
          .single();
        if (chatError) throw chatError;
        currentChatId = newChat.id;
        setActiveThreadId(currentChatId);
      }

      // 2. Guardar mensaje del usuario en la BD
      await supabase.from('messages').insert({ chat_id: currentChatId, role: 'user', content });

      if (newChatCreated) {
        await loadUserChats();
      }

      // 3. Obtener token y llamar a la API de backend
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No hay sesión de usuario activa.");
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) throw new Error("La URL de la API no está configurada en el frontend.");

      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: currentMessages,
          thread_id: currentChatId,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: `Error HTTP ${response.status}` }));
        throw new Error(errorBody.error || `Error del servidor: ${response.statusText}`);
      }
      if (!response.body) throw new Error("La respuesta de la API no tiene cuerpo.");

      // 4. Procesar respuesta en streaming
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessageContent = '';
      const assistantId = crypto.randomUUID();
      
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const rawChunk = decoder.decode(value, { stream: true });
        const lines = rawChunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            if (data.trim() === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.content) {
                assistantMessageContent += parsed.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: assistantMessageContent } : m
                  )
                );
              }
            } catch (e) {
              console.error("Error procesando chunk de stream:", e, "Chunk:", data);
            }
          }
        }
      }

      // 5. Guardar respuesta final del asistente en la BD
      if (assistantMessageContent.trim()) {
        await supabase.from('messages').insert({
          chat_id: currentChatId,
          role: 'assistant',
          content: assistantMessageContent,
        });
      }

      // 6. Actualizar timestamp del chat para que suba en la lista
      await supabase
        .from('chats')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', currentChatId);
      
      if (!newChatCreated) {
        await loadUserChats(); // Recargar para reordenar
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido.";
      console.error('Error enviando mensaje:', error);
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Lo siento, hubo un error al procesar tu mensaje: ${errorMessage}`,
      }]);
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
        if (!session) throw new Error("No hay sesión de usuario activa.");

        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        if (!apiUrl) throw new Error("La URL de la API no está configurada.");

        const response = await fetch(`${apiUrl}/api/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}` },
            body: formData,
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Error HTTP ${response.status}`);
        
        setMessages(prev => [...prev, {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: result.message || `Archivo "${file.name}" subido. Ya puedes hacer preguntas sobre él.`
        }]);

    } catch (error) {
        console.error('Error subiendo archivo:', error);
        setMessages(prev => [...prev, {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `Error al subir el archivo: ${error instanceof Error ? error.message : 'Error desconocido'}.`
        }]);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <ChatContext.Provider
      value={{ messages, chats, activeThreadId, isLoading, sendMessage, startNewChat, loadChat, uploadFile }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat debe ser usado dentro de un ChatProvider');
  }
  return context;
};