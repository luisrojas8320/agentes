import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Ignorar errores en caso de que las cookies se establezcan desde un Server Component
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Ignorar errores en caso de que las cookies se establezcan desde un Server Component
          }
        },
      },
      // SOLUCIÓN: Añadir esta opción para deshabilitar el caché de fetch en el Edge Runtime.
      global: {
        fetch: (input, init) => {
          return fetch(input, {
            ...init,
            cache: 'no-store',
          });
        },
      },
    }
  )
}