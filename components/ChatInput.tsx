// ================================
// 2. ARREGLAR ChatInput.tsx - Placeholder y Espaciado
// ================================

'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { useChat } from '@/contexts/ChatContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip } from 'lucide-react';
import ToolsMenu from '@/components/ToolsMenu';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export default function ChatInput() {
  const [input, setInput] = useState('');
  const { sendMessage, isLoading, uploadFile } = useChat();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();

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

  const handleToolSelect = (toolText: string) => {
    setInput(toolText);
    textareaRef.current?.focus();
  };

  // ARREGLO: Placeholder más corto para mobile
  const getPlaceholder = () => {
    if (isMobile) {
      return "Escribe tu pregunta...";
    }
    return "Introduce una petición para AI Playground";
  };

  return (
    <div className="border-t border-border/30 bg-background">
      <div className={cn(
        "mx-auto",
        // ARREGLO: Menos padding en mobile
        isMobile ? "max-w-full p-4" : "max-w-4xl p-6"
      )}>
        {/* ARREGLO: Barra superior más compacta en mobile */}
        <div className={cn(
          "flex items-center justify-between",
          isMobile ? "mb-3" : "mb-4"
        )}>
          <div className="flex items-center gap-2">
            {/* ARREGLO: Ocultar texto "AI Playground" en mobile muy pequeño */}
            <span className={cn(
              "text-foreground/60",
              isMobile ? "text-xs hidden xs:block" : "text-xs"
            )}>
              AI Playground
            </span>
          </div>
          
          <ToolsMenu onToolSelect={handleToolSelect} />
        </div>

        {/* ARREGLO: Input optimizado para mobile */}
        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
          
          <div className={cn(
            "flex items-end bg-muted/30 rounded-3xl",
            // ARREGLO: Padding más pequeño en mobile
            isMobile ? "gap-2 p-2" : "gap-3 p-2"
          )}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className={cn(
                "flex-shrink-0 rounded-full text-foreground/60 hover:text-foreground hover:bg-muted/50",
                // ARREGLO: Botón más pequeño en mobile
                isMobile ? "h-8 w-8 mobile-button" : "h-10 w-10"
              )}
            >
              <Paperclip className={isMobile ? "h-3.5 w-3.5" : "h-5 w-5"} />
            </Button>

            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={getPlaceholder()} // ARREGLO: Placeholder dinámico
              disabled={isLoading}
              className={cn(
                "input-minimal resize-none flex-1 text-foreground placeholder:text-foreground/50 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0",
                isMobile 
                  ? "min-h-[44px] max-h-[100px] py-2.5 px-3 text-base mobile-input leading-relaxed" 
                  : "min-h-[52px] max-h-[200px] py-3 text-base"
              )}
              rows={1}
              style={{
                resize: 'none',
                lineHeight: isMobile ? '1.4' : '1.4'
              }}
            />

            <Button
              onClick={handleSubmit}
              disabled={!input.trim() || isLoading}
              size="icon"
              className={cn(
                "flex-shrink-0 rounded-full disabled:opacity-30 text-foreground/60 hover:text-foreground hover:bg-muted/50",
                // ARREGLO: Botón más pequeño en mobile
                isMobile ? "h-8 w-8 mobile-button" : "h-10 w-10"
              )}
              variant="ghost"
            >
              <Send className={isMobile ? "h-3.5 w-3.5" : "h-5 w-5"} />
            </Button>
          </div>
          
          {/* ARREGLO: Indicador de carga más sutil en mobile */}
          {isLoading && isMobile && (
            <div className="absolute top-full left-0 right-0 flex justify-center pt-1">
              <div className="text-xs text-foreground/50 animate-pulse">
                •••
              </div>
            </div>
          )}
        </div>

        {/* ARREGLO: Información más corta y solo cuando es necesario */}
        {isMobile && !input && (
          <div className="mt-2 text-center">
            <span className="text-xs text-foreground/40">
              Enter para enviar
            </span>
          </div>
        )}
      </div>
    </div>
  );
}