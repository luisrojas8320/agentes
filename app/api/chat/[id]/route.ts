// Ruta: app/api/chat/[id]/route.ts

import { NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { app as agentApp } from '@/lib/graphs/agent';
import type { AgentConfig } from '@/lib/graphs/agent';
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import { StreamingTextResponse } from 'ai';

// La función GET no necesita cambios, pero se incluye por completitud.
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // ... tu código GET existente
}


export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const chatId = params.id;
  const supabase = createClient();
  const body = await request.json();
  const userInput = body.message;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 });
    }

    const { data: history, error: historyError } = await supabase
      .from('messages')
      .select('content, role')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (historyError) throw historyError;

    const messages: BaseMessage[] = history.map(msg =>
      msg.role === 'user'
        ? new HumanMessage(msg.content)
        : new AIMessage(msg.content)
    );
    messages.push(new HumanMessage(userInput));
    
    const config: AgentConfig = {
      configurable: {
        supabase: supabase,
        userId: user.id,
      },
    };

    // MÉTODO DE STREAMING MODERNO Y CORRECTO
    const streamLog = await agentApp.streamLog({ messages: messages }, config);
    const textEncoder = new TextEncoder();

    const customStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of streamLog) {
          const op = chunk.ops[0];
          // Solo nos interesan las operaciones que añaden contenido al output final del agente
          if (
            op.op === "add" &&
            op.path.startsWith("/streamed_output/-") &&
            op.path.endsWith("/content") &&
            typeof op.value === 'string' &&
            op.value.length > 0
          ) {
            controller.enqueue(textEncoder.encode(op.value));
          }
        }
        controller.close();
      },
    });

    return new StreamingTextResponse(customStream);

  } catch (error: any) {
    console.error("[API POST] Error:", error);
    return new Response(JSON.stringify({ error: "Error interno del servidor." }), { status: 500 });
  }
}