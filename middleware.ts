// Ruta: middleware.ts

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Crea una respuesta inicial para poder modificar sus cookies más adelante
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Crea una instancia del cliente de Supabase para el middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // Si usamos 'set', necesitamos actualizar la petición y la respuesta
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          // Si usamos 'remove', también actualizamos
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Obtenemos la sesión del usuario. Esto también refresca el token.
  const { data: { session } } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl

  // --- LÓGICA DE PROTECCIÓN DE RUTAS ---
  // Si no hay sesión y el usuario NO está intentando acceder a la página de login,
  // lo redirigimos a la página de login.
  if (!session && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Si el usuario YA tiene sesión y intenta acceder a la página de login,
  // lo redirigimos a la página principal del chat.
  if (session && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }
  
  // Si ninguna de las condiciones anteriores se cumple, permitimos el acceso.
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - /auth (la ruta de callback de OAuth)
     */
    '/((?!_next/static|_next/image|favicon.ico|auth).*)',
  ],
}