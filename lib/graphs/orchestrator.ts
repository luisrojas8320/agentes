// ruta: lib/graphs/orchestrator.ts
import { StateGraph, END, START } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage, BaseMessage } from "@langchain/core/messages";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";

interface OrchestratorState {
  messages: BaseMessage[];
}

// Esta función ahora es una "fábrica" de grafos.
// Recibe las herramientas como argumento en lugar de crearlas.
export function createOrchestratorGraph(tools: DynamicStructuredTool[]) {
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
        default: () => [],
      },
    },
  });

  workflow.addNode("supervisor", supervisorNode as any);
  workflow.addNode("tools", toolNode as any);

  workflow.setEntryPoint("supervisor" as any);
  
  workflow.addConditionalEdges("supervisor" as any, shouldContinue, {
    tools: "tools" as any,
    [END]: END,
  });

  workflow.addEdge("tools" as any, "supervisor" as any);
  
  console.log("Grafo del orquestador compilado bajo demanda.");
  return workflow.compile();
}