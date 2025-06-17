// ruta: app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { createOrchestratorGraph } from '@/lib/graphs/orchestrator';
import { AIMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';
import { createClient } from '@/utils/supabase/server';
import { Tables } from '@/lib/database.types';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatDeepSeek } from '@langchain/deepseek';

export const runtime = 'edge';

// La lógica para crear herramientas ahora vive aquí.
function getChatModel(provider: string, modelName: string, temperature: number = 0.7) {
  switch (provider) {
    case 'openai':
      return new ChatOpenAI({ model: modelName, temperature, apiKey: process.env.OPENAI_API_KEY });
    case 'google':
      return new ChatGoogleGenerativeAI({ model: modelName, temperature, apiKey: process.env.GOOGLE_API_KEY });
    case 'deepseek':
      return new ChatDeepSeek({ model: modelName, temperature, apiKey: process.env.DEEPSEEK_API_KEY });
    default:
      return new ChatOpenAI({ model: "gpt-4o-mini", temperature, apiKey: process.env.OPENAI_API_KEY });
  }
}

async function runAgent(agentConfig: Tables<'agents'>, inputs: { task: string }): Promise<string> {
  const model = getChatModel(agentConfig.model_provider, agentConfig.model_name);
  const messages: BaseMessage[] = [
    new HumanMessage(agentConfig.system_prompt),
    new HumanMessage(inputs.task),
  ];
  const response = await model.invoke(messages);
  return Array.isArray(response.content) ? response.content.join('') : response.content;
}

async function getSupervisorTools() {
  // Es seguro llamar a createClient() aquí porque estamos dentro de una petición.
  const supabase = createClient();
  const { data: agents, error } = await supabase.from("agents").select("*");
  if (error || !agents) {
    console.error("Error al obtener agentes de Supabase:", error);
    return [];
  }
  return agents.map(agent => new DynamicStructuredTool({
    name: agent.name.toLowerCase().replace(/\s+/g, '_'),
    description: agent.description || agent.system_prompt,
    schema: z.object({
      task: z.string().describe(`La tarea detallada para el agente: "${agent.name}".`),
    }),
    func: (inputs) => runAgent(agent, inputs),
  }));
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const convertedMessages: BaseMessage[] = messages.map((m: any) =>
      m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
    );

    // 1. Obtener las herramientas (que usan Supabase) dentro del scope de la petición.
    const tools = await getSupervisorTools();
    
    // 2. Construir el grafo con esas herramientas.
    const graph = createOrchestratorGraph(tools);

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const eventStream = await graph.streamEvents(
            { messages: convertedMessages },
            { version: 'v2' }
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
          console.error("Error dentro del stream:", e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

  } catch (e: any) {
    console.error("Error en la ruta POST de chat:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}