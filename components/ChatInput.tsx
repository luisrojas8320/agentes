'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { useChat } from '@/contexts/ChatContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip } from 'lucide-react';

export default function ChatInput() {
  const [input, setInput] = useState('');
  const { sendMessage, isLoading, uploadFile } = useChat();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async () => {
    if (input.trim() && !isLoading) {
      await sendMessage(input);
      setInput('');
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadFile) {
      await uploadFile(file);
    }
  };

  return (
    <div className="border-t border-border/30 bg-background">
      <div className="max-w-4xl mx-auto p-6">
        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
          
          <div className="flex items-end gap-3 bg-muted/30 rounded-3xl p-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="btn-minimal h-10 w-10 rounded-full flex-shrink-0"
            >
              <Paperclip className="h-5 w-5" />
            </Button>

            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Introduce una petición para AI Playground"
              disabled={isLoading}
              className="input-minimal min-h-[52px] max-h-[200px] resize-none flex-1 text-base py-3"
              rows={1}
            />

            <Button
              onClick={handleSubmit}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="btn-minimal h-10 w-10 rounded-full flex-shrink-0 disabled:opacity-30"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}