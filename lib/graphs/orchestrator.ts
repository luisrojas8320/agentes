import { StateGraph, END } from "@langchain/langgraph";
import { AIMessage, BaseMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { agentGraph as generalChatAgent } from "./agent";

const generalChatTool = new DynamicStructuredTool({
  name: "general_chat_agent",
  description: "Útil para mantener una conversación general, saludar, responder a preguntas casuales o actuar como un asistente de IA.",
  schema: z.object({
    input: z.string().describe("La pregunta o mensaje del usuario para el agente de chat general."),
  }),
  func: async ({ input }) => {
    const response = await generalChatAgent.invoke({
      input: input,
      chat_history: [],
    });
    return response.agent_outcome;
  },
});

const tools = [generalChatTool];

interface OrchestratorState {
  messages: BaseMessage[];
}

const supervisorSystemPrompt = `Eres un 'cerebro' orquestador experto. Tu trabajo es gestionar una conversación entre un usuario y un equipo de agentes especializados (representados como herramientas).

1.  **Analiza:** Lee detenidamente el último mensaje del usuario y todo el historial de la conversación.
2.  **Orquesta:** Decide cuál de las siguientes opciones es la más adecuada:
    a. **Si la pregunta puede ser respondida directamente por un agente especializado**, llama a la herramienta correspondiente con los argumentos correctos.
    b. **Si el usuario está teniendo una conversación casual**, usa la herramienta 'general_chat_agent'.
    c. **Si ya has llamado a una herramienta y su respuesta (ToolMessage) es suficiente para contestar la pregunta del usuario**, no llames a más herramientas. En su lugar, responde directamente al usuario, sintetizando la información obtenida.
    d. **Si la respuesta de la herramienta no es suficiente**, puedes llamar a otra herramienta o a la misma de nuevo para refinar la búsqueda o la tarea.
3.  **Responde:** Tu respuesta final debe ser directa al usuario, no una llamada a una herramienta. Solo llama a herramientas cuando necesites obtener información de un especialista.`;

const supervisorNode = async (state: OrchestratorState) => {
  const model = new ChatOpenAI({ model: "gpt-4o", temperature: 0 });
  
  const messagesWithSystemPrompt = [
    new HumanMessage({ content: supervisorSystemPrompt }),
    ...state.messages
  ];

  const modelWithTools = model.bindTools(tools);
  const response = await modelWithTools.invoke(messagesWithSystemPrompt);
  
  return { messages: [response] };
};

const toolNode = async (state: OrchestratorState) => {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  const toolCall = lastMessage.tool_calls![0];
  const toolToUse = tools.find((tool) => tool.name === toolCall.name);
  if (!toolToUse) { throw new Error("Herramienta no encontrada"); }
  
  const output = await toolToUse.invoke(toolCall.args as any);

  return {
    messages: [new ToolMessage({ content: String(output), tool_call_id: toolCall.id! })],
  };
};

function shouldContinue(state: OrchestratorState): "tools" | typeof END {
  const lastMessage = state.messages[state.messages.length - 1];
  if (lastMessage instanceof AIMessage && lastMessage.tool_calls?.length) {
    return "tools";
  }
  return END;
}

const workflow = new StateGraph<OrchestratorState>({
  channels: {
    messages: {
      value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
      default: () => [],
    }
  }
});

workflow.addNode("supervisor", supervisorNode);
workflow.addNode("tools", toolNode);
workflow.setEntryPoint("supervisor" as any);
workflow.addConditionalEdges("supervisor" as any, shouldContinue);
workflow.addEdge("tools" as any, "supervisor" as any);

export const orchestratorApp = workflow.compile();