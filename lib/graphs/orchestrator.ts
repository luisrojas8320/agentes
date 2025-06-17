// ruta: lib/graphs/orchestrator.ts
import { StateGraph, END, START } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatDeepSeek } from "@langchain/deepseek";
import { z } from "zod";
import { createClient } from "../../utils/supabase/server";
import { Tables } from "../database.types";

interface OrchestratorState {
  messages: BaseMessage[];
}

function getChatModel(provider: string, modelName: string, temperature: number = 0.7) {
  switch (provider) {
    case 'openai':
      return new ChatOpenAI({
        model: modelName,
        temperature,
        apiKey: process.env.OPENAI_API_KEY,
      });
    case 'google':
      return new ChatGoogleGenerativeAI({
        model: modelName,
        temperature,
        apiKey: process.env.GOOGLE_API_KEY,
      });
    case 'deepseek':
      return new ChatDeepSeek({
        model: modelName,
        temperature,
        apiKey: process.env.DEEPSEEK_API_KEY,
      });
    default:
      console.warn(`Proveedor no soportado: ${provider}. Usando OpenAI por defecto.`);
      return new ChatOpenAI({ model: "gpt-4o-mini", temperature, apiKey: process.env.OPENAI_API_KEY });
  }
}

async function runAgent(agentConfig: Tables<'agents'>, inputs: { task: string }): Promise<string> {
  try {
    console.log(`[Agent Runner] Ejecutando agente: "${agentConfig.name}" usando ${agentConfig.model_provider}/${agentConfig.model_name}`);
    const model = getChatModel(agentConfig.model_provider, agentConfig.model_name);

    const messages: BaseMessage[] = [
      new HumanMessage(agentConfig.system_prompt),
      new HumanMessage(inputs.task)
    ];

    const response = await model.invoke(messages);
    const content = Array.isArray(response.content) ? response.content.join('') : response.content;
    
    console.log(`[Agent Runner] Respuesta de "${agentConfig.name}": ${content.substring(0, 100)}...`);
    return content;
  } catch (error) {
    console.error(`Error ejecutando el agente ${agentConfig.name}:`, error);
    return `Hubo un error al ejecutar el agente ${agentConfig.name}.`;
  }
}

async function getSupervisorTools(): Promise<DynamicStructuredTool[]> {
  const supabase = createClient();
  const { data: agents, error } = await supabase.from("agents").select("*");

  if (error || !agents) {
    console.error("Error al obtener agentes de Supabase:", error);
    return [];
  }

  console.log(`[Tools] Se encontraron ${agents.length} agentes en la base de datos y se crearon como herramientas.`);
  return agents.map(agent => new DynamicStructuredTool({
    name: agent.name.toLowerCase().replace(/\s+/g, '_'),
    description: agent.description || agent.system_prompt,
    schema: z.object({
      task: z.string().describe(`La tarea, pregunta o instrucción detallada para el agente: "${agent.name}".`),
    }),
    func: async (inputs) => runAgent(agent, inputs),
  }));
}

const createSupervisorNode = (model: ChatOpenAI, tools: DynamicStructuredTool[]) => {
  const supervisor = model.bindTools(tools);
  return async (state: OrchestratorState) => {
    console.log("[Supervisor] Ejecutando supervisor...");
    const response = await supervisor.invoke(state.messages);
    return { messages: [response] };
  };
};

const shouldContinue = (state: OrchestratorState): "tools" | "end" => {
  const lastMessage = state.messages[state.messages.length - 1];
  if (lastMessage instanceof AIMessage && lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    console.log("[Supervisor] Decisión: Usar una herramienta.");
    return "tools";
  }
  console.log("[Supervisor] Decisión: Finalizar y responder.");
  return "end";
};

const buildGraph = async () => {
  const tools = await getSupervisorTools();
  const toolNode = new ToolNode(tools);
  const supervisorModel = new ChatOpenAI({ model: "gpt-4o", temperature: 0 });
  const supervisorNode = createSupervisorNode(supervisorModel, tools);

  const workflow = new StateGraph<OrchestratorState>({
    channels: {
      messages: { value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y), default: () => [] },
    },
  });

  workflow.addNode("supervisor", supervisorNode);
  workflow.addNode("tools", toolNode);

  workflow.addEdge(START, "supervisor");
  workflow.addConditionalEdges("supervisor", shouldContinue, {
    tools: "tools",
    end: END,
  });
  workflow.addEdge("tools", "supervisor");

  console.log("Grafo del orquestador compilado exitosamente.");
  return workflow.compile();
};

export const orchestratorApp = buildGraph();