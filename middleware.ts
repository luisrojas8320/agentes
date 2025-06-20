// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  // Actualizar sesión de Supabase
  const response = await updateSession(request)
  
  // Rutas que requieren autenticación
  const protectedRoutes = ['/chat', '/api/chat', '/api/upload']
  const isProtectedRoute = protectedRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  )
  
  // Si es ruta protegida, verificar autenticación
  if (isProtectedRoute) {
    const hasSession = request.cookies.get('sb-access-token')
    
    if (!hasSession && request.nextUrl.pathname !== '/login') {
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
  }
  
  // Redirigir / a /login si no hay sesión
  if (request.nextUrl.pathname === '/') {
    const hasSession = request.cookies.get('sb-access-token')
    if (!hasSession) {
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
  }
  
  return response
}

export const config = {
  matcher: [
    /*
     * Ejecutar en todas las rutas excepto:
     * - _next/static (archivos estáticos)
     * - _next/image (optimización de imágenes)
     * - favicon.ico
     * - public (archivos públicos)
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}