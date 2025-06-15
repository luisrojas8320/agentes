"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation" 
// CORRECCIÓN: Se importa la función para crear el cliente, no una instancia.
import { createClient } from "@/utils/supabase/client"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Send, Paperclip, Loader2 } from "lucide-react" 
import { useToast } from "@/components/ui/use-toast"
import { RealtimeChannel } from "@supabase/supabase-js"

// Definición de tipos para los mensajes
interface Message {
  id: string;
  content: string;
  // Usamos 'role' para ser consistentes con el backend
  role: "user" | "assistant"; 
  created_at: string;
  chat_id: string;
}

export default function ChatInterface() {
  // CORRECCIÓN: Se crea la instancia del cliente de Supabase aquí.
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  
  // Estado para guardar el ID de un documento recién subido
  const [documentId, setDocumentId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const params = useParams<{ chatId: string }>()
  const chatId = params.chatId;
  const router = useRouter();
  const { user } = useAuth()
  const { toast } = useToast()

  // Hook para hacer scroll al final cuando llegan mensajes nuevos
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages]);

  // Hook para cargar el historial del chat y suscribirse a cambios en tiempo real
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

    // Suscripción a Realtime para nuevos mensajes (solo los del agente, el del usuario ya se añade localmente)
    const channel: RealtimeChannel = supabase.channel(`messages:chat_id=eq.${chatId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages', 
        filter: `chat_id=eq.${chatId}` 
      }, (payload) => {
        const newMessagePayload = payload.new as Message;
        // Evitamos duplicar el mensaje del usuario que ya se añadió al enviar
        if (newMessagePayload.role !== 'user') {
          setMessages((currentMessages) => [...currentMessages, newMessagePayload]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, user, toast, supabase]);

  
  // Implementación completa de la subida de archivos
  const uploadAndProcessFile = useCallback(async (fileToUpload: File) => {
    if (!chatId) return;
    setIsUploading(true);
    
    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('chatId', chatId);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to upload file.');
      }

      toast({ title: "Archivo subido", description: `"${fileToUpload.name}" listo para ser usado.` });
      setDocumentId(result.documentId); // Guardamos el ID del documento
      
    } catch (error: any) {
      console.error("Error uploading file:", error);
      toast({ title: "Error de Subida", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  }, [chatId, toast]);


  // Lógica completa para enviar mensaje y manejar el stream de respuesta
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || isLoading || isUploading) return;

    const userMessageContent = newMessage.trim();
    const tempMessageId = crypto.randomUUID(); // ID temporal para la UI

    // Añadir mensaje del usuario a la UI inmediatamente
    setMessages(prev => [
      ...prev, 
      { 
        id: tempMessageId, 
        content: userMessageContent, 
        role: 'user', 
        created_at: new Date().toISOString(),
        chat_id: chatId
      }
    ]);
    
    setIsLoading(true);
    setNewMessage("");

    try {
      // La API correcta para un chat existente
      const response = await fetch(`/api/chat/${chatId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessageContent,
          // Se envía el ID del documento si se acaba de subir
          document_id: documentId, 
        }),
      });

      // Se resetea el ID del documento después de usarlo
      setDocumentId(null);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Server responded with an error.");
      }
      
      if (!response.body) {
        throw new Error("The response body is empty.");
      }

      // Preparar para leer el stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedResponse = "";
      const agentMessageId = crypto.randomUUID();

      // Añadir el contenedor del mensaje del agente
      setMessages(prev => [
        ...prev, 
        { 
          id: agentMessageId, 
          content: "", 
          role: 'assistant', 
          created_at: new Date().toISOString(),
          chat_id: chatId
        }
      ]);

      // Leer el stream chunk por chunk
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        accumulatedResponse += chunk;

        // Actualizar el contenido del mensaje del agente en la UI
        setMessages(prev => prev.map(msg => 
          msg.id === agentMessageId 
            ? { ...msg, content: accumulatedResponse } 
            : msg
        ));
      }

    } catch (error: any) {
      console.error("Error sending message:", error);
      toast({ title: "Error de Comunicación", description: error.message, variant: "destructive" });
      // Si falla, se elimina el mensaje temporal del usuario
      setMessages(prev => prev.filter(msg => msg.id !== tempMessageId));
    } finally {
      setIsLoading(false);
    }
  };

  // Función para manejar la selección de archivos, ahora llama a la subida
  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ["text/plain", "application/pdf", "image/png", "image/jpeg"];
      if (!allowedTypes.includes(file.type)) {
        toast({ title: "Tipo de archivo no válido", variant: "destructive" });
        return;
      }
      setSelectedFile(file);
      uploadAndProcessFile(file); // Llama a la subida aquí
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-8rem)] bg-background">
      {/* Área de mensajes */}
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
      
      {/* Área de entrada */}
      <div className="mt-4 border-t pt-4">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <input type="file" ref={fileInputRef} onChange={handleFileSelection} className="hidden" id="file-upload" />
          <Button type="button" variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </Button>
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={selectedFile ? `Añade un comentario para "${selectedFile.name}"...` : "Escribe tu mensaje..."}
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
