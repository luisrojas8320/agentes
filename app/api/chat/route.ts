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
  const supabase = createClient();
  const { data: agents, error } = await supabase.from("agents").select("*");
  
  if (error) {
    console.error("DIAGNÓSTICO: [1.1] Error al obtener agentes de Supabase:", error);
    return [];
  }

  if (!agents || agents.length === 0) {
    console.warn("DIAGNÓSTICO: [1.2] No se encontraron agentes en la base de datos.");
    return [];
  }

  console.log(`DIAGNÓSTICO: [1.3] Se encontraron ${agents.length} agentes. Creando herramientas.`);
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
    console.log("DIAGNÓSTICO: [A] Petición POST recibida en /api/chat.");
    const { messages } = await req.json();

    const convertedMessages: BaseMessage[] = messages.map((m: any) =>
      m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
    );
    console.log("DIAGNÓSTICO: [B] Mensajes convertidos.");

    const stream = new ReadableStream({
      async start(controller) {
        console.log("DIAGNÓSTICO: [C] Entrando a la función start del ReadableStream.");
        try {
          const tools = await getSupervisorTools();
          console.log(`DIAGNÓSTICO: [D] Herramientas obtenidas. Número de herramientas: ${tools.length}`);
          
          if (tools.length === 0) {
             console.error("DIAGNÓSTICO: [D.1] No hay herramientas para el supervisor. El grafo no puede funcionar.");
          }

          const graph = createOrchestratorGraph(tools);
          console.log("DIAGNÓSTICO: [E] Grafo creado.");

          const eventStream = await graph.streamEvents(
            { messages: convertedMessages },
            { version: 'v2' }
          );
          console.log("DIAGNÓSTICO: [F] streamEvents invocado. Esperando eventos...");

          for await (const event of eventStream) {
            console.log(JSON.stringify(event, null, 2));
            if (event.event === 'on_chat_model_stream') {
              const chunk = event.data.chunk as AIMessage;
              if (event.name === 'supervisor' && !chunk.tool_calls?.length && typeof chunk.content === 'string') {
                controller.enqueue(new TextEncoder().encode(chunk.content));
              }
            }
          }
          console.log("DIAGNÓSTICO: [H] Bucle de eventos finalizado.");

        } catch (e: any) {
          console.error("DIAGNÓSTICO: [ERR] Error fatal dentro del stream:", e.message, e.stack);
        } finally {
          console.log("DIAGNÓSTICO: [I] Cerrando el controller del stream.");
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

  } catch (e: any) {
    console.error("DIAGNÓSTICO: [ERR] Error fatal en la ruta POST:", e.message, e.stack);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}