// ================================
// 4. ARREGLAR ChatInterface.tsx - Layout General Mobile
// ================================

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
      {/* ARREGLO: Mobile menu button con mejor posición */}
      <Button
        variant="ghost"
        size="icon"
        className={`
          md:hidden absolute z-50 mobile-button transition-colors
          ${sidebarOpen ? 'text-foreground' : 'text-foreground/80'}
          hover:text-foreground hover:bg-muted/30
          ${isMobile ? 'top-4 left-4' : 'top-3 left-3'}
        `}
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? (
          <X className="h-4 w-4" />
        ) : (
          <Menu className="h-4 w-4" />
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

      {/* ARREGLO: Main chat area con safe areas */}
      <div className={`
        flex-1 flex flex-col min-w-0
        ${isMobile && sidebarOpen ? 'pointer-events-none' : ''}
        ${isMobile ? 'pt-safe-top' : ''}
      `}>
        {/* ARREGLO: Message area con mejor altura */}
        <div className={`
          flex-1 overflow-hidden mobile-scroll
          ${isMobile ? 'min-h-0' : ''}
        `}>
          <MessageList />
        </div>
        
        {/* ARREGLO: Input area con safe area bottom */}
        <div className={`
          flex-shrink-0 input-area
          ${isMobile ? 'pb-safe-bottom' : ''}
        `}>
          <ChatInput />
        </div>
      </div>
    </div>
  );
}