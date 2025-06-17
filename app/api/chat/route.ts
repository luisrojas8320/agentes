// ruta: app/api/chat/route.ts
import { AIMessage, HumanMessage, BaseMessage } from '@langchain/core/messages';
import { createClient } from '@/utils/supabase/server';
import { Tables } from '@/lib/database.types';
import { Tool } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatDeepSeek } from '@langchain/deepseek';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { type SupabaseClient } from '@supabase/supabase-js';
import { AgentAction, AgentFinish } from '@langchain/core/agents';
import { RunnableLambda } from "@langchain/core/runnables";
import { StateGraph, END, START } from 'langgraph';
import { z } from 'zod';
import { Tool as LangGraphTool } from 'langgraph/prebuilt';

export const runtime = 'edge';

// --- Creador de Modelos ---
function getChatModel(provider: string, modelName: string, temperature: number = 0) {
    const config = { modelName, temperature, streaming: true, apiKey: process.env[`${provider.toUpperCase()}_API_KEY`] };
    switch (provider) {
        case 'openai': return new ChatOpenAI(config);
        case 'google': return new ChatGoogleGenerativeAI(config);
        case 'deepseek': return new ChatDeepSeek(config);
        default: return new ChatOpenAI({ modelName: "gpt-4o-mini", temperature, streaming: true, apiKey: process.env.OPENAI_API_KEY });
    }
}

// --- Creador de Herramientas (Agentes Especializados) ---
async function getSpecialistAgentsAsTools(supabase: SupabaseClient): Promise<Tool[]> {
    const { data: agents, error } = await supabase.from("agents").select("*");
    if (error || !agents) { return []; }

    return agents.map(agentConfig => new Tool({
        name: agentConfig.name.toLowerCase().replace(/\s+/g, '_'),
        description: `Ideal para: ${agentConfig.description}. Delega la tarea a este agente si la pregunta del usuario está relacionada.`,
        schema: z.object({
            task: z.string().describe(`La tarea específica o pregunta detallada para el agente ${agentConfig.name}.`),
        }),
        func: async ({ task }) => {
            const model = getChatModel(agentConfig.model_provider, agentConfig.model_name, 0.7);
            const response = await model.invoke([
                new HumanMessage(agentConfig.system_prompt),
                new HumanMessage(task)
            ]);
            return response.content.toString();
        },
    }));
}

// --- Definición del Estado del Grafo ---
interface AgentState {
    messages: BaseMessage[];
}

// --- Handler POST Principal ---
export async function POST(req: Request) {
    try {
        const { messages } = await req.json();
        const supabase = createClient();
        
        // 1. Obtener herramientas
        const tools = await getSpecialistAgentsAsTools(supabase);
        const toolExecutor = new LangGraphTool(tools);

        // 2. Definir el modelo del agente supervisor
        const supervisorModel = getChatModel('openai', 'gpt-4o-mini').bindTools(tools);

        // 3. Definir los nodos del grafo
        
        // Nodo Agente: Llama al LLM para decidir la siguiente acción
        const agentNode = async (state: AgentState) => {
            const result = await supervisorModel.invoke(state.messages);
            return { messages: [result] };
        };

        // Nodo de Herramientas: Ejecuta la herramienta elegida
        const toolNode = async (state: AgentState) => {
            const lastMessage = state.messages[state.messages.length - 1];
            if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
                return { messages: [] };
            }
            const toolInvocations = lastMessage.tool_calls.map(tool => new AgentAction({
                tool: tool.name,
                toolInput: tool.args,
                log: '', // No es necesario para esta implementación
            }));

            const toolCallResults = await toolExecutor.invoke(toolInvocations[0]);
            
            return {
                messages: [toolCallResults],
            };
        };

        // 4. Definir la lógica de transición (aristas del grafo)
        const shouldContinue = (state: AgentState): "tools" | typeof END => {
            const lastMessage = state.messages[state.messages.length - 1];
            if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
                return "tools";
            }
            return END;
        };

        // 5. Construir el Grafo
        const workflow = new StateGraph<AgentState>({
            channels: {
                messages: {
                    value: (x, y) => x.concat(y),
                    default: () => [],
                },
            },
        });

        workflow.addNode("agent", agentNode);
        workflow.addNode("tools", toolNode);
        
        workflow.addEdge(START, "agent");
        workflow.addConditionalEdges("agent", shouldContinue);
        workflow.addEdge("tools", "agent");
        
        const app = workflow.compile();

        // 6. Invocar el grafo y hacer stream de la respuesta
        const stream = await app.stream(
            { messages: messages.map((m: any) => m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)) },
            { streamMode: 'values' } // 'values' mode streams final outputs
        );

        // Transformar el stream de LangGraph a un stream de texto simple
        const textEncoder = new TextEncoder();
        const readableStream = new ReadableStream({
            async start(controller) {
                for await (const event of stream) {
                    const lastMessage = event.messages[event.messages.length - 1];
                    if (lastMessage && !lastMessage.tool_calls) {
                        const content = lastMessage.content;
                        if (typeof content === 'string') {
                            controller.enqueue(textEncoder.encode(content));
                        }
                    }
                }
                controller.close();
            }
        });

        return new Response(readableStream, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });

    } catch (e: any) {
        console.error("Error en la ruta de LangGraph:", e);
        return new Response(e.message, { status: 500 });
    }
}