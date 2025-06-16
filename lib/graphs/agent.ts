import { StateGraph, END } from "@langchain/langgraph";
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

interface AgentState {
  input: string;
  chat_history: BaseMessage[];
  agent_outcome: any;
  steps: AgentStep[];
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

  const agent = await createOpenAIToolsAgent({
    llm,
    tools,
    prompt: agentPrompt,
  });

  const agentExecutor = new AgentExecutor({
    agent,
    tools,
  });

  const result = await agentExecutor.invoke({
    input,
    chat_history,
  });

  return { agent_outcome: result.output };
}

const workflow = new StateGraph<AgentState>({
  channels: {
    input: { value: (x, y) => y },
    chat_history: {
      value: (x, y) => x.concat(y),
      default: () => [],
    },
    agent_outcome: { value: (x, y) => y },
    steps: { value: (x, y) => x.concat(y), default: () => [] },
  },
});

workflow.addNode("agent", runAgentNode);
workflow.setEntryPoint("agent" as any);
// CORRECCIÓN FINAL:
workflow.addEdge("agent" as any, END);

export const agentGraph = workflow.compile();