// ruta: app/api/chat/route.ts
import { AIMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';
import { createClient } from '@/utils/supabase/server';
import { Tables } from '@/lib/database.types';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatDeepSeek } from '@langchain/deepseek';
import { streamText } from 'ai';
// SOLUCIÓN: Importar el nombre correcto de la función de conversión.
import { convertLangChainModelToVercelAI } from '@ai-sdk/langchain';

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

async function getSupervisorTools() {
    const supabase = createClient();
    const { data: agents, error } = await supabase.from("agents").select("*");
    if (error || !agents) { return []; }

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
    
    const tools = await getSupervisorTools();
    
    const supervisorLLM = new ChatOpenAI({
      model: "gpt-4o",
      temperature: 0,
      apiKey: process.env.OPENAI_API_KEY,
    });

    // 1. Vinculamos las herramientas al modelo de LangChain.
    const llmWithTools = supervisorLLM.bindTools(tools);

    // 2. Usamos el adaptador 'convertLangChainModelToVercelAI' sobre el modelo ya vinculado.
    const model = convertLangChainModelToVercelAI(llmWithTools);

    // 3. Llamamos a streamText con el modelo adaptado.
    const result = await streamText({
      model: model,
      messages: messages,
      // No es necesario pasar 'tools' o 'toolChoice' aquí, ya están vinculados en el paso 1.
    });

    return result.toAIStreamResponse();

  } catch (e: any) {
    console.error("Error en la ruta POST de chat:", e.message);
    return new Response(`Error: ${e.message}`, { status: 500 });
  }
}