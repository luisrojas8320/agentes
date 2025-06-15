// Ruta: components/AgentItem.tsx

"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { MessageSquare, Wrench } from "lucide-react" // Importar icono de herramienta
import { createClient } from "@/utils/supabase/client"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/components/ui/use-toast"

interface AgentItemProps {
  agent: {
    id: string
    name: string
    description: string
    tool_url?: string | null; // <-- Propiedad opcional para la URL de la herramienta
  }
}

export default function AgentItem({ agent }: AgentItemProps) {
  const supabase = createClient()
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()

  const handleAction = async () => {
    if (!user) {
      toast({ title: "Error", description: "Debes iniciar sesión.", variant: "destructive" });
      return;
    }

    // --- CORRECCIÓN: Lógica condicional ---
    // Si el agente tiene una URL de herramienta, navegar a ella.
    if (agent.tool_url) {
      router.push(agent.tool_url);
    } else {
      // Si no, iniciar un chat como antes.
      try {
        const { data, error } = await supabase
          .from("chats").insert({ user_id: user.id, agent_id: agent.id }).select().single();
        if (error) throw error;
        if (data) router.push(`/chat/${data.id}`);
      } catch (error: any) {
        toast({ title: "Error", description: "No se pudo iniciar el chat.", variant: "destructive" });
      }
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>{agent.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-gray-600">{agent.description}</p>
      </CardContent>
      <CardFooter>
        <Button onClick={handleAction} className="w-full">
          {/* Mostrar un botón diferente si es una herramienta */}
          {agent.tool_url ? (
            <>
              <Wrench className="h-4 w-4 mr-2" />
              Abrir Herramienta
            </>
          ) : (
            <>
              <MessageSquare className="h-4 w-4 mr-2" />
              Iniciar Chat
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}