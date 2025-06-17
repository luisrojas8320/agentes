// ruta: app/api/chat/route.ts
import { AIMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';
import { createClient } from '@/utils/supabase/server';
import { Tables } from '@/lib/database.types';
import { DynamicStructuredTool, Tool } from '@langchain/core/tools';
import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatDeepSeek } from '@langchain/deepseek';
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { type SupabaseClient } from '@supabase/supabase-js';
import { RunnableSequence } from "@langchain/core/runnables";
import { BytesOutputParser } from "@langchain/core/output_parsers";

export const runtime = 'edge';

// --- Creador de Modelos ---
function getChatModel(provider: string, modelName: string, temperature: number = 0) {
    switch (provider) {
        case 'openai': return new ChatOpenAI({ model: modelName, temperature, streaming: true, apiKey: process.env.OPENAI_API_KEY });
        case 'google': return new ChatGoogleGenerativeAI({ model: modelName, temperature, streaming: true, apiKey: process.env.GOOGLE_API_KEY });
        case 'deepseek': return new ChatDeepSeek({ model: modelName, temperature, streaming: true, apiKey: process.env.DEEPSEEK_API_KEY });
        default: return new ChatOpenAI({ model: "gpt-4o-mini", temperature, streaming: true, apiKey: process.env.OPENAI_API_KEY });
    }
}

// --- Creador de Agentes Especializados (Herramientas del Supervisor) ---
async function getSpecialistAgentsAsTools(supabase: SupabaseClient): Promise<Tool[]> {
    const { data: agents, error } = await supabase.from("agents").select("*");
    if (error || !agents) {
        console.error("Error al obtener agentes:", error);
        return [];
    }

    return agents.map(agentConfig => {
        const tool = new DynamicStructuredTool({
            name: agentConfig.name.toLowerCase().replace(/\s+/g, '_'),
            description: `Ideal para: ${agentConfig.description}. Delega la tarea a este agente si la pregunta del usuario está relacionada.`,
            schema: z.object({
                task: z.string().describe(`La tarea específica o pregunta detallada para el agente ${agentConfig.name}.`),
            }),
            func: async ({ task }) => {
                // Este agente especializado no necesita streaming, solo ejecuta y devuelve el resultado final.
                const model = getChatModel(agentConfig.model_provider, agentConfig.model_name, 0.7);
                const response = await model.invoke([
                    new HumanMessage(agentConfig.system_prompt),
                    new HumanMessage(task)
                ]);
                return response.content.toString();
            },
        });
        return tool;
    });
}

// --- Handler POST Principal ---
export async function POST(req: Request) {
    try {
        const { messages } = await req.json();
        const supabase = createClient();
        const lastMessage = messages[messages.length - 1];

        // 1. Obtener las herramientas (agentes especializados)
        const tools = await getSpecialistAgentsAsTools(supabase);

        // 2. Crear el agente Supervisor
        const supervisorPrompt = ChatPromptTemplate.fromMessages([
            ["system", "Eres un agente supervisor experto. Tu trabajo es analizar la pregunta del usuario y delegarla al agente especializado más adecuado. Si no hay un agente adecuado, responde directamente a la pregunta del usuario. Mantén la conversación en el idioma original del usuario."],
            ["placeholder", "{chat_history}"],
            ["human", "{input}"],
            ["placeholder", "{agent_scratchpad}"],
        ]);

        const supervisorModel = getChatModel('openai', 'gpt-4o-mini');
        const supervisorAgent = await createToolCallingAgent({
            llm: supervisorModel,
            tools,
            prompt: supervisorPrompt,
        });

        // 3. Crear el Ejecutor del Agente
        const agentExecutor = new AgentExecutor({
            agent: supervisorAgent,
            tools,
        });

        // 4. Construir la cadena con streaming
        const sequence = RunnableSequence.from([
            {
                input: (i: { input: string; chat_history: BaseMessage[] }) => i.input,
                chat_history: (i: { input: string; chat_history: BaseMessage[] }) => i.chat_history,
                agent_scratchpad: () => [],
            },
            agentExecutor,
            (i: any) => i.output, // Extraer solo la salida final del agente
            new BytesOutputParser(),
        ]);

        // 5. Preparar el historial y la entrada
        const chatHistory = messages.slice(0, -1).map((msg: any) =>
            msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
        );

        // 6. Invocar y hacer stream de la respuesta
        const stream = await sequence.stream({
            input: lastMessage.content,
            chat_history: chatHistory,
        });

        return new Response(stream, {
            headers: { 'Content-Type': 'text/plain' },
        });

    } catch (e: any) {
        console.error(e);
        return new Response(e.message, { status: 500 });
    }
}