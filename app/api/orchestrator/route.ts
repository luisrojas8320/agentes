import { StreamingTextResponse, LangChainAdapter } from "ai";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { orchestratorApp } from "@/lib/graphs/orchestrator";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Mapeamos los mensajes del historial al formato que espera LangChain.
  const langChainMessages = messages.map((m: any) => {
    if (m.role === "user") {
      return new HumanMessage(m.content);
    }
    if (m.role === "assistant") {
      return new AIMessage(m.content);
    }
    // Podríamos añadir más tipos si el orquestador los manejara (ej. ToolMessage)
    return new HumanMessage(m.content);
  });
  
  // Invocamos el grafo orquestador con el historial de mensajes.
  const chainResponse = await orchestratorApp.invoke({ messages: langChainMessages });

  // Obtenemos la última respuesta del supervisor (el cerebro).
  // La respuesta final DEBE ser un AIMessage con contenido de texto.
  const lastMessage = chainResponse.messages[chainResponse.messages.length - 1] as AIMessage;
  const responseContent = lastMessage.content;

  // Creamos un stream de texto simple con la respuesta final.
  // En flujos más complejos, podríamos hacer stream de la salida del LLM directamente.
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(responseContent);
      controller.close();
    },
  });

  return new StreamingTextResponse(stream);
}