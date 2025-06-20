'use client';

import { useChat } from '@/contexts/ChatContext';
import { Button } from '@/components/ui/button';
import { PlusCircle, MessageSquare, LogOut, Trash2, Settings, Zap, AlertCircle } from 'lucide-react';
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
    <div className="w-64 bg-secondary/30 border-r border-border p-4 flex flex-col h-full">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">AI Playground</h2>
        
        {/* Estado MCP */}
        <div className="mb-3 p-2 rounded-md bg-muted/50">
          <div className="flex items-center gap-2 text-xs">
            <Zap className="h-3 w-3" />
            <span className="font-medium">MCP Status</span>
          </div>
          {loadingMCP ? (
            <div className="text-xs text-muted-foreground mt-1">Cargando...</div>
          ) : mcpStatus ? (
            <div className="mt-1 space-y-1">
              <div className="flex items-center gap-2">
                <Badge 
                  variant={mcpStatus.initialized ? "default" : "destructive"}
                  className="text-xs px-1 py-0"
                >
                  {mcpStatus.initialized ? "Activo" : "Inactivo"}
                </Badge>
                {mcpStatus.server_count > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {mcpStatus.server_count} servidor{mcpStatus.server_count !== 1 ? 'es' : ''}
                  </span>
                )}
              </div>
              {mcpStatus.available_tools && (
                <div className="text-xs text-muted-foreground">
                  {mcpStatus.available_tools} herramientas disponibles
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1 mt-1">
              <AlertCircle className="h-3 w-3 text-destructive" />
              <span className="text-xs text-destructive">Error de conexión</span>
            </div>
          )}
        </div>
      </div>

      <Button 
        onClick={startNewChat} 
        className="mb-4 w-full" 
        disabled={isLoading}
      >
        <PlusCircle className="mr-2 h-4 w-4" />
        Nueva conversación
      </Button>
      
      <Separator className="mb-4" />
      
      {/* Lista de chats */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-1">
          {chats.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              No hay conversaciones aún
            </div>
          ) : (
            chats.map((chat) => (
              <div 
                key={chat.id}
                className={cn(
                  'group relative flex items-center rounded-md transition-colors',
                  activeThreadId === chat.id && 'bg-secondary'
                )}
              >
                <Button
                  variant="ghost"
                  onClick={() => loadChat(chat.id)}
                  disabled={isLoading}
                  className={cn(
                    'flex-1 justify-start text-left h-auto py-2 px-3 min-h-0',
                    activeThreadId === chat.id && 'bg-secondary'
                  )}
                >
                  <MessageSquare className="mr-2 h-4 w-4 flex-shrink-0" />
                  <span className="truncate text-sm">
                    {chat.title || 'Chat sin título'}
                  </span>
                </Button>
                
                {/* Botón de eliminar */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0 absolute right-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
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

      <Separator className="my-4" />

      {/* Footer con botones de acción */}
      <div className="space-y-2">
        <ToolConfigModal />

        <Button
          variant="ghost"
          onClick={signOut}
          className="w-full justify-start text-destructive hover:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}