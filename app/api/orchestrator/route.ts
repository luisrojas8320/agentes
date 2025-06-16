import { StreamingTextResponse } from "ai";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { orchestratorApp } from "@/lib/graphs/orchestrator";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  console.log("-----------------------------------------");
  console.log("[API /orchestrator] Petición recibida.");

  try {
    const { messages } = await req.json();
    console.log(`[API /orchestrator] Mensajes recibidos: ${messages.length}`);
    console.log("[API /orchestrator] Último mensaje de usuario:", messages[messages.length - 1].content);

    const langChainMessages = messages.map((m: any) => {
      return m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content);
    });

    console.log("[API /orchestrator] Iniciando invocación del grafo orquestador...");
    const chainResponse = await orchestratorApp.invoke({ messages: langChainMessages });
    console.log("[API /orchestrator] El grafo orquestador ha finalizado.");

    if (!chainResponse || !chainResponse.messages || chainResponse.messages.length === 0) {
      console.error("[API /orchestrator] ERROR: La respuesta del grafo está vacía o es inválida.");
      throw new Error("La respuesta del grafo orquestador está vacía.");
    }

    const lastMessage = chainResponse.messages[chainResponse.messages.length - 1];
    console.log("[API /orchestrator] Último mensaje de la cadena:", lastMessage);
    
    if (!(lastMessage instanceof AIMessage) || typeof lastMessage.content !== 'string') {
        console.error("[API /orchestrator] ERROR: La respuesta final no es un AIMessage con contenido de texto.");
        throw new Error("El agente no produjo una respuesta final de texto válida.");
    }

    const responseContent = lastMessage.content;
    console.log("[API /orchestrator] Respuesta final para el usuario:", responseContent);

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(responseContent);
        controller.close();
      },
    });

    console.log("[API /orchestrator] Devolviendo respuesta al cliente.");
    console.log("-----------------------------------------");
    return new StreamingTextResponse(stream);

  } catch (error: any) {
    console.error("[API /orchestrator] ERROR CATASTRÓFICO:", error);
    console.log("-----------------------------------------");
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}