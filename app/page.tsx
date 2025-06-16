"use client";

import { useChat } from "ai/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Code, Link, Mic, Play, ScanSearch, Wand2 } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import ChatMessage from "@/components/ChatMessage";

export default function HomePage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/orchestrator", // Apunta a nuestro nuevo endpoint
  });

  return (
    <div className="flex h-screen bg-[#181818] text-white">
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen">
        {/* Área de la conversación */}
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

        {/* Área del input */}
        <div className="p-4 md:p-8 border-t border-gray-700">
          <div className="w-full max-w-3xl mx-auto">
             <div className="flex items-center gap-4 mb-4">
                <Button variant="secondary" className="bg-[#222222] hover:bg-[#2a2a2a]">
                  <Wand2 className="mr-2 h-4 w-4" /> Crear
                </Button>
                <Button variant="secondary" className="bg-[#222222] hover:bg-[#2a2a2a]">
                  <ScanSearch className="mr-2 h-4 w-4" /> Analizar
                </Button>
                <Button variant="secondary" className="bg-[#222222] hover:bg-[#2a2a2a]">
                  Investigación
                </Button>
             </div>
             <form onSubmit={handleSubmit} className="w-full bg-[#111111] border border-gray-700 rounded-lg p-4">
                <Textarea
                  className="bg-transparent border-0 text-base resize-none focus:ring-0 focus-visible:ring-offset-0 focus-visible:ring-0"
                  placeholder="Asigna una tarea o pregunta cualquier cosa"
                  rows={4}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e as any);
                    }
                  }}
                />
                <div className="flex justify-between items-center mt-4">
                  <div className="flex items-center gap-4">
                    <Button type="button" variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                      <Link className="h-5 w-5" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">816 + 300</span>
                    <Button type="button" variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                      <Mic className="h-5 w-5" />
                    </Button>
                    <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
                      {isLoading ? 'Pensando...' : 'Crear'}
                    </Button>
                  </div>
                </div>
             </form>
          </div>
        </div>
      </main>
    </div>
  );
}