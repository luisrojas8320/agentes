'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import MessageList from '@/components/MessageList';
import ChatInput from '@/components/ChatInput';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

export default function ChatInterface() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  // Cerrar sidebar cuando se cambia a desktop
  useEffect(() => {
    if (!isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  // Evitar scroll del body cuando el sidebar está abierto en mobile
  useEffect(() => {
    if (isMobile && sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobile, sidebarOpen]);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className={`
          md:hidden absolute top-3 left-3 z-50 mobile-button
          ${sidebarOpen ? 'text-foreground' : 'text-foreground/80'}
          hover:text-foreground hover:bg-muted/30 transition-colors
        `}
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
        <span className="sr-only">
          {sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
        </span>
      </Button>

      {/* Sidebar */}
      <div className={`
        ${isMobile ? 'sidebar-mobile' : 'md:relative'}
        ${sidebarOpen ? 'open' : 'closed'}
        ${!isMobile ? 'md:translate-x-0' : ''}
        h-full z-40 bg-background border-r border-border/30
      `}>
        <Sidebar />
      </div>

      {/* Overlay for mobile */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main chat area */}
      <div className={`
        flex-1 flex flex-col min-w-0
        ${isMobile && sidebarOpen ? 'pointer-events-none' : ''}
      `}>
        {/* Message area with proper mobile spacing */}
        <div className="flex-1 overflow-hidden">
          <MessageList />
        </div>
        
        {/* Input area with mobile-optimized spacing */}
        <div className="flex-shrink-0">
          <ChatInput />
        </div>
      </div>
    </div>
  );
}