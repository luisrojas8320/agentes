import { NextResponse } from 'next/server';
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { orchestratorApp } from "@/lib/graphs/orchestrator";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  console.log("--- Petición de Chat (Prueba JSON) ---");

  try {
    const { messages } = await req.json();
    console.log("Invocando el grafo simplificado con el último mensaje:", messages[messages.length - 1].content);

    const langChainMessages = messages.map((m: any) => {
      return m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content);
    });
    
    const chainResponse = await orchestratorApp.invoke({ messages: langChainMessages });

    const lastMessage = chainResponse.messages[chainResponse.messages.length - 1] as AIMessage;
    const responseContent = lastMessage.content as string;
    
    console.log("Respuesta generada por el grafo:", responseContent);

    // DEVOLVEMOS UNA RESPUESTA JSON EN LUGAR DE UN STREAM
    return NextResponse.json({
      response: responseContent
    });

  } catch (error: any) {
    console.error("ERROR en la ruta del orquestador:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}