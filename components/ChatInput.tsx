'use client';

import { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { useChat } from '@/contexts/ChatContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { 
  Send, 
  Paperclip, 
  Loader2, 
  Zap, 
  Globe, 
  FileText, 
  Image,
  AlertCircle,
  CheckCircle,
  Settings,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { cn } from '@/lib/utils';

interface MCPStatus {
  initialized: boolean;
  available_tools?: number;
}

export default function ChatInput() {
  const [input, setInput] = useState('');
  const [mcpStatus, setMcpStatus] = useState<MCPStatus | null>(null);
  const { sendMessage, isLoading, uploadFile } = useChat();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const supabase = createClient();

  // Obtener estado MCP
  useEffect(() => {
    const fetchMCPStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        const response = await fetch(`${apiUrl}/api/mcp/status`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        
        if (response.ok) {
          const status = await response.json();
          setMcpStatus(status);
        }
      } catch (error) {
        console.error('Error obteniendo estado MCP:', error);
      }
    };

    fetchMCPStatus();
  }, [supabase]);

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

  const quickActions = [
    {
      label: 'Buscar en Internet',
      icon: <Globe className="h-4 w-4" />,
      action: () => setInput("Busca información sobre "),
      description: 'Busca información actualizada'
    },
    {
      label: 'Analizar URL',
      icon: <Image className="h-4 w-4" />,
      action: () => setInput("Analiza el contenido de esta URL: "),
      description: 'Extrae texto de imágenes y PDFs'
    },
    {
      label: 'Buscar Documentos',
      icon: <FileText className="h-4 w-4" />,
      action: () => setInput("Busca en mis documentos información sobre "),
      description: 'Busca en tus documentos'
    },
    {
      label: 'Estadísticas MCP',
      icon: <Zap className="h-4 w-4" />,
      action: () => setInput("Obtén estadísticas del sistema"),
      description: 'Herramientas MCP disponibles',
      disabled: !mcpStatus?.initialized
    }
  ];

  return (
    <div className="border-t border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          {/* Barra de estado minimalista */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm text-muted-foreground font-medium">
                  AI Playground
                </span>
              </div>
              
              <div className="h-4 w-px bg-border" />
              
              <Badge 
                variant={mcpStatus?.initialized ? "default" : "secondary"}
                className="text-xs font-medium"
              >
                <Zap className="h-3 w-3 mr-1" />
                MCP {mcpStatus?.initialized ? "Activo" : "Inactivo"}
              </Badge>
              
              {mcpStatus?.available_tools && (
                <Badge variant="outline" className="text-xs">
                  {mcpStatus.available_tools} herramientas
                </Badge>
              )}
            </div>

            {/* Menú de herramientas */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Herramientas
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="font-semibold">
                  Acciones Rápidas
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {quickActions.map((action, index) => (
                  <DropdownMenuItem
                    key={index}
                    onClick={action.action}
                    disabled={action.disabled}
                    className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <div className={cn(
                        "flex-shrink-0",
                        action.disabled ? "text-muted-foreground" : "text-primary"
                      )}>
                        {action.icon}
                      </div>
                      <span className="font-medium">{action.label}</span>
                      {action.disabled && (
                        <AlertCircle className="h-3 w-3 text-destructive ml-auto" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {action.description}
                    </span>
                  </DropdownMenuItem>
                ))}
                
                <DropdownMenuSeparator />
                <DropdownMenuItem className="p-3">
                  <div className="flex items-center gap-2 w-full">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="font-medium">Ver todas las herramientas</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Input principal con diseño mejorado */}
          <Card className="shadow-lg border-0 bg-card/50 backdrop-blur">
            <CardContent className="p-0">
              <div className="flex gap-3 p-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="flex-shrink-0 h-10 w-10 rounded-full hover:bg-primary/10"
                >
                  <Paperclip className="h-5 w-5" />
                </Button>

                <div className="flex-1 relative">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Escribe tu mensaje aquí... Puedo buscar en internet, analizar URLs y más"
                    disabled={isLoading}
                    className="min-h-[60px] max-h-[200px] resize-none border-0 bg-transparent px-0 py-2 text-base focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/70"
                  />
                  
                  {/* Contador de caracteres */}
                  <div className="absolute bottom-2 right-2 text-xs text-muted-foreground/60">
                    {input.length}
                  </div>
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="flex-shrink-0 h-10 w-10 rounded-full disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sugerencias mejoradas */}
          {!isLoading && input.length === 0 && (
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {quickActions.filter(action => !action.disabled).slice(0, 3).map((suggestion, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={suggestion.action}
                  className="text-xs font-medium bg-background/50 hover:bg-background border-border/50 hover:border-border"
                >
                  {suggestion.icon}
                  <span className="ml-1">{suggestion.label}</span>
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}