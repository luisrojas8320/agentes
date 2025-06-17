"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { useParams } from "next/navigation" 
import { createClient } from "@/utils/supabase/client"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Send, Paperclip, Loader2 } from "lucide-react" 
import { useToast } from "@/components/ui/use-toast"

// Definición de tipos local, ya no depende de la librería 'ai'
interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  created_at: string;
  chat_id: string;
}

export default function ChatInterface() {
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const params = useParams<{ chatId: string }>()
  const chatId = params.chatId;
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages]);

  // Hook para cargar el historial del chat
  useEffect(() => {
    if (!chatId || !user) return;

    const fetchMessages = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error("Error fetching messages:", error);
        toast({ title: "Error", description: "Could not load chat history.", variant: "destructive" });
      } else {
        setMessages(data as Message[]);
      }
      setIsLoading(false);
    };

    fetchMessages();
    // CORRECCIÓN: Se elimina la suscripción a Realtime ya que la respuesta del agente
    // se maneja directamente a través de la petición fetch para simplificar.
  }, [chatId, user, toast, supabase]);

  // Lógica para enviar el mensaje
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isLoading || isUploading) return;

    const userMessageContent = newMessage.trim();
    
    // Añadir mensaje del usuario a la UI inmediatamente (actualización optimista)
    const newMessages = [
      ...messages, 
      { 
        id: crypto.randomUUID(), 
        content: userMessageContent, 
        role: 'user' as const, 
        created_at: new Date().toISOString(),
        chat_id: chatId
      }
    ];
    setMessages(newMessages);
    setNewMessage("");
    setIsLoading(true);

    try {
      // CORRECCIÓN: Apuntamos a la ruta unificada /api/chat de nuestro backend de Python
      const response = await fetch('/api/chat', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // CORRECCIÓN: Enviamos el historial completo como espera el backend
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Server responded with an error.");
      }
      
      // CORRECCIÓN: Procesamos la respuesta JSON simple del backend, no un stream.
      const result = await response.json();

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        content: result.response || "No se recibió una respuesta válida.",
        role: 'assistant',
        created_at: new Date().toISOString(),
        chat_id: chatId
      };
      
      setMessages(prev => [...prev, assistantMessage]);

    } catch (error: any) {
      console.error("Error sending message:", error);
      toast({ title: "Error de Comunicación", description: error.message, variant: "destructive" });
      // Si falla, se podría revertir la actualización optimista
      setMessages(messages);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-8rem)] bg-background">
      <Card className="flex-grow overflow-y-auto">
        <CardContent className="p-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-xl p-3 rounded-lg shadow-md ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex justify-start">
                <div className="max-w-xs lg:max-w-md p-3 rounded-lg bg-muted flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Pensando...</span>
                </div>
              </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>
      </Card>
      
      <div className="mt-4 border-t pt-4">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" disabled={isUploading}>
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={"Escribe tu mensaje..."}
            className="flex-grow resize-none"
            rows={1}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e as any); } }}
          />
          <Button type="submit" size="icon" disabled={isLoading || isUploading || !newMessage.trim()}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  )
}