// Ruta: app/chat/[id]/page.tsx

"use client"

import { useState, useEffect, useRef, FormEvent, useCallback, ChangeEvent } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client" 
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { Mic, Send, Paperclip, Image as ImageIcon } from 'lucide-react' 

// ... (El resto de las interfaces y declaraciones no cambian)
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
interface Message {
  id: string;
  chat_id: string;
  content: string;
  created_at: string;
  role: "user" | "assistant";
}
interface Agent {
    id: string;
    name: string;
    description: string;
}

export default function ChatPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const chatId = params.id

  const [messages, setMessages] = useState<Message[]>([])
  const [agent, setAgent] = useState<Agent | null>(null)
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<any>(null)
  const documentInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [lastUploadedFileId, setLastUploadedFileId] = useState<string | null>(null);

  const fetchChatData = useCallback(async () => { /* ... sin cambios ... */ });
  useEffect(() => { /* ... sin cambios ... */ }, [authLoading, user, fetchChatData, router]);
  useEffect(() => { /* ... sin cambios ... */ }, [messages]);
  useEffect(() => { /* ... sin cambios ... */ }, []);
  const handleListen = () => { /* ... sin cambios ... */ };
  const handleFileUpload = async (file: File, endpoint: string, successMessage: string) => { /* ... sin cambios ... */ };
  const handleDocumentChange = (e: ChangeEvent<HTMLInputElement>) => { /* ... sin cambios ... */ };
  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => { /* ... sin cambios ... */ };

  // =================================================================================
  // PASO FINAL: Modificar handleSendMessage para procesar la respuesta en stream.
  // =================================================================================
  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending || !user) return;

    const tempUserMessage: Message = { id: crypto.randomUUID(), chat_id: chatId, content: input, created_at: new Date().toISOString(), role: "user" };
    setMessages((prev) => [...prev, tempUserMessage]);
    const currentInput = input;
    setInput("");
    setIsSending(true);

    // Placeholder para el mensaje del asistente, que se irá actualizando
    const tempAssistantMessage: Message = { id: crypto.randomUUID(), chat_id: chatId, content: "Pensando...", created_at: new Date().toISOString(), role: "assistant" };
    setMessages((prev) => [...prev, tempAssistantMessage]);

    try {
      const bodyPayload = { text: currentInput, chatId, lastUploadedFileId };
      setLastUploadedFileId(null);

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      if (!response.body) {
        throw new Error("La respuesta no tiene cuerpo.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value);

        // Procesamos los eventos que nos llegan del stream
        const lines = chunkValue.split('\n\n').filter(line => line.trim() !== '');
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = JSON.parse(line.substring(6));
                if (data.type === 'final_answer') {
                    // Actualizamos el mensaje del asistente con la respuesta final
                    setMessages(prev => prev.map(m => 
                        m.id === tempAssistantMessage.id ? { ...m, content: data.content } : m
                    ));
                }
                // Aquí podríamos manejar otros tipos de eventos, como 'tool_start', etc.
            }
        }
      }

    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setMessages(prev => prev.filter(m => m.id !== tempAssistantMessage.id && m.id !== tempUserMessage.id));
    } finally {
      setIsSending(false);
    }
  };

  return (
    // ... El JSX no cambia, solo la lógica de handleSendMessage ...
    <div className="flex flex-col h-screen bg-gray-50">
      <header>...</header>
      <main>...</main>
      <footer>...</footer>
    </div>
  )
}