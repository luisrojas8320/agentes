// Ruta: components/ChatInterface.tsx
'use client'
import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { MessageList } from './MessageList';
import { ChatInput } from '../components/ChatInput';

export default function ChatInterface() {
  // El estado del sidebar es puramente visual, se queda aquí
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#181818] text-white">
      <div className="hidden md:flex"><Sidebar /></div>
      <main className="flex-1 flex flex-col h-screen">
        <header className="md:hidden flex items-center justify-between p-4 border-b border-gray-700">
            <h1 className="text-lg font-semibold uppercase tracking-wider">Playground Agents</h1>
            <Button onClick={() => setIsSidebarOpen(!isSidebarOpen)} size="icon" variant="ghost">
              <Menu className="h-6 w-6" />
            </Button>
        </header>
        {isSidebarOpen && (<div className="md:hidden"><Sidebar /></div>)}
        <div className="flex-1 flex flex-col overflow-hidden">
            <MessageList />
            <ChatInput />
        </div>
      </main>
    </div>
  );
}