import { StateGraph, END, START } from "@langchain/langgraph";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

// --- ESTADO DEL GRAFO ---
interface SimpleChatState {
  messages: BaseMessage[];
}

// --- NODO ÚNICO DEL GRAFO (CHATBOT SIMPLE) ---
async function chatNode(state: SimpleChatState) {
  console.log("[Graph] Ejecutando el nodo de chat simple...");
  
  const model = new ChatOpenAI({ model: "gpt-4o", temperature: 0.7 });
  
  // El modelo recibe el historial y genera una respuesta.
  const response = await model.invoke(state.messages);
  console.log("[Graph] El modelo ha respondido.");
  
  // Devolvemos el estado actualizado con la respuesta del AI.
  return { messages: [response] };
};


// --- DEFINICIÓN DEL GRAFO SIMPLIFICADO ---
const workflow = new StateGraph<SimpleChatState>({
  channels: {
    messages: {
      // 'value' coge el nuevo valor, 'default' es para el inicio.
      value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
      default: () => [],
    }
  }
});

// Añadimos nuestro único nodo.
workflow.addNode("chatbot", chatNode);
// El grafo empieza y termina en este nodo.
workflow.setEntryPoint("chatbot" as any);
workflow.addEdge("chatbot" as any, END);

// Compilamos el grafo.
export const orchestratorApp = workflow.compile();