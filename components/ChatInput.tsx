// Ruta: components/ChatInput.tsx
'use client';
import { useState, FormEvent } from 'react';
import { useChat } from '@/contexts/ChatContext'; // <-- Conecta al contexto
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Link, Wand2, ScanSearch, Send } from 'lucide-react';

export const ChatInput = () => {
  const [input, setInput] = useState(''); // El estado del input es local
  const { isLoading, sendMessage } = useChat(); // <-- Obtiene la lógica del contexto

  // Las funciones handler se mueven aquí
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage(input);
    setInput('');
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(`Inicia la tarea de "${suggestion}".`);
  };

  return (
    // <-- Este es el JSX del formulario que cortaste de page.tsx
    <div className="p-4 border-t border-gray-700 bg-[#181818]">
      <div className="w-full max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Button onClick={() => handleSuggestionClick("Crear")} variant="secondary" className="bg-[#222222] hover:bg-[#2a2a2a]"><Wand2 className="mr-2 h-4 w-4" /> Crear</Button>
          <Button onClick={() => handleSuggestionClick("Analizar")} variant="secondary" className="bg-[#222222] hover:bg-[#2a2a2a]"><ScanSearch className="mr-2 h-4 w-4" /> Analizar</Button>
          <Button onClick={() => handleSuggestionClick("Investigación")} variant="secondary" className="bg-[#222222] hover:bg-[#2a2a2a]">Investigación</Button>
        </div>
        <form onSubmit={handleSubmit} className="relative w-full">
          <Textarea
            className="bg-[#2a2a2a] border-gray-600 text-base resize-none focus:ring-0 focus-visible:ring-offset-0 focus-visible:ring-0 pr-20"
            placeholder="Asigna una tarea o haz una pregunta..."
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
            disabled={isLoading}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
             <Button type="submit" size="icon" disabled={isLoading || !input.trim()} className="bg-blue-600 hover:bg-blue-700">
                {isLoading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Send className="h-4 w-4" />}
             </Button>
          </div>
        </form>
      </div>
    </div>
  );
};