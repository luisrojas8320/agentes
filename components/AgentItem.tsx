"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MessageSquare, Wrench } from "lucide-react"

// La definición de las propiedades del agente sigue siendo la misma.
interface AgentItemProps {
  agent: {
    id: string
    name: string
    description: string
    tool_url?: string | null;
  }
}

export default function AgentItem({ agent }: AgentItemProps) {
  const router = useRouter()

  const handleAction = () => {
    // Si el agente tiene una URL de herramienta, navegar a ella.
    if (agent.tool_url) {
      router.push(agent.tool_url);
    } else {
      // CORRECCIÓN: Si no, simplemente navega a una nueva sesión de chat.
      // La lógica para crear el chat en la base de datos ya no vive aquí.
      // Se gestiona en la página principal o en la propia interfaz del chat.
      const newChatId = `chat_${Date.now()}`;
      router.push(`/chat/${newChatId}`);
    }
  }

  return (
    <Card className="h-full flex flex-col bg-gray-800/20 border-gray-700 text-white">
      <CardHeader>
        <CardTitle className="text-white">{agent.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-gray-400">{agent.description}</p>
      </CardContent>
      <CardFooter>
        <Button onClick={handleAction} className="w-full bg-blue-600 hover:bg-blue-700">
          {agent.tool_url ? (
            <>
              <Wrench className="h-4 w-4 mr-2" />
              Abrir Herramienta
            </>
          ) : (
            <>
              <MessageSquare className="h-4 w-4 mr-2" />
              Conversar
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}