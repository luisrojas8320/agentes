'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ChatInterface from '@/components/ChatInterface';
import { AuthProvider } from '@/contexts/AuthContext';
import { ChatProvider } from '@/contexts/ChatContext';
import { createClient } from '@/utils/supabase/client';

export default function ChatPage() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // --- CORRECCIÓN AQUÍ: Redirigir a /login si no hay sesión ---
        router.push('/login'); 
      }
    };
    checkAuth();
  }, [router, supabase]);

  return (
    <AuthProvider>
      <ChatProvider>
        <ChatInterface />
      </ChatProvider>
    </AuthProvider>
  );
}