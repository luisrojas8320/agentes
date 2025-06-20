'use client';
import { useState, FormEvent, useRef, ChangeEvent } from 'react';
import { useChat } from '@/contexts/ChatContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Paperclip, Wand2, ScanSearch, Send } from 'lucide-react';

export const ChatInput = () => {
  const [input, setInput] = useState('');
  const { isLoading, sendMessage, uploadFile } = useChat();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-4 border-t border-gray-700 bg-[#181818]">
      <div className="w-full max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Button onClick={() => sendMessage("Inicia la tarea de Crear.")} variant="secondary" className="bg-[#222222] hover:bg-[#2a2a2a]"><Wand2 className="mr-2 h-4 w-4" /> Crear</Button>
          <Button onClick={() => sendMessage("Inicia la tarea de Analizar.")} variant="secondary" className="bg-[#222222] hover:bg-[#2a2a2a]"><ScanSearch className="mr-2 h-4 w-4" /> Analizar</Button>
          <Button onClick={() => sendMessage("Inicia la tarea de Investigación.")} variant="secondary" className="bg-[#222222] hover:bg-[#2a2a2a]">Investigación</Button>
        </div>
        <form onSubmit={handleSubmit} className="relative w-full">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="application/pdf" disabled={isLoading} />
          <Textarea
            className="bg-[#2a2a2a] border-gray-600 text-base resize-none focus:ring-0 focus-visible:ring-offset-0 focus-visible:ring-0 pl-12 pr-20"
            placeholder="Asigna una tarea, haz una pregunta o sube un archivo..."
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
            disabled={isLoading} />
          <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center">
            <Button type="button" size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="hover:bg-gray-700">
              <Paperclip className="h-5 w-5" />
            </Button>
          </div>
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