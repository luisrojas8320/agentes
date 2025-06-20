'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import MessageList from '@/components/MessageList';
import ChatInput from '@/components/ChatInput';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ChatInterface() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden absolute top-4 left-4 z-50"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Sidebar */}
      <div className={`${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0 fixed md:relative z-40 h-full transition-transform duration-300 ease-in-out`}>
        <Sidebar />
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        <MessageList />
        <ChatInput />
      </div>
    </div>
  );
}