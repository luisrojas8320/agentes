import { NextResponse } from 'next/server';
import { orchestratorApp } from '@/lib/graphs/orchestrator';
import { AIMessage, HumanMessage } from '@langchain/core/messages';

// Se establece el runtime de Vercel en 'edge' para un streaming más rápido.
export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const convertedMessages = messages.map((m: any) =>
      m.role === 'user'
        ? new HumanMessage(m.content)
        : new AIMessage(m.content)
    );

    // Se crea un stream de respuesta que el frontend puede consumir.
    const stream = new ReadableStream({
      async start(controller) {
        // Callback para encolar los trozos de texto en el stream.
        const streamCallback = (chunk: string) => {
          controller.enqueue(new TextEncoder().encode(chunk));
        };

        // Se invoca el grafo con .streamEvents() para capturar los eventos en tiempo real.
        const eventStream = await orchestratorApp.streamEvents(
          {
            messages: convertedMessages,
          },
          { version: 'v1' }
        );

        // Se itera sobre los eventos del grafo.
        for await (const event of eventStream) {
          const eventName = event.event;
          
          // Nos interesa el evento que contiene los trozos de la respuesta del LLM.
          if (eventName === 'on_chat_model_stream') {
            const content = event.data.chunk?.content;
            if (content) {
              // Se envía cada trozo al frontend a medida que llega.
              streamCallback(content);
            }
          }
        }
        // Se cierra el stream cuando el grafo termina.
        controller.close();
      },
    });

    // Se devuelve el stream como respuesta.
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });

  } catch (e: any) {
    console.error("Error en el orquestador:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}