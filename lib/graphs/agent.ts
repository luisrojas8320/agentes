import { StateGraph, END, START } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { BaseMessage } from "@langchain/core/messages";
import { createOpenAIToolsAgent, AgentExecutor } from "langchain/agents";
import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { AgentStep } from "@langchain/core/agents";

// --- Definición de la herramienta (sin cambios) ---
const capitalCityTool = new DynamicStructuredTool({
  name: "get_capital_city",
  description: "Devuelve la capital de un país.",
  schema: z.object({
    country: z.string().describe("El nombre del país para buscar su capital."),
  }),
  func: async ({ country }) => {
    const capitals: Record<string, string> = {
      francia: "París",
      españa: "Madrid",
      ecuador: "Quito",
    };
    const normalizedCountry = country.toLowerCase().trim();
    const capital = capitals[normalizedCountry];
    if (capital) {
      return `La capital de ${country} es ${capital}.`;
    }
    return `No se encontró la capital para ${country}.`;
  },
});

// --- Estado y Nodo ---
// Se actualiza 'steps' al tipo correcto 'AgentStep'
interface AgentState {
  input: string;
  chat_history: BaseMessage[];
  agent_outcome: any;
  steps: AgentStep[];
}

// El nodo ahora usa las abstracciones de alto nivel de LangChain correctamente
async function runAgentNode(state: AgentState) {
  const { input, chat_history } = state;
  const tools = [capitalCityTool];
  // Asegúrate de tener la variable de entorno OPENAI_API_KEY configurada
  const llm = new ChatOpenAI({ modelName: "gpt-4-turbo", temperature: 0 });

  const agentPrompt = ChatPromptTemplate.fromMessages([
    ["system", "Eres un asistente servicial."],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  // 'createOpenAIToolsAgent' crea el agente runnable con el formato correcto
  const agent = await createOpenAIToolsAgent({
    llm,
    tools,
    prompt: agentPrompt,
  });

  const agentExecutor = new AgentExecutor({
    agent,
    tools,
  });

  // 'invoke' del executor ya maneja los pasos (steps) internamente
  const result = await agentExecutor.invoke({
    input,
    chat_history,
  });

  return { agent_outcome: result.output };
}

// --- Grafo (sin cambios) ---
const workflow = new StateGraph<AgentState>({
  channels: {
    input: { value: (x, y) => y },
    chat_history: {
        // Asegura que el historial de chat se acumule correctamente si es necesario
        value: (x, y) => x.concat(y),
        default: () => [],
    },
    agent_outcome: { value: (x, y) => y },
    // 'steps' ahora se alinea con el tipo AgentStep
    steps: { value: (x, y) => x.concat(y), default: () => [] },
  },
});

workflow.addNode("agent", runAgentNode);

// Define el punto de entrada para el grafo.
// START es una constante exportada por @langchain/langgraph
workflow.addEdge(START, "agent");
workflow.addEdge("agent", END);

export const agentGraph = workflow.compile();