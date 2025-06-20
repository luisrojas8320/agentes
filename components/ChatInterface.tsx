'use client';

import { useChat } from '@/contexts/ChatContext';
import { Button } from '@/components/ui/button';
import { PlusCircle, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

// CORREGIDO: Añadir 'export default' para que el componente pueda ser importado.
export default function Sidebar() {
    const { chats, activeThreadId, startNewChat, loadChat, isLoading } = useChat();

    return (
        <div className="w-full md:w-64 bg-[#1c1c1c] border-r border-gray-700 p-4 flex flex-col h-full">
            <h2 className="text-lg font-semibold mb-4 text-gray-200">Conversaciones</h2>
            <Button onClick={startNewChat} className="mb-4 bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Nuevo Chat
            </Button>
            <div className="flex-grow overflow-y-auto pr-2 -mr-2">
                <div className="flex flex-col gap-2">
                    {chats.map((chat) => (
                        <Button
                            key={chat.id}
                            variant="ghost"
                            onClick={() => loadChat(chat.id)}
                            disabled={isLoading}
                            className={cn(
                                'w-full justify-start text-left truncate text-gray-300',
                                activeThreadId === chat.id ? 'bg-gray-700 text-white' : 'hover:bg-gray-800'
                            )}
                        >
                            <MessageSquare className="mr-2 h-4 w-4 flex-shrink-0" />
                            <span className="truncate">{chat.title || 'Chat sin título'}</span>
                        </Button>
                    ))}
                </div>
            </div>
        </div>
    );
};