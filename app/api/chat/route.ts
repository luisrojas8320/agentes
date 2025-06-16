import { NextResponse } from 'next/server';
import { orchestratorApp } from '@/lib/graphs/orchestrator';
import { AIMessage, HumanMessage } from '@langchain/core/messages';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const convertedMessages = messages.map((m: any) =>
      m.role === 'user'
        ? new HumanMessage(m.content)
        : new AIMessage(m.content)
    );

    const stream = new ReadableStream({
      async start(controller) {
        const streamCallback = (chunk: string) => {
          try {
            controller.enqueue(new TextEncoder().encode(chunk));
          } catch (e) {
            // Manejar el caso en que el stream ya se cerró
          }
        };

        const eventStream = await orchestratorApp.streamEvents(
          {
            messages: convertedMessages,
          },
          { version: 'v1' }
        );

        for await (const event of eventStream) {
          if (event.event === 'on_chat_model_stream') {
            const chunk = event.data.chunk as AIMessage;
            // Asegurarse de que solo se envían chunks de la respuesta final del supervisor
            if (event.name === 'supervisor' && !chunk.tool_calls?.length && typeof chunk.content === 'string') {
              streamCallback(chunk.content);
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
    console.error("Error en la ruta de chat principal:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}