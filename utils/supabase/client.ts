// Ruta: utils/supabase/client.ts

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Crea un cliente de Supabase para componentes de cliente ('use client')
  // Este cliente puede ser usado de forma segura en el navegador.
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}