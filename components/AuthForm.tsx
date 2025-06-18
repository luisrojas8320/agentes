// Ruta: components/AuthForm.tsx

"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client" // <-- Usa nuestro nuevo helper
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card"
import { Mail, Lock } from "lucide-react"
import { useToast } from "./ui/use-toast"

export default function AuthForm() {
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSignUp, setIsSignUp] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (isSignUp) {
        // --- Lógica de Registro (Sign Up) ---
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        toast({
          title: "¡Cuenta creada!",
          description: "Revisa tu correo electrónico para confirmar tu cuenta antes de iniciar sesión.",
        });
        // Limpiamos el formulario para una mejor UX
        setEmail("");
        setPassword("");
        setIsSignUp(false); // Regresamos al modo Sign In

      } else {
        // --- Lógica de Inicio de Sesión (Sign In) ---
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        // --- CORRECCIÓN CLAVE ---
        // Refresca la página. Esto permite que el middleware detecte la nueva sesión
        // y redirija al usuario a la página principal ('/') de forma segura.
        router.refresh();
      }

    } catch (error: any) {
      console.error("Error de autenticación:", error);
      toast({
        title: "Error de Autenticación",
        description: error.message || "Ocurrió un error inesperado.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-sm border-gray-700 bg-transparent text-white">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{isSignUp ? "Crear una cuenta" : "Iniciar Sesión"}</CardTitle>
        <CardDescription className="text-gray-400">
          {isSignUp ? "Ingresa tus datos para registrarte." : "Bienvenido de nuevo."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              className="pl-9 bg-[#111111] border-gray-600 focus:border-blue-500"
              type="email"
              placeholder="email@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              className="pl-9 bg-[#111111] border-gray-600 focus:border-blue-500"
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
            {isLoading ? "Procesando..." : isSignUp ? "Crear Cuenta" : "Iniciar Sesión"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <Button variant="link" className="text-sm text-gray-400 hover:text-white" onClick={() => setIsSignUp(!isSignUp)} disabled={isLoading}>
          {isSignUp ? "¿Ya tienes una cuenta? Inicia Sesión" : "¿No tienes una cuenta? Regístrate"}
        </Button>
      </CardFooter>
    </Card>
  );
}