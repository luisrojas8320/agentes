import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Este es el log que necesitamos ver en Vercel.
  console.log("--- PING TEST INICIADO ---");
  
  try {
    const body = await req.json();
    console.log("Cuerpo de la petición recibido:", body);

    const responseMessage = "Respuesta de prueba: la ruta del orquestador está viva.";
    
    // Devolvemos una respuesta simple en formato de stream para que 'useChat' la reciba.
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(responseMessage);
        controller.close();
      },
    });

    console.log("--- PING TEST FINALIZADO ---");
    return new NextResponse(stream, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
        },
    });

  } catch (error: any) {
    console.error("Error en el PING TEST:", error);
    return NextResponse.json({ error: "Error en la ruta de prueba." }, { status: 500 });
  }
}