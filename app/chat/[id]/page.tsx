// RUTA: app/chat/[id]/page.tsx

"use client"

import { useState, useEffect, useRef, FormEvent, useCallback, ChangeEvent } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client" 
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { Mic, Send, Paperclip } from 'lucide-react'
import { useChat, type Message } from 'ai/react'

// Interfaz para el Agente
interface Agent {
  id: string;
  name: string;
  description: string;
}

// Declaración global para la API de Reconocimiento de Voz
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function ChatPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const chatId = params.id

  const [agent, setAgent] = useState<Agent | null>(null)
  const [initialMessagesLoaded, setInitialMessagesLoaded] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isUploading, setIsUploading] = useState(false);
  const [lastUploadedFileId, setLastUploadedFileId] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null)
  const documentInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages, setInput } = useChat({
    api: "/api/chat",
    id: chatId,
    body: { lastUploadedFileId },
    onFinish: () => {
      setLastUploadedFileId(null);
    }
  });

  const fetchChatData = useCallback(async () => {
    if (!user || initialMessagesLoaded) return;
    
    const { data: agentData, error: agentError } = await supabase
      .from('chats')
      .select('agent_id, agents (id, name, description)')
      .eq('id', chatId)
      .single();

    if (agentError || !agentData) {
      toast({ title: "Error", description: "No se pudo cargar la información del agente.", variant: "destructive" });
      router.push('/');
      return;
    }

    // FIX: Asignación segura para evitar el error de tipos de Supabase
    const agentFromDb = agentData.agents as any;
    if (agentFromDb && agentFromDb.id && agentFromDb.name) {
        setAgent({
            id: agentFromDb.id,
            name: agentFromDb.name,
            description: agentFromDb.description || "", // Asegurarse de que description no sea null
        });
    }

    const { data: messagesData, error: messagesError } = await supabase
      .from('messages')
      .select('id, chat_id, content, created_at, role')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      toast({ title: "Error", description: "No se pudieron cargar los mensajes.", variant: "destructive" });
    } else {
      setMessages(messagesData as Message[]);
    }
    setInitialMessagesLoaded(true);
  }, [user, chatId, initialMessagesLoaded, router, setMessages, toast]);

  // --- El resto de las funciones y efectos no cambian ---

  useEffect(() => {
    if (!authLoading && user) {
      fetchChatData();
    }
    if (!authLoading && !user) {
        router.push('/login');
    }
  }, [authLoading, user, fetchChatData, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.lang = 'es-ES';
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Error en reconocimiento de voz:", event.error);
        toast({ title: "Error de Micrófono", description: "No se pudo reconocer la voz.", variant: "destructive" });
        setIsListening(false);
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [setInput, toast]);

  const handleListen = () => {
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
    setIsListening(!isListening);
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('chatId', chatId);

    try {
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      
      setLastUploadedFileId(result.documentId);
      toast({ title: "Éxito", description: `Archivo "${file.name}" listo para ser usado.` });
    } catch (error: any) {
      toast({ title: "Error de subida", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDocumentChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
        handleFileUpload(e.target.files[0]);
        if(e.target) e.target.value = '';
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-4 flex items-center justify-between shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{agent?.name || "Chat"}</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {messages.map(m => (
            <div key={m.id} className={`flex items-end gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`rounded-lg p-3 max-w-[80%] break-words ${m.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'}`}>
                <p className="text-sm whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          ))}
          {(isLoading && !isUploading) && (
             <div className="flex items-end gap-2 justify-start">
                <div className="rounded-lg p-3 max-w-lg bg-gray-200 dark:bg-gray-700 animate-pulse">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Pensando...</p>
                </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      <footer className="bg-white dark:bg-gray-800 border-t dark:border-gray-700 p-2 sm:p-4">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="icon" onClick={() => documentInputRef.current?.click()} disabled={isLoading || isUploading}>
                <Paperclip className="h-5 w-5" />
            </Button>
            <Input name="document" type="file" ref={documentInputRef} onChange={handleDocumentChange} className="hidden" accept=".pdf,.txt,.md" />
            
            <Input 
                className="flex-1" 
                placeholder={isListening ? "Escuchando..." : "Escribe tu mensaje..."}
                value={input}
                onChange={handleInputChange} 
                disabled={isLoading || isUploading}
            />

            <Button type="button" variant={isListening ? "destructive" : "ghost"} size="icon" onClick={handleListen} disabled={isLoading || isUploading}>
                <Mic className="h-5 w-5" />
            </Button>

            <Button type="submit" size="icon" disabled={isLoading || isUploading || !input.trim()}>
                <Send className="h-5 w-5" />
            </Button>
        </form>
      </footer>
    </div>
  )
}