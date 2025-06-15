// RUTA: app/api/chat/route.ts

import { NextRequest, NextResponse } from 'next/server';
// FIX 1: Importamos el 'orchestratorApp', que es el cerebro, no el agente simple.
import { orchestratorApp } from '@/lib/graphs/orchestrator';
import { AIMessage, HumanMessage } from '@langchain/core/messages';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    // El orquestador necesita todo el historial para tomar decisiones,
    // así que lo convertimos al formato de LangChain.
    const convertedMessages = messages.map((m: any) =>
      m.role === 'user'
        ? new HumanMessage(m.content)
        : new AIMessage(m.content)
    );

    const stream = new ReadableStream({
      async start(controller) {
        const streamCallback = (chunk: string) => {
          controller.enqueue(new TextEncoder().encode(chunk));
        };

        // FIX 2: Invocamos 'orchestratorApp'.
        // Su estado de entrada es un objeto con una clave 'messages'.
        const eventStream = await orchestratorApp.streamEvents(
          {
            messages: convertedMessages,
          },
          { version: 'v1' }
        );

        // FIX 3: La lógica de streaming ahora busca los trozos de texto
        // que vienen directamente del LLM, que es la respuesta final del supervisor.
        for await (const event of eventStream) {
          const eventName = event.event;
          
          if (eventName === 'on_chat_model_stream') {
            const content = event.data.chunk?.content;
            if (content) {
              // Enviamos cada trozo de texto al frontend a medida que llega.
              streamCallback(content);
            }
          }
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}