import { StateGraph, END, START } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { BaseMessage } from "@langchain/core/messages";
import { AgentExecutor } from "langchain/agents";
import { RunnableSequence, RunnableLambda } from "@langchain/core/runnables";
import { formatToOpenAIToolMessages } from "langchain/agents/format_scratchpad/openai_tools";
import { OpenAIToolsAgentOutputParser } from "langchain/agents/openai/output_parser";
import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";

// --- Definición de la herramienta ---
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

// --- Estado y nodo ---
interface AgentState {
  input: string;
  chat_history: BaseMessage[];
  agent_outcome: any;
  steps: Array<any>;
}

async function runAgentNode(state: AgentState) {
  const { input, chat_history } = state;
  const tools = [capitalCityTool];
  const llm = new ChatOpenAI({ modelName: "gpt-4-turbo", temperature: 0 });

  const agentPrompt = ChatPromptTemplate.fromMessages([
    ["system", "Eres un asistente servicial."],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  // Runnable que convierte promptValue a { messages: [...] }
  const promptToMessagesRunnable = RunnableLambda.from(async (promptValue: any) => ({
    messages: await agentPrompt.format(promptValue),
  }));

  // Obtenemos el runnable directamente sin .toRunnable()
  const llmRunnable = llm.bindTools(tools);

  // Secuencia que primero convierte el prompt y luego ejecuta el LLM con herramientas
  const agentWithTools = RunnableSequence.from([
    promptToMessagesRunnable,
    llmRunnable,
  ]);

  const agent = RunnableSequence.from([
    {
      input: (i: { input: string; steps: BaseMessage[]; chat_history: BaseMessage[] }) => i.input,
      agent_scratchpad: (i: { input: string; steps: BaseMessage[]; chat_history: BaseMessage[] }) =>
        formatToOpenAIToolMessages(i.steps),
      chat_history: (i: { input: string; steps: BaseMessage[]; chat_history: BaseMessage[] }) => i.chat_history,
    },
    agentWithTools,
    new OpenAIToolsAgentOutputParser(),
  ]);

  const agentExecutor = new AgentExecutor({ agent, tools });
  const result = await agentExecutor.invoke({
    input,
    chat_history,
    steps: [],
  });

  return { agent_outcome: result.output };
}

// --- Grafo ---
const workflow = new StateGraph<AgentState>({
  channels: {
    input: { value: (x, y) => y },
    chat_history: { value: (x, y) => y },
    agent_outcome: { value: (x, y) => y },
    steps: { value: (x, y) => x.concat(y), default: () => [] },
  },
});

workflow.addNode("agent", runAgentNode);
workflow.setEntryPoint(START);
workflow.addEdge(START, "agent");
workflow.addEdge("agent", END);

export const agentGraph = workflow.compile();
