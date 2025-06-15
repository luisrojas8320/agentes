// RUTA: lib/graphs/agent.ts

import { StateGraph, END, START } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { BaseMessage } from "@langchain/core/messages";
import { AgentExecutor } from "langchain/agents";
import { RunnableSequence } from "@langchain/core/runnables";
import { formatToOpenAIToolMessages } from "langchain/agents/format_scratchpad/openai_tools";
import { OpenAIToolsAgentOutputParser } from "langchain/agents/openai/output_parser";
import { z } from "zod";
import { StructuredTool } from "@langchain/core/tools"; // CAMBIO AQUÍ: DynamicStructuredTool por StructuredTool

// --- 1. DEFINIR LA HERRAMIENTA CON ZOD (MÉTODO MODERNO Y ROBUSTO) ---
// CAMBIO AQUÍ: StructuredTool se usa directamente
const capitalCityTool = new StructuredTool({
  name: "get_capital_city",
  description: "Devuelve la capital de un país.",
  // El esquema Zod define los argumentos de entrada de forma estricta.
  schema: z.object({
    country: z.string().describe("El nombre del país para buscar su capital."),
  }),
  // La función que ejecuta la lógica. Recibe un objeto con los argumentos definidos en el esquema.
  func: async ({ country }) => {
    const capitals: { [key: string]: string } = {
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


// --- ESTADO Y NODO ---
interface AgentState {
  input: string;
  chat_history: BaseMessage[];
  agent_outcome: any;
  steps: Array<any>;
}

async function runAgentNode(state: AgentState) {
  const { input, chat_history } = state;
  const tools = [capitalCityTool]; // Usamos la nueva herramienta
  const llm = new ChatOpenAI({ modelName: "gpt-4-turbo", temperature: 0 });

  // Ajustar la construcción del agente para que los tipos sean compatibles.
  // La entrada al prompt necesita ser un mapa, y el LLM bindeado es el siguiente paso.
  const agentPrompt = ChatPromptTemplate.fromMessages([
    ["system", "Eres un asistente servicial."],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  const agentWithTools = agentPrompt.pipe(llm.bindTools(tools)); // Combinar el prompt con el LLM bindeado a herramientas

  const agent = RunnableSequence.from([
    {
      input: (i: { input: string; steps: BaseMessage[]; chat_history: BaseMessage[] }) => i.input,
      agent_scratchpad: (i: { input: string; steps: BaseMessage[]; chat_history: BaseMessage[] }) =>
        formatToOpenAIToolMessages(i.steps),
      chat_history: (i: { input: string; steps: BaseMessage[]; chat_history: BaseMessage[] }) => i.chat_history,
    },
    agentWithTools, // Ahora pasamos la secuencia de prompt y LLM bindeado
    new OpenAIToolsAgentOutputParser(),
  ]);

  const agentExecutor = new AgentExecutor({ agent, tools });
  const result = await agentExecutor.invoke({
    input: input,
    chat_history: chat_history,
    steps: [],
  });

  return { agent_outcome: result.output };
}

// --- GRAFO (Manteniendo la corrección para START/END) ---
const workflow = new StateGraph<AgentState>({
  channels: {
    input: { value: (x, y) => y },
    chat_history: { value: (x, y) => y },
    agent_outcome: { value: (x, y) => y },
    steps: { value: (x, y) => x.concat(y), default: () => [] },
  },
});

workflow.addNode("agent", runAgentNode);
workflow.setEntryPoint(START); // Punto de entrada es el nodo especial START
workflow.addEdge(START, "agent"); // Conectar START al nodo "agent"
workflow.addEdge("agent", END);

export const agentGraph = workflow.compile();