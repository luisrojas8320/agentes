'use client';

import { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { useChat } from '@/contexts/ChatContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { 
  Send, 
  Paperclip, 
  Loader2, 
  Zap, 
  Globe, 
  FileText, 
  Image,
  AlertCircle,
  CheckCircle
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
  const [showTools, setShowTools] = useState(false);
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

  const availableTools = [
    {
      name: 'Búsqueda en Internet',
      icon: <Globe className="h-3 w-3" />,
      active: true,
      description: 'Busca información actualizada'
    },
    {
      name: 'Análisis de URLs',
      icon: <Image className="h-3 w-3" />,
      active: true,
      description: 'Extrae texto de imágenes y PDFs'
    },
    {
      name: 'Documentos Personales',
      icon: <FileText className="h-3 w-3" />,
      active: true,
      description: 'Busca en tus documentos subidos'
    },
    {
      name: 'Herramientas MCP',
      icon: <Zap className="h-3 w-3" />,
      active: mcpStatus?.initialized || false,
      description: `${mcpStatus?.available_tools || 0} herramientas disponibles`
    }
  ];

  return (
    <div className="border-t border-border bg-background">
      {/* Indicador de herramientas disponibles */}
      {showTools && (
        <div className="p-4 border-b border-border">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium">Herramientas Disponibles</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTools(false)}
                className="text-xs"
              >
                Ocultar
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {availableTools.map((tool, index) => (
                <Card key={index} className={cn(
                  "p-2 transition-colors",
                  tool.active ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"
                )}>
                  <div className="flex items-start gap-2">
                    <div className={cn(
                      "mt-0.5",
                      tool.active ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    )}>
                      {tool.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium truncate">{tool.name}</span>
                        {tool.active ? (
                          <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-red-600 dark:text-red-400 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {tool.description}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="p-4">
        <div className="max-w-3xl mx-auto">
          {/* Barra de estado superior */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Badge 
                variant={mcpStatus?.initialized ? "default" : "secondary"}
                className="text-xs"
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
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTools(!showTools)}
              className="text-xs"
            >
              {showTools ? 'Ocultar' : 'Ver'} herramientas
            </Button>
          </div>

          {/* Input principal */}
          <div className="flex gap-2">
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
              className="flex-shrink-0"
            >
              <Paperclip className="h-5 w-5" />
            </Button>

            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe un mensaje... (puedo buscar en internet, analizar URLs, revisar tus documentos y usar herramientas MCP)"
                disabled={isLoading}
                className="min-h-[60px] max-h-[200px] resize-none pr-12"
              />
              
              {/* Contador de caracteres */}
              <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                {input.length}
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="flex-shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>

          {/* Sugerencias rápidas */}
          {!isLoading && input.length === 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInput("Busca información sobre inteligencia artificial en 2024")}
                className="text-xs"
              >
                <Globe className="h-3 w-3 mr-1" />
                Buscar en internet
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInput("Analiza el contenido de esta URL: ")}
                className="text-xs"
              >
                <Image className="h-3 w-3 mr-1" />
                Analizar URL
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInput("Busca en mis documentos información sobre ")}
                className="text-xs"
              >
                <FileText className="h-3 w-3 mr-1" />
                Buscar documentos
              </Button>
              {mcpStatus?.initialized && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInput("Obtén estadísticas del sistema")}
                  className="text-xs"
                >
                  <Zap className="h-3 w-3 mr-1" />
                  Usar MCP
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}