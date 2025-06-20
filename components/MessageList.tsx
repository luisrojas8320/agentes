'use client';

import { useRef, useEffect, useState } from 'react';
import { useChat } from '@/contexts/ChatContext';
import ChatMessage from '@/components/ChatMessage';
import TypingAnimation from '@/components/TypingAnimation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { 
  Sparkles, 
  Globe, 
  FileText, 
  Image, 
  Zap, 
  Database,
  Users,
  Brain,
  Settings
} from 'lucide-react';
import ToolConfigModal from '@/components/ToolConfigModal';

export default function MessageList() {
  const { messages, isLoading } = useChat();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [showWelcome, setShowWelcome] = useState(true);

  useEffect(() => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  useEffect(() => {
    if (messages.length > 0) {
      setShowWelcome(false);
    }
  }, [messages]);

  // Verificar si hay un mensaje siendo streaming
  const isAnyMessageStreaming = messages.some(m => m.isStreaming && !m.isComplete);

  const suggestedPrompts = [
    {
      icon: <Globe className="h-4 w-4" />,
      title: "Búsqueda en Internet",
      description: "Busca las últimas noticias sobre inteligencia artificial",
      prompt: "Busca las últimas noticias y avances en inteligencia artificial de esta semana"
    },
    {
      icon: <Image className="h-4 w-4" />,
      title: "Análisis de Imagen",
      description: "Analiza el contenido de una imagen desde una URL",
      prompt: "Analiza el contenido de esta imagen: [pega aquí la URL de tu imagen]"
    },
    {
      icon: <FileText className="h-4 w-4" />,
      title: "Documentos Personales",
      description: "Busca información en tus documentos subidos",
      prompt: "Busca en mis documentos información sobre [tema que te interese]"
    },
    {
      icon: <Database className="h-4 w-4" />,
      title: "Estadísticas del Sistema",
      description: "Obtén información sobre el estado de la plataforma",
      prompt: "Obtén estadísticas del sistema y herramientas disponibles"
    }
  ];

  const capabilities = [
    {
      icon: <Brain className="h-5 w-5 text-blue-500" />,
      title: "IA Avanzada",
      description: "Modelos GPT-4 y Gemini para conversaciones inteligentes"
    },
    {
      icon: <Globe className="h-5 w-5 text-green-500" />,
      title: "Búsqueda Web",
      description: "Acceso a información actualizada de internet"
    },
    {
      icon: <FileText className="h-5 w-5 text-purple-500" />,
      title: "RAG Personalizado",
      description: "Búsqueda semántica en tus documentos personales"
    },
    {
      icon: <Zap className="h-5 w-5 text-yellow-500" />,
      title: "Protocolo MCP",
      description: "Herramientas externas y extensibilidad avanzada"
    }
  ];

  return (
    <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4">
      <div className="max-w-3xl mx-auto">
        {showWelcome && messages.length === 0 ? (
          // Pantalla de bienvenida mejorada
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8">
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-2">
                <Sparkles className="h-8 w-8 text-primary" />
                <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                  AI Playground
                </h1>
              </div>
              <p className="text-xl text-muted-foreground max-w-2xl">
                Tu asistente inteligente con capacidades avanzadas de búsqueda, análisis y procesamiento
              </p>
            </div>

            {/* Capacidades del sistema */}
            <div className="w-full max-w-4xl">
              <h3 className="text-lg font-semibold mb-4">¿Qué puedo hacer por ti?</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {capabilities.map((capability, index) => (
                  <Card key={index} className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex flex-col items-center text-center space-y-2">
                      {capability.icon}
                      <h4 className="font-medium">{capability.title}</h4>
                      <p className="text-sm text-muted-foreground">{capability.description}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Prompts sugeridos */}
            <div className="w-full max-w-4xl space-y-4">
              <h3 className="text-lg font-semibold">Prueba estos comandos:</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {suggestedPrompts.map((suggestion, index) => (
                  <Card key={index} className="p-4 hover:shadow-md transition-all hover:border-primary/50 cursor-pointer group">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                        {suggestion.icon}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium mb-1">{suggestion.title}</h4>
                        <p className="text-sm text-muted-foreground mb-2">{suggestion.description}</p>
                        <Badge variant="outline" className="text-xs">
                          Clic para usar
                        </Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Botón de configuración */}
            <div className="flex items-center space-x-4">
              <ToolConfigModal 
                trigger={
                  <Button variant="outline" className="flex items-center space-x-2">
                    <Settings className="h-4 w-4" />
                    <span>Ver Herramientas Disponibles</span>
                  </Button>
                }
              />
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>Listo para ayudarte</span>
              </div>
            </div>
          </div>
        ) : (
          // Lista de mensajes normal
          <div className="space-y-4">
            {messages.map((message) => (
              <ChatMessage 
                key={message.id} 
                message={message}
                isStreaming={message.isStreaming}
                isComplete={message.isComplete}
              />
            ))}
            
            {/* Mostrar animación de pensando solo si está cargando y no hay streaming */}
            {isLoading && !isAnyMessageStreaming && (
              <TypingAnimation />
            )}
          </div>
        )}
      </div>
    </div>
  );
}