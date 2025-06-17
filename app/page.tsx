"use client";
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function WelcomePage() {
  const router = useRouter();
  const startNewChat = () => {
    const newChatId = `chat_${Date.now()}`;
    router.push(`/chat/${newChatId}`);
  };
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#181818] text-white text-center">
      <h1 className="text-5xl font-bold">Playground de Agentes</h1>
      <p className="text-gray-400 text-xl mt-4">Arquitectura de IA con Python + Next.js</p>
      <Button 
        onClick={startNewChat} 
        className="mt-8 bg-blue-600 hover:bg-blue-700 text-lg py-6 px-8"
      >
        Iniciar Nuevo Chat <ArrowRight className="ml-2 h-5 w-5" />
      </Button>
    </div>
  );
}