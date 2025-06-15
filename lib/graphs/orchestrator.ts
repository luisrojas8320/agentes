// RUTA: lib/graphs/orchestrator.ts

import { StateGraph, END } from "@langchain/langgraph";
import { AIMessage, BaseMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { agentGraph as generalChatAgent } from "./agent"; 

// --- HERRAMIENTA (Sin cambios) ---
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

// Puedes añadir más herramientas/agentes especializados aquí
const tools = [generalChatTool];

// --- ESTADO (Sin cambios) ---
interface OrchestratorState {
  messages: BaseMessage[];
}

// --- PROMPT DEL CEREBRO ORQUESTADOR ---
// ESTA ES LA ACTUALIZACIÓN CLAVE. Le damos al supervisor su personalidad y lógica.
const supervisorSystemPrompt = `Eres un 'cerebro' orquestador experto. Tu trabajo es gestionar una conversación entre un usuario y un equipo de agentes especializados (representados como herramientas).

1.  **Analiza:** Lee detenidamente el último mensaje del usuario y todo el historial de la conversación.
2.  **Orquesta:** Decide cuál de las siguientes opciones es la más adecuada:
    a. **Si la pregunta puede ser respondida directamente por un agente especializado**, llama a la herramienta correspondiente con los argumentos correctos.
    b. **Si el usuario está teniendo una conversación casual**, usa la herramienta 'general_chat_agent'.
    c. **Si ya has llamado a una herramienta y su respuesta (ToolMessage) es suficiente para contestar la pregunta del usuario**, no llames a más herramientas. En su lugar, responde directamente al usuario, sintetizando la información obtenida.
    d. **Si la respuesta de la herramienta no es suficiente**, puedes llamar a otra herramienta o a la misma de nuevo para refinar la búsqueda o la tarea.
3.  **Responde:** Tu respuesta final debe ser directa al usuario, no una llamada a una herramienta. Solo llama a herramientas cuando necesites obtener información de un especialista.`;


// --- NODOS DEL GRAFO ---
const supervisorNode = async (state: OrchestratorState) => {
  console.log("Cerebro Supervisor: Analizando estado y decidiendo siguiente acción...");
  const model = new ChatOpenAI({ model: "gpt-4o", temperature: 0 });
  
  // Se inserta el prompt del cerebro en el historial de mensajes
  const messagesWithSystemPrompt = [
    new HumanMessage(supervisorSystemPrompt),
    ...state.messages
  ];

  const modelWithTools = model.bindTools(tools);
  const response = await modelWithTools.invoke(messagesWithSystemPrompt);
  
  // El supervisor devuelve su "pensamiento" (que puede ser una respuesta final o una llamada a herramienta)
  return { messages: [response] };
};

const toolNode = async (state: OrchestratorState) => {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  const toolCall = lastMessage.tool_calls![0];
  console.log(`Cerebro Supervisor: Delego la tarea a la herramienta '${toolCall.name}'...`);
  const toolToUse = tools.find((tool) => tool.name === toolCall.name);
  if (!toolToUse) { throw new Error("Herramienta no encontrada"); }
  
  const output = await toolToUse.invoke(toolCall.args);

  return {
    messages: [new ToolMessage({ content: output, tool_call_id: toolCall.id! })],
  };
};

// --- LÓGICA CONDICIONAL Y GRAFO (Sin cambios) ---
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
workflow.setEntryPoint("supervisor");
workflow.addConditionalEdges("supervisor", shouldContinue);
workflow.addEdge("tools", "supervisor");

export const orchestratorApp = workflow.compile();