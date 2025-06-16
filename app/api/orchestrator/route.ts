import { StreamingTextResponse } from "ai";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { orchestratorApp } from "@/lib/graphs/orchestrator";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  console.log("--- Petición de Chat Real Recibida ---");

  try {
    const { messages } = await req.json();
    console.log("Invocando el grafo simplificado con el último mensaje:", messages[messages.length - 1].content);

    const langChainMessages = messages.map((m: any) => {
      return m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content);
    });
    
    // Invocamos nuestro nuevo y simple grafo.
    const chainResponse = await orchestratorApp.invoke({ messages: langChainMessages });

    const lastMessage = chainResponse.messages[chainResponse.messages.length - 1] as AIMessage;
    const responseContent = lastMessage.content as string;
    
    console.log("Respuesta del grafo:", responseContent);

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(responseContent);
        controller.close();
      },
    });

    return new StreamingTextResponse(stream);

  } catch (error: any) {
    console.error("ERROR en la ruta del orquestador:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}