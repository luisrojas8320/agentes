"use client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Menu, Link, Mic, Wand2, ScanSearch } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import ChatMessage from "@/components/ChatMessage";
import { useState, FormEvent } from "react";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const sendMessage = async (messageContent: string) => {
    if (isLoading || !messageContent.trim()) return;
    setIsLoading(true);
    const newUserMessage: Message = { id: Date.now().toString(), role: 'user', content: messageContent };
    const newMessages = [...messages, newUserMessage];
    setMessages(newMessages);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });
      if (!response.ok) { throw new Error(`Error en la solicitud: ${response.statusText}`); }
      const data = await response.json();
      const assistantMessage: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: data.response || "No se recibió respuesta." };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: "Error al conectar con el servidor de Python." };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    sendMessage(input);
    setInput('');
  };

  const handleSuggestionClick = (suggestion: string) => {
    const content = `Por favor, inicia la tarea de "${suggestion}".`;
    sendMessage(content);
  };

  return (
    <div className="flex h-screen bg-[#181818] text-white">
      <div className="hidden md:flex"><Sidebar /></div>
      <main className="flex-1 flex flex-col h-screen">
        <header className="md:hidden flex items-center justify-between p-4 border-b border-gray-700">
            <h1 className="text-lg font-semibold uppercase tracking-wider">Playground Agents</h1>
            <Button onClick={() => setIsSidebarOpen(!isSidebarOpen)} size="icon" variant="ghost"><Menu className="h-6 w-6" /></Button>
        </header>
        {isSidebarOpen && (<div className="md:hidden"><Sidebar /></div>)}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length > 0 ? (
            messages.map((m) => <ChatMessage key={m.id} message={m} />)
          ) : (
            <div className="flex h-full items-center justify-center text-center">
              <div>
                <h1 className="text-5xl font-bold">Hola Luis Rojas</h1>
                <p className="text-gray-400 text-xl mt-2">¿Qué puedo hacer por ti?</p>
              </div>
            </div>
          )}
        </div>
        <div className="p-4 md:p-8 border-t border-gray-700">
          <div className="w-full max-w-3xl mx-auto">
              <div className="flex items-center gap-4 mb-4 flex-wrap">
                <Button onClick={() => handleSuggestionClick("Crear")} variant="secondary" className="bg-[#222222] hover:bg-[#2a2a2a]"><Wand2 className="mr-2 h-4 w-4" /> Crear</Button>
                <Button onClick={() => handleSuggestionClick("Analizar")} variant="secondary" className="bg-[#222222] hover:bg-[#2a2a2a]"><ScanSearch className="mr-2 h-4 w-4" /> Analizar</Button>
                <Button onClick={() => handleSuggestionClick("Investigación")} variant="secondary" className="bg-[#222222] hover:bg-[#2a2a2a]">Investigación</Button>
              </div>
              <form onSubmit={handleSubmit} className="w-full bg-[#111111] border border-gray-700 rounded-lg p-4">
                <Textarea
                  className="bg-transparent border-0 text-base resize-none focus:ring-0 focus-visible:ring-offset-0 focus-visible:ring-0"
                  placeholder="O asigna una tarea más detallada aquí..."
                  rows={4} value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as any); } }}
                />
                <div className="flex justify-between items-center mt-4">
                  <div className="flex items-center gap-4"><Button type="button" variant="ghost" size="icon" className="text-gray-400 hover:text-white"><Link className="h-5 w-5" /></Button></div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">816 + 300</span>
                    <Button type="button" variant="ghost" size="icon" className="text-gray-400 hover:text-white"><Mic className="h-5 w-5" /></Button>
                    <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">{isLoading ? 'Pensando...' : 'Enviar'}</Button>
                  </div>
                </div>
              </form>
          </div>
        </div>
      </main>
    </div>
  );
}