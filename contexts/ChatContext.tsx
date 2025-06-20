'use client';

import { createContext, useContext, useState, ReactNode, FC, useEffect } from 'react';
// CORRECCIÓN CLAVE: La ruta de importación se ajusta a la estructura de tu proyecto.
import { createClient } from '../utils/supabase/client'; 
// CORRECCIÓN CLAVE: Se importan los tipos necesarios directamente desde la librería.
import type { Session, AuthChangeEvent, Subscription } from '@supabase/supabase-js';
import { toast } from 'sonner';

// ==================================================================
// 1. DEFINICIÓN DE TIPOS (Autocontenidos para evitar conflictos)
// ==================================================================
interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

interface Chat {
    id: string;
    title: string | null;
    created_at: string;
}

interface ChatContextType {
    messages: Message[];
    chats: Chat[];
    activeThreadId: string | null;
    isLoading: boolean;
    sendMessage: (messageContent: string) => Promise<void>;
    uploadFile: (file: File) => Promise<void>;
    startNewChat: () => void;
    loadChat: (threadId: string) => Promise<void>;
}

// ==================================================================
// 2. FUNCIONES DE COMUNICACIÓN CON LA API (Backend)
// ==================================================================

async function streamChatMessage(
    message: string,
    thread_id: string | null,
    accessToken: string,
    onChunk: (chunk: string, threadId: string | null) => void,
    onError: (error: Error) => void,
    onDone: () => void
): Promise<void> {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
        onError(new Error("La variable de entorno NEXT_PUBLIC_API_URL no está configurada."));
        return;
    }
    try {
        const response = await fetch(`${apiUrl}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ message, thread_id }),
        });
        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({ error: `Error HTTP ${response.status}` }));
            throw new Error(errorBody.error || `Error HTTP ${response.status}`);
        }
        if (!response.body) throw new Error("La respuesta del servidor no tiene cuerpo.");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const rawChunk = decoder.decode(value);
            const lines = rawChunk.split('\n\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.substring(6);
                    if (data.trim() === '[DONE]') {
                        onDone();
                        return;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.content) {
                            onChunk(parsed.content, parsed.thread_id || null);
                        } else if (parsed.error) {
                            throw new Error(parsed.error);
                        }
                    } catch (e) { 
                        console.error("Error al procesar el fragmento de datos (chunk):", data); 
                    }
                }
            }
        }
    } catch (error) {
        onError(error instanceof Error ? error : new Error("Ocurrió un error desconocido."));
    } finally {
        onDone();
    }
}

async function listChats(accessToken: string): Promise<Chat[]> {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
        console.error("URL de API no configurada.");
        return [];
    }
    try {
        const response = await fetch(`${apiUrl}/api/chats`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (!response.ok) {
            const res = await response.json();
            throw new Error(res.error || 'No se pudo obtener la lista de chats.');
        }
        return await response.json();
    } catch (error) {
        console.error("Error al obtener chats:", error);
        toast.error("Error al cargar los chats", { description: (error as Error).message });
        return [];
    }
}

async function uploadFileToApi(
    file: File,
    accessToken: string
): Promise<{ success: boolean; message: string }> {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return { success: false, message: "URL de API no configurada." };

    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch(`${apiUrl}/api/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` },
            body: formData,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Error HTTP ${response.status}`);
        return { success: true, message: result.message };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido.";
        return { success: false, message };
    }
}

// ==================================================================
// 3. CREACIÓN DEL CONTEXTO Y EL PROVEEDOR (PROVIDER)
// ==================================================================

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [chats, setChats] = useState<Chat[]>([]);
    const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [session, setSession] = useState<Session | null>(null);
    const supabase = createClient();

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        const { data: authListener } = supabase.auth.onAuthStateChange(
            // CORREGIDO: Se añaden tipos explícitos para el evento y la sesión.
            (_event: AuthChangeEvent, session: Session | null) => {
                setSession(session);
                if (!session) {
                    setMessages([]);
                    setChats([]);
                    setActiveThreadId(null);
                }
            }
        );

        // CORRECCIÓN FINAL: Se llama a unsubscribe sobre la propiedad 'subscription'.
        return () => {
            authListener?.subscription.unsubscribe();
        };
    }, [supabase.auth]);
    
    useEffect(() => {
        if (session) {
            const fetchChats = async () => {
                const fetchedChats = await listChats(session.access_token);
                setChats(fetchedChats);
            };
            fetchChats();
        }
    }, [session]);

    const sendMessage = async (messageContent: string) => {
        if (isLoading || !messageContent.trim() || !session) return;

        setIsLoading(true);
        const newUserMessage: Message = { id: Date.now().toString(), role: 'user', content: messageContent };
        setMessages(prev => [...prev, newUserMessage]);
        
        const assistantMessageId = (Date.now() + 1).toString();
        setMessages(prev => [...prev, { id: assistantMessageId, role: 'assistant', content: '' }]);

        let accumulatedResponse = '';
        let finalThreadId: string | null = activeThreadId;

        await streamChatMessage(
            messageContent,
            activeThreadId,
            session.access_token,
            (chunk, threadId) => {
                if (threadId && !finalThreadId) {
                    finalThreadId = threadId;
                    setActiveThreadId(threadId);
                }
                accumulatedResponse += chunk;
                setMessages(prev =>
                    prev.map(msg =>
                        msg.id === assistantMessageId ? { ...msg, content: accumulatedResponse } : msg
                    )
                );
            },
            (error) => {
                setMessages(prev =>
                    prev.map(msg =>
                        msg.id === assistantMessageId ? { ...msg, content: `**Error:** ${error.message}` } : msg
                    )
                );
                setIsLoading(false);
            },
            () => {
                if (finalThreadId && !chats.some(chat => chat.id === finalThreadId)) {
                     listChats(session.access_token).then(setChats);
                }
                setIsLoading(false);
            }
        );
    };
    
    const startNewChat = () => {
        setActiveThreadId(null);
        setMessages([]);
    };

    const loadChat = async (threadId: string) => {
        setActiveThreadId(threadId);
        setMessages([]);
        toast.info("Conversación cargada", { description: `Hilo activado. Envía un mensaje para continuar.` });
    };
    
    const uploadFile = async (file: File) => {
        if (!session) {
            toast.error("Error de autenticación", { description: "Necesitas iniciar sesión para subir archivos." });
            return;
        }
        if (file.type !== "application/pdf") {
            toast.error("Archivo no válido", { description: "Por favor, sube solo archivos PDF." });
            return;
        }
        
        toast.info("Subiendo archivo...", { description: file.name });
        setIsLoading(true);

        const result = await uploadFileToApi(file, session.access_token);

        if (result.success) {
            toast.success("Archivo procesado", { description: result.message });
            setMessages(prev => [...prev, {id: Date.now().toString(), role: 'assistant', content: `Archivo **${file.name}** subido y procesado. Ahora puedes hacer preguntas sobre él.`}]);
        } else {
            toast.error("Error al subir archivo", { description: result.message });
        }
        setIsLoading(false);
    };

    return (
        <ChatContext.Provider value={{ messages, chats, activeThreadId, isLoading, sendMessage, uploadFile, startNewChat, loadChat }}>
            {children}
        </ChatContext.Provider>
    );
};

// ==================================================================
// 4. HOOK PERSONALIZADO para consumir el contexto fácilmente.
// ==================================================================
export const useChat = () => {
    const context = useContext(ChatContext);
    if (context === undefined) {
        throw new Error('useChat debe ser usado dentro de un ChatProvider');
    }
    return context;
};