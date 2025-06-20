'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, 
  Zap, 
  Globe, 
  FileText, 
  Image, 
  Database,
  Server,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

interface MCPTool {
  name: string;
  server: string;
  description: string;
}

interface MCPStatus {
  initialized: boolean;
  connected_servers: string[];
  server_count: number;
  available_tools?: number;
  available_resources?: number;
  tools?: MCPTool[];
  resources?: any[];
}

interface ToolConfigModalProps {
  trigger?: React.ReactNode;
}

export default function ToolConfigModal({ trigger }: ToolConfigModalProps) {
  const [open, setOpen] = useState(false);
  const [mcpStatus, setMcpStatus] = useState<MCPStatus | null>(null);
  const [mcpTools, setMcpTools] = useState<MCPTool[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const fetchMCPStatus = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      const statusResponse = await fetch(`${apiUrl}/api/mcp/status`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      
      if (statusResponse.ok) {
        const status = await statusResponse.json();
        setMcpStatus(status);
      }

      const toolsResponse = await fetch(`${apiUrl}/api/mcp/tools`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      
      if (toolsResponse.ok) {
        const toolsData = await toolsResponse.json();
        setMcpTools(toolsData.tools || []);
      }

    } catch (error) {
      console.error('Error obteniendo estado MCP:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchMCPStatus();
    }
  }, [open]);

  const DefaultTrigger = (
    <Button variant="ghost" className="w-full justify-start">
      <Settings className="mr-2 h-4 w-4" />
      Configuración
    </Button>
  );

  const getToolIcon = (toolName: string) => {
    if (toolName.includes('search') || toolName.includes('internet')) {
      return <Globe className="h-4 w-4" />;
    }
    if (toolName.includes('document') || toolName.includes('file')) {
      return <FileText className="h-4 w-4" />;
    }
    if (toolName.includes('image') || toolName.includes('url')) {
      return <Image className="h-4 w-4" />;
    }
    if (toolName.includes('database') || toolName.includes('stats')) {
      return <Database className="h-4 w-4" />;
    }
    return <Zap className="h-4 w-4" />;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || DefaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuración de Herramientas
          </DialogTitle>
          <DialogDescription>
            Gestiona las herramientas MCP y el estado del sistema.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="mcp" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="mcp">MCP Status</TabsTrigger>
            <TabsTrigger value="tools">Herramientas</TabsTrigger>
            <TabsTrigger value="system">Sistema</TabsTrigger>
          </TabsList>

          <TabsContent value="mcp" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Estado del Protocolo MCP</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchMCPStatus}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Actualizar
              </Button>
            </div>

            {mcpStatus ? (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {mcpStatus.initialized ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-500" />
                      )}
                      Estado de Conexión
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span>Estado MCP:</span>
                      <Badge variant={mcpStatus.initialized ? "default" : "destructive"}>
                        {mcpStatus.initialized ? "Inicializado" : "No disponible"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Servidores conectados:</span>
                      <Badge variant="outline">{mcpStatus.server_count}</Badge>
                    </div>
                    {mcpStatus.available_tools && (
                      <div className="flex items-center justify-between">
                        <span>Herramientas disponibles:</span>
                        <Badge variant="outline">{mcpStatus.available_tools}</Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {mcpStatus.connected_servers.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Server className="h-5 w-5" />
                        Servidores Conectados
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {mcpStatus.connected_servers.map((server, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="font-mono text-sm">{server}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center py-8">
                  <div className="text-center space-y-2">
                    <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
                    <p className="text-muted-foreground">No se pudo obtener el estado MCP</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="tools" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Herramientas Disponibles</h3>
              <Badge variant="outline">{mcpTools.length} herramientas</Badge>
            </div>

            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">Herramientas del Sistema</h4>
                  
                  <Card>
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <Globe className="h-4 w-4 mt-0.5 text-blue-500" />
                        <div className="flex-1">
                          <h5 className="font-medium text-sm">Búsqueda en Internet</h5>
                          <p className="text-xs text-muted-foreground">
                            Busca información actualizada en internet usando Jina AI
                          </p>
                          <Badge variant="outline" className="mt-1 text-xs">Activa</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <Image className="h-4 w-4 mt-0.5 text-green-500" />
                        <div className="flex-1">
                          <h5 className="font-medium text-sm">Análisis de URLs</h5>
                          <p className="text-xs text-muted-foreground">
                            Analiza contenido de URLs usando OCR para extraer texto
                          </p>
                          <Badge variant="outline" className="mt-1 text-xs">Activa</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <FileText className="h-4 w-4 mt-0.5 text-purple-500" />
                        <div className="flex-1">
                          <h5 className="font-medium text-sm">Búsqueda en Documentos</h5>
                          <p className="text-xs text-muted-foreground">
                            Busca información en documentos personales usando RAG
                          </p>
                          <Badge variant="outline" className="mt-1 text-xs">Activa</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {mcpTools.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm text-muted-foreground">Herramientas MCP</h4>
                      {mcpTools.map((tool, index) => (
                        <Card key={index}>
                          <CardContent className="p-3">
                            <div className="flex items-start gap-3">
                              {getToolIcon(tool.name)}
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h5 className="font-medium text-sm">{tool.name}</h5>
                                  <Badge variant="secondary" className="text-xs">
                                    {tool.server}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {tool.description || 'Sin descripción'}
                                </p>
                                <Badge variant="outline" className="mt-1 text-xs">MCP</Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                )}

                {mcpTools.length === 0 && mcpStatus && !mcpStatus.initialized && (
                  <Card>
                    <CardContent className="flex items-center justify-center py-8">
                      <div className="text-center space-y-2">
                        <Zap className="h-8 w-8 text-muted-foreground mx-auto" />
                        <p className="text-muted-foreground">
                          No hay herramientas MCP disponibles
                        </p>
                        <p className="text-xs text-muted-foreground">
                          El protocolo MCP no está inicializado
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="system" className="space-y-4">
            <h3 className="text-lg font-medium">Información del Sistema</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Backend</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Estado:</span>
                    <Badge variant="default">Conectado</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>API URL:</span>
                    <span className="text-xs font-mono bg-muted px-1 rounded">
                      {process.env.NEXT_PUBLIC_API_URL?.replace('https://', '') || 'No configurada'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Base de Datos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Supabase:</span>
                    <Badge variant="default">Conectado</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Autenticación:</span>
                    <Badge variant="default">Activa</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Capacidades Actuales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <h5 className="font-medium">Funciones Principales</h5>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      <li>✅ Chat con streaming</li>
                      <li>✅ Subida de documentos PDF</li>
                      <li>✅ Búsqueda RAG</li>
                      <li>✅ Herramientas externas</li>
                      <li>✅ Gestión de conversaciones</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h5 className="font-medium">Integraciones</h5>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      <li>✅ OpenAI GPT-4</li>
                      <li>✅ Google Gemini</li>
                      <li>✅ Jina AI Search</li>
                      <li>✅ OCR.space</li>
                      <li>{mcpStatus?.initialized ? '✅' : '❌'} Protocolo MCP</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Variables de Entorno</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span>NEXT_PUBLIC_API_URL:</span>
                    <Badge variant={process.env.NEXT_PUBLIC_API_URL ? "default" : "destructive"}>
                      {process.env.NEXT_PUBLIC_API_URL ? "Configurada" : "Faltante"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>NEXT_PUBLIC_SUPABASE_URL:</span>
                    <Badge variant={process.env.NEXT_PUBLIC_SUPABASE_URL ? "default" : "destructive"}>
                      {process.env.NEXT_PUBLIC_SUPABASE_URL ? "Configurada" : "Faltante"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>NEXT_PUBLIC_SUPABASE_ANON_KEY:</span>
                    <Badge variant={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "default" : "destructive"}>
                      {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "Configurada" : "Faltante"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}