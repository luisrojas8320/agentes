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
    new HumanMessage(inputs.task)
  ];
  const response = await model.invoke(messages);
  return Array.isArray(response.content) ? response.content.join('') : response.content;
}

const buildGraph = async () => {
  const tools = await (async () => {
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
  })();

  const supervisorModel = new ChatOpenAI({ model: "gpt-4o", temperature: 0 });
  const boundSupervisor = supervisorModel.bindTools(tools);

  const supervisorNode = async (state: OrchestratorState) => {
    const response = await boundSupervisor.invoke(state.messages);
    return { messages: [response] };
  };
  
  const toolNode = new ToolNode(tools);

  const shouldContinue = (state: OrchestratorState) => {
    const lastMessage = state.messages[state.messages.length - 1];
    if (lastMessage instanceof AIMessage && lastMessage.tool_calls?.length) {
      return "tools";
    }
    return END;
  };
  
  const workflow = new StateGraph<OrchestratorState>({
    channels: {
      messages: { 
        value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y), 
        default: () => [] 
      },
    },
  });

  workflow.addNode("supervisor", supervisorNode as any);
  workflow.addNode("tools", toolNode as any);

  // SOLUCIÓN: Aplicar 'as any' para bypassear el type check defectuoso de la librería.
  workflow.setEntryPoint("supervisor" as any);
  
  workflow.addConditionalEdges("supervisor" as any, shouldContinue, {
    tools: "tools" as any,
    [END]: END,
  });

  workflow.addEdge("tools" as any, "supervisor" as any);

  console.log("Grafo del orquestador compilado exitosamente.");
  return workflow.compile();
};

export const orchestratorApp = buildGraph();