'use client';

import { useChat } from '@/contexts/ChatContext';
import { Button } from '@/components/ui/button';
import { PlusCircle, MessageSquare, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

export default function Sidebar() {
  const { chats, activeThreadId, startNewChat, loadChat, isLoading } = useChat();
  const { signOut } = useAuth();

  return (
    <div className="w-64 bg-secondary/30 border-r border-border p-4 flex flex-col h-full">
      <h2 className="text-lg font-semibold mb-4">Conversaciones</h2>
      
      <Button 
        onClick={startNewChat} 
        className="mb-4 w-full" 
        disabled={isLoading}
      >
        <PlusCircle className="mr-2 h-4 w-4" />
        Nueva conversación
      </Button>
      
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-1">
          {chats.map((chat) => (
            <Button
              key={chat.id}
              variant="ghost"
              onClick={() => loadChat(chat.id)}
              disabled={isLoading}
              className={cn(
                'w-full justify-start text-left',
                activeThreadId === chat.id && 'bg-secondary'
              )}
            >
              <MessageSquare className="mr-2 h-4 w-4 flex-shrink-0" />
              <span className="truncate">{chat.title || 'Chat sin título'}</span>
            </Button>
          ))}
        </div>
      </div>

      <Button
        variant="ghost"
        onClick={signOut}
        className="mt-4 w-full justify-start"
      >
        <LogOut className="mr-2 h-4 w-4" />
        Cerrar sesión
      </Button>
    </div>
  );
}