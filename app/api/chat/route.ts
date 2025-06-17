// ruta: app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { orchestratorApp } from '@/lib/graphs/orchestrator';
import { AIMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const convertedMessages: BaseMessage[] = messages.map((m: any) =>
      m.role === 'user'
        ? new HumanMessage(m.content)
        : new AIMessage(m.content)
    );

    // Resuelve la promesa del grafo ANTES de usarla
    const graph = await orchestratorApp;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const eventStream = await graph.streamEvents(
            {
              messages: convertedMessages,
            },
            { version: 'v2' } // Usa v2 para streamEvents
          );

          for await (const event of eventStream) {
            if (event.event === 'on_chat_model_stream') {
              const chunk = event.data.chunk as AIMessage;
              if (event.name === 'supervisor' && !chunk.tool_calls?.length && typeof chunk.content === 'string') {
                controller.enqueue(new TextEncoder().encode(chunk.content));
              }
            }
          }
        } catch (e) {
          console.error("Error dentro del stream de ReadableStream:", e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });

  } catch (e: any) {
    console.error("Error en la ruta de chat principal:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}