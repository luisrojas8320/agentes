'use client';

import { useRef, useEffect, useState } from 'react';
import { useChat } from '@/contexts/ChatContext';
import ChatMessage from '@/components/ChatMessage';
import TypingAnimation from '@/components/TypingAnimation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Sparkles, 
  Globe, 
  FileText, 
  Image, 
  Zap, 
  Database,
  Users,
  Brain,
  Settings,
  ArrowRight,
  Star
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
      icon: <Globe className="h-5 w-5" />,
      title: "Búsqueda Web",
      description: "Encuentra las últimas noticias sobre inteligencia artificial",
      prompt: "Busca las últimas noticias y avances en inteligencia artificial de esta semana",
      gradient: "from-blue-500 to-cyan-500"
    },
    {
      icon: <Image className="h-5 w-5" />,
      title: "Análisis de Contenido",
      description: "Analiza imágenes, PDFs o URLs con OCR avanzado",
      prompt: "Analiza el contenido de esta imagen: [pega aquí la URL de tu imagen]",
      gradient: "from-purple-500 to-pink-500"
    },
    {
      icon: <FileText className="h-5 w-5" />,
      title: "Documentos Personales",
      description: "Búsqueda semántica en tus documentos subidos",
      prompt: "Busca en mis documentos información sobre [tema que te interese]",
      gradient: "from-green-500 to-emerald-500"
    },
    {
      icon: <Database className="h-5 w-5" />,
      title: "Sistema y MCP",
      description: "Estadísticas y herramientas de la plataforma",
      prompt: "Obtén estadísticas del sistema y herramientas MCP disponibles",
      gradient: "from-orange-500 to-red-500"
    }
  ];

  const capabilities = [
    {
      icon: <Brain className="h-6 w-6 text-blue-400" />,
      title: "IA Avanzada",
      description: "GPT-4 y Gemini para conversaciones inteligentes"
    },
    {
      icon: <Globe className="h-6 w-6 text-green-400" />,
      title: "Web Search",
      description: "Información actualizada de internet en tiempo real"
    },
    {
      icon: <FileText className="h-6 w-6 text-purple-400" />,
      title: "RAG Inteligente",
      description: "Búsqueda semántica avanzada en documentos"
    },
    {
      icon: <Zap className="h-6 w-6 text-yellow-400" />,
      title: "Protocolo MCP",
      description: "Extensibilidad con herramientas externas"
    }
  ];

  const handlePromptClick = (prompt: string) => {
    // Simular click en input
    const event = new CustomEvent('setInputValue', { detail: prompt });
    window.dispatchEvent(event);
  };

  return (
    <div ref={chatContainerRef} className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {showWelcome && messages.length === 0 ? (
          // Pantalla de bienvenida renovada
          <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-8 animate-fade-in-up">
            {/* Header principal */}
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-primary/20 animate-pulse-slow" />
                </div>
                <div className="relative flex items-center justify-center space-x-3">
                  <div className="p-3 rounded-full bg-gradient-to-br from-primary to-blue-600 shadow-lg">
                    <Sparkles className="h-8 w-8 text-white" />
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <h1 className="text-5xl font-normal bg-gradient-to-r from-foreground via-primary to-blue-600 bg-clip-text text-transparent">
                  AI Playground
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl font-light">
                  Tu asistente inteligente con capacidades avanzadas de búsqueda, análisis y procesamiento
                </p>
              </div>
            </div>

            {/* Capacidades del sistema */}
            <div className="w-full max-w-5xl">
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {capabilities.map((capability, index) => (
                  <Card key={index} className="group hover-lift bg-card/30 backdrop-blur border-border/50 hover:border-primary/30 transition-all duration-300">
                    <CardContent className="p-6">
                      <div className="flex flex-col items-center text-center space-y-3">
                        <div className="p-3 rounded-full bg-background/50 group-hover:scale-110 transition-transform duration-300">
                          {capability.icon}
                        </div>
                        <h4 className="font-medium text-lg">{capability.title}</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {capability.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Prompts sugeridos mejorados */}
            <div className="w-full max-w-6xl space-y-6">
              <div className="flex items-center justify-center gap-2">
                <Star className="h-5 w-5 text-primary" />
                <h3 className="text-2xl font-medium">Prueba estos comandos</h3>
                <Star className="h-5 w-5 text-primary" />
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                {suggestedPrompts.map((suggestion, index) => (
                  <Card 
                    key={index} 
                    className="group cursor-pointer hover-lift bg-card/40 backdrop-blur border-border/50 hover:border-primary/50 transition-all duration-300 overflow-hidden"
                    onClick={() => handlePromptClick(suggestion.prompt)}
                  >
                    <CardContent className="p-0">
                      <div className="relative">
                        {/* Gradient background */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${suggestion.gradient} opacity-10 group-hover:opacity-20 transition-opacity duration-300`} />
                        
                        <div className="relative p-6">
                          <div className="flex items-start space-x-4">
                            <div className={`flex-shrink-0 p-3 rounded-xl bg-gradient-to-br ${suggestion.gradient} text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                              {suggestion.icon}
                            </div>
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-lg">{suggestion.title}</h4>
                                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
                              </div>
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                {suggestion.description}
                              </p>
                              <Badge variant="outline" className="text-xs font-medium bg-background/50">
                                Clic para usar
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Botón de configuración mejorado */}
            <div className="flex flex-col items-center space-y-4">
              <ToolConfigModal 
                trigger={
                  <Button variant="outline" size="lg" className="group bg-background/50 hover:bg-background border-border/50 hover:border-primary/50 transition-all duration-300">
                    <Settings className="h-5 w-5 mr-2 group-hover:rotate-90 transition-transform duration-300" />
                    <span className="font-medium">Explorar Herramientas</span>
                  </Button>
                }
              />
              
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <Users className="h-4 w-4" />
                <span className="font-medium">Sistema listo • Todas las herramientas activas</span>
              </div>
            </div>
          </div>
        ) : (
          // Lista de mensajes normal
          <div className="space-y-6">
            {messages.map((message) => (
              <div key={message.id} className="animate-slide-in-bottom">
                <ChatMessage 
                  message={message}
                  isStreaming={message.isStreaming}
                  isComplete={message.isComplete}
                />
              </div>
            ))}
            
            {/* Mostrar animación de pensando solo si está cargando y no hay streaming */}
            {isLoading && !isAnyMessageStreaming && (
              <div className="animate-slide-in-bottom">
                <TypingAnimation />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}