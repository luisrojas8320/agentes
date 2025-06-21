'use client';

import { useChat } from '@/contexts/ChatContext';
import { Button } from '@/components/ui/button';
import { Plus, LogOut, Trash2, MoreHorizontal } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

// Componente modular para el estado MCP
function MCPStatus() {
  const [mcpStatus, setMcpStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

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
        setLoading(false);
      }
    };

    fetchMCPStatus();
  }, [supabase]);

  if (loading) {
    return (
      <div className="px-3 py-2 text-xs text-muted-foreground/50">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-pulse" />
          Cargando estado...
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 space-y-1">
      <div className="flex items-center gap-2 text-xs">
        <div className={cn(
          "w-1.5 h-1.5 rounded-full transition-colors",
          mcpStatus?.initialized ? "bg-green-400/70 animate-pulse" : "bg-muted-foreground/30"
        )} />
        <span className="text-muted-foreground/70">
          MCP {mcpStatus?.initialized ? "Activo" : "Inactivo"}
        </span>
      </div>
      {mcpStatus?.available_tools && (
        <div className="text-xs text-muted-foreground/50 ml-3.5">
          {mcpStatus.available_tools} herramientas
        </div>
      )}
    </div>
  );
}

// Componente modular para el item de chat
function ChatItem({ 
  chat, 
  isActive, 
  isLoading, 
  onSelect, 
  onDelete 
}: {
  chat: any;
  isActive: boolean;
  isLoading: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <div className={cn(
      'group relative flex items-center rounded-lg transition-colors',
      isActive && 'bg-muted/30'
    )}>
      <Button
        variant="ghost"
        onClick={onSelect}
        disabled={isLoading}
        className={cn(
          'flex-1 justify-start text-left h-auto py-3 px-3 font-normal hover:bg-muted/20',
          isActive && 'text-foreground'
        )}
      >
        {/* Icono de chat minimalista */}
        <div className="mr-3 h-4 w-4 flex-shrink-0 flex items-center justify-center">
          <svg 
            className="w-3.5 h-3.5 text-muted-foreground/60" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
            />
          </svg>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="truncate text-sm">
            {chat.title || 'Nueva conversación'}
          </div>
        </div>
      </Button>
      
      {/* Menú de opciones */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 mr-2 hover:bg-muted/30"
          >
            <MoreHorizontal className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuSeparator />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive cursor-pointer"
                onSelect={(e) => e.preventDefault()}
              >
                <Trash2 className="h-3 w-3 mr-2" />
                Eliminar
              </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-border">
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar conversación?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default function Sidebar() {
  const { chats, activeThreadId, startNewChat, loadChat, isLoading, deleteChat } = useChat();
  const { signOut } = useAuth();
  const supabase = createClient();

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from('chats')
        .delete()
        .eq('id', chatId)
        .eq('user_id', session.user.id);

      if (error) throw error;

      deleteChat(chatId);

      if (activeThreadId === chatId) {
        startNewChat();
      }
    } catch (error) {
      console.error('Error eliminando chat:', error);
    }
  };

  return (
    <div className="w-64 bg-background border-r border-border/30 flex flex-col h-full">
      {/* Header minimalista con icono bonito */}
      <div className="p-4 border-b border-border/30">
        <div className="flex items-center gap-2 mb-2">
          {/* Icono de AI Playground */}
          <div className="w-5 h-5 rounded bg-muted/50 flex items-center justify-center">
            <svg 
              className="w-3 h-3 text-muted-foreground/80" 
              fill="currentColor" 
              viewBox="0 0 24 24"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
          <div className="text-sm font-medium text-muted-foreground/70">
            AI Playground
          </div>
        </div>
        <MCPStatus />
      </div>

      {/* Botón nuevo chat con icono bonito */}
      <div className="p-3">
        <Button 
          onClick={startNewChat} 
          className="w-full btn-minimal justify-start group" 
          disabled={isLoading}
        >
          <div className="mr-2 h-4 w-4 flex items-center justify-center">
            <Plus className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
          </div>
          Nueva conversación
        </Button>
      </div>
      
      {/* Lista de chats */}
      <div className="flex-1 overflow-y-auto px-3">
        <div className="space-y-1">
          {chats.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <div className="w-8 h-8 mx-auto rounded-full bg-muted/30 flex items-center justify-center">
                <svg 
                  className="w-4 h-4 text-muted-foreground/40" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={1.5} 
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
                  />
                </svg>
              </div>
              <div className="text-xs text-muted-foreground/50">
                No hay conversaciones
              </div>
            </div>
          ) : (
            chats.map((chat) => (
              <ChatItem
                key={chat.id}
                chat={chat}
                isActive={activeThreadId === chat.id}
                isLoading={isLoading}
                onSelect={() => loadChat(chat.id)}
                onDelete={(e) => handleDeleteChat(chat.id, e)}
              />
            ))
          )}
        </div>
      </div>

      {/* Footer minimalista */}
      <div className="p-3 border-t border-border/30">
        <Button
          variant="ghost"
          onClick={signOut}
          className="w-full btn-minimal justify-start text-muted-foreground/70 hover:text-destructive group"
        >
          <LogOut className="mr-2 h-4 w-4 group-hover:scale-110 transition-transform" />
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}