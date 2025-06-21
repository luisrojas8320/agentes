'use client';

import { useChat } from '@/contexts/ChatContext';
import { Button } from '@/components/ui/button';
import { PlusCircle, MessageSquare, LogOut, Trash2, Settings, Zap, AlertCircle, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import ToolConfigModal from '@/components/ToolConfigModal';

interface MCPStatus {
  initialized: boolean;
  connected_servers: string[];
  server_count: number;
  available_tools?: number;
  available_resources?: number;
}

export default function Sidebar() {
  const { chats, activeThreadId, startNewChat, loadChat, isLoading, deleteChat } = useChat();
  const { signOut } = useAuth();
  const [mcpStatus, setMcpStatus] = useState<MCPStatus | null>(null);
  const [loadingMCP, setLoadingMCP] = useState(true);
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
      } finally {
        setLoadingMCP(false);
      }
    };

    fetchMCPStatus();
  }, [supabase]);

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Eliminar de la base de datos
      const { error } = await supabase
        .from('chats')
        .delete()
        .eq('id', chatId)
        .eq('user_id', session.user.id);

      if (error) throw error;

      // Actualizar estado local
      deleteChat(chatId);

      // Si era el chat activo, iniciar uno nuevo
      if (activeThreadId === chatId) {
        startNewChat();
      }
    } catch (error) {
      console.error('Error eliminando chat:', error);
    }
  };

  return (
    <div className="w-64 bg-card/30 backdrop-blur border-r border-border/50 flex flex-col h-full">
      {/* Header con logo mejorado */}
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-blue-600 shadow-md">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">AI Playground</h2>
            <p className="text-xs text-muted-foreground">Powered by MCP</p>
          </div>
        </div>
        
        {/* Estado MCP mejorado */}
        <div className="p-3 rounded-lg bg-muted/30 backdrop-blur space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Zap className="h-4 w-4" />
            <span className="font-medium">Sistema</span>
            <div className="ml-auto">
              {loadingMCP ? (
                <div className="h-2 w-2 rounded-full bg-muted-foreground animate-pulse" />
              ) : (
                <div className={cn(
                  "h-2 w-2 rounded-full animate-pulse",
                  mcpStatus?.initialized ? "bg-green-500" : "bg-red-500"
                )} />
              )}
            </div>
          </div>
          
          {loadingMCP ? (
            <div className="text-xs text-muted-foreground">Cargando estado...</div>
          ) : mcpStatus ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span>MCP:</span>
                <Badge 
                  variant={mcpStatus.initialized ? "default" : "destructive"}
                  className="text-[10px] px-1.5 py-0.5"
                >
                  {mcpStatus.initialized ? "Activo" : "Inactivo"}
                </Badge>
              </div>
              
              {mcpStatus.server_count > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span>Servidores:</span>
                  <span className="text-muted-foreground">{mcpStatus.server_count}</span>
                </div>
              )}
              
              {mcpStatus.available_tools && (
                <div className="flex items-center justify-between text-xs">
                  <span>Herramientas:</span>
                  <span className="text-muted-foreground">{mcpStatus.available_tools}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              <span>Error de conexión</span>
            </div>
          )}
        </div>
      </div>

      {/* Botón nuevo chat */}
      <div className="p-4">
        <Button 
          onClick={startNewChat} 
          className="w-full btn-gradient shadow-md hover:shadow-lg" 
          disabled={isLoading}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Nueva Conversación
        </Button>
      </div>
      
      <Separator className="mx-4" />
      
      {/* Lista de chats con scroll mejorado */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        <div className="space-y-1">
          {chats.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
              <div className="text-sm text-muted-foreground">
                No hay conversaciones aún
              </div>
              <div className="text-xs text-muted-foreground/70">
                Inicia una nueva conversación
              </div>
            </div>
          ) : (
            chats.map((chat) => (
              <div 
                key={chat.id}
                className={cn(
                  'group relative flex items-center rounded-lg transition-all duration-200 hover:bg-muted/30',
                  activeThreadId === chat.id && 'bg-primary/10 border border-primary/20'
                )}
              >
                <Button
                  variant="ghost"
                  onClick={() => loadChat(chat.id)}
                  disabled={isLoading}
                  className={cn(
                    'flex-1 justify-start text-left h-auto py-3 px-3 font-normal hover:bg-transparent',
                    activeThreadId === chat.id && 'text-primary font-medium'
                  )}
                >
                  <MessageSquare className="mr-3 h-4 w-4 flex-shrink-0 opacity-70" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm">
                      {chat.title || 'Chat sin título'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {new Date(chat.created_at).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short'
                      })}
                    </div>
                  </div>
                </Button>
                
                {/* Botón de eliminar mejorado */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 mr-2 hover:bg-destructive/20 hover:text-destructive"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-card/95 backdrop-blur border-border/50">
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar conversación?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción no se puede deshacer. Se eliminará permanentemente 
                        la conversación y todos sus mensajes.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={(e) => handleDeleteChat(chat.id, e)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))
          )}
        </div>
      </div>

      <Separator className="mx-4" />

      {/* Footer con botones de acción mejorados */}
      <div className="p-4 space-y-2">
        <ToolConfigModal 
          trigger={
            <Button variant="ghost" className="w-full justify-start hover:bg-muted/30">
              <Settings className="mr-2 h-4 w-4" />
              Configuración
            </Button>
          }
        />

        <Button
          variant="ghost"
          onClick={signOut}
          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar Sesión
        </Button>
      </div>
    </div>
  );
}