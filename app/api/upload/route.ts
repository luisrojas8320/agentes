import { NextRequest, NextResponse } from 'next/server';

// Se mantiene la ruta como dinámica.
export const dynamic = 'force-dynamic';

/**
 * Endpoint POST temporalmente deshabilitado para depuración.
 */
export async function POST(req: NextRequest) {
  console.log("ADVERTENCIA: La API de subida de archivos está deshabilitada temporalmente para depuración.");

  // Devolvemos un error 'Service Unavailable' para indicar que está fuera de servicio.
  return NextResponse.json(
    { error: "La subida de archivos está deshabilitada temporalmente por mantenimiento." },
    { status: 503 }
  );
}