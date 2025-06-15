// RUTA: lib/graphs/agent.ts

import { StateGraph, END } from "@langchain/langgraph";
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
import { DynamicStructuredTool } from "@langchain/core/tools";

// --- 1. DEFINIR LA HERRAMIENTA CON ZOD (MÉTODO MODERNO Y ROBUSTO) ---
const capitalCityTool = new DynamicStructuredTool({
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

  const agent = RunnableSequence.from([
    {
      input: (i) => i.input,
      agent_scratchpad: (i) => formatToOpenAIToolMessages(i.steps),
      chat_history: (i) => i.chat_history,
    },
    ChatPromptTemplate.fromMessages([
      ["system", "Eres un asistente servicial."],
      new MessagesPlaceholder("chat_history"),
      ["human", "{input}"],
      new MessagesPlaceholder("agent_scratchpad"),
    ]),
    llm.bindTools(tools),
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

// --- GRAFO (Sin cambios, ahora debería funcionar) ---
const workflow = new StateGraph<AgentState>({
  channels: {
    input: { value: (x, y) => y },
    chat_history: { value: (x, y) => y },
    agent_outcome: { value: (x, y) => y },
    steps: { value: (x, y) => x.concat(y), default: () => [] },
  },
});

workflow.addNode("agent", runAgentNode);
workflow.setEntryPoint("agent");
workflow.addEdge("agent", END);

export const agentGraph = workflow.compile();