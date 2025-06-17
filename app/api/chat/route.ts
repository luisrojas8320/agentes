// ruta: app/api/chat/route.ts
import { AIMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';
import { createClient } from '@/utils/supabase/server';
import { Tables } from '@/lib/database.types';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatDeepSeek } from '@langchain/deepseek';
import { CoreMessage, streamText } from 'ai';
import { experimental_langchain_adapter } from '@ai-sdk/langchain';
import { type SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'edge';

function getChatModel(provider: string, modelName: string, temperature: number = 0.7) {
    switch (provider) {
        case 'openai': return new ChatOpenAI({ model: modelName, temperature, apiKey: process.env.OPENAI_API_KEY });
        case 'google': return new ChatGoogleGenerativeAI({ model: modelName, temperature, apiKey: process.env.GOOGLE_API_KEY });
        case 'deepseek': return new ChatDeepSeek({ model: modelName, temperature, apiKey: process.env.DEEPSEEK_API_KEY });
        default: return new ChatOpenAI({ model: "gpt-4o-mini", temperature, apiKey: process.env.OPENAI_API_KEY });
    }
}

async function runAgent(agentConfig: Tables<'agents'>, inputs: { task: string }): Promise<string> {
    const model = getChatModel(agentConfig.model_provider, agentConfig.model_name);
    const messages: BaseMessage[] = [ new HumanMessage(agentConfig.system_prompt), new HumanMessage(inputs.task) ];
    const response = await model.invoke(messages);
    return Array.isArray(response.content) ? response.content.join('') : response.content;
}

async function getSupervisorTools(supabase: SupabaseClient) {
    const { data: agents, error } = await supabase.from("agents").select("*");
    if (error || !agents) { 
        console.error("Error al obtener agentes:", error);
        return []; 
    }
    return agents.map(agent => new DynamicStructuredTool({
        name: agent.name.toLowerCase().replace(/\s+/g, '_'),
        description: agent.description || agent.system_prompt,
        schema: z.object({
            task: z.string().describe(`Tarea para: "${agent.name}".`),
        }),
        func: (inputs) => runAgent(agent, inputs),
    }));
}

export async function POST(req: Request) {
  try {
    const { messages }: { messages: CoreMessage[] } = await req.json();
    const supabase = createClient();
    
    const supervisorLLM = new ChatOpenAI({
      model: "gpt-4o",
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const tools = await getSupervisorTools(supabase);

    // Se utiliza el adaptador experimental para el modelo y las herramientas
    const model = experimental_langchain_adapter.from(
        supervisorLLM.bindTools(tools)
    );

    const result = await streamText({
      model: model,
      messages: messages,
    });

    return result.toAIStreamResponse();

  } catch (e: any) {
    console.error("Error en la ruta POST de chat:", e.message);
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}