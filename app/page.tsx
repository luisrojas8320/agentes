// Ruta: app/page.tsx

"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
// <-- CORRECCIÓN: Importar la nueva función para crear el cliente
import { createClient } from "@/utils/supabase/client"
import AgentItem from "@/components/AgentItem"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"

interface Agent {
  id: string
  name: string
  description: string
}

export default function HomePage() {
  // <-- CORRECCIÓN: Crear una instancia del cliente de Supabase
  const supabase = createClient()

  const { user, loading } = useAuth()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentsLoading, setAgentsLoading] = useState(true)
  const { toast } = useToast()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/login")
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && !loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router, mounted])

  useEffect(() => {
    if (!user) {
      setAgentsLoading(false)
      return
    }

    const fetchAgents = async () => {
      try {
        const { data, error } = await supabase.from("agents").select("*")

        if (error) {
          throw error
        }

        if (data) {
          setAgents(data as Agent[])
        }

      } catch (error: any) {
        console.error("Error fetching agents:", error)
        toast({
          title: "Error",
          description: "Failed to load agents. Please try again.",
          variant: "destructive",
        })
      } finally {
        setAgentsLoading(false)
      }
    }

    fetchAgents()
    // <-- CORRECCIÓN: Añadir supabase a las dependencias del efecto
  }, [user, toast, supabase])

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold">AI Playground</h1>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {agentsLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-10">
            <h2 className="text-xl font-semibold mb-2">No Agents Available</h2>
            <p className="text-gray-600">Add agents to your Supabase "agents" table.</p>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-bold mb-6">Available AI Agents</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agents.map((agent) => (
                <AgentItem key={agent.id} agent={agent} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}