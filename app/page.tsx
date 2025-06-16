"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Code, Link, Mic, Play, ScanSearch, Wand2 } from "lucide-react";
import Sidebar from "@/components/Sidebar";

export default function HomePage() {
  return (
    <div className="flex h-screen bg-[#181818] text-white">
      <Sidebar />
      <main className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-3xl flex flex-col items-center">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold">Hola Luis Rojas</h1>
            <p className="text-gray-400 text-xl mt-2">¿Qué puedo hacer por ti?</p>
          </div>

          <div className="w-full bg-[#111111] border border-gray-700 rounded-lg p-4">
            <Textarea
              className="bg-transparent border-0 text-base resize-none focus:ring-0 focus-visible:ring-offset-0 focus-visible:ring-0"
              placeholder="Asigna una tarea o pregunta cualquier cosa"
              rows={5}
            />
            <div className="flex justify-between items-center mt-4">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                  <Link className="h-5 w-5" />
                </Button>
                {/* Placeholder para otros botones de herramientas */}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500">816 + 300</span>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                  <Mic className="h-5 w-5" />
                </Button>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Crear
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-8">
            <Button variant="secondary" className="bg-[#222222] hover:bg-[#2a2a2a]">
              <Wand2 className="mr-2 h-4 w-4" /> Crear
            </Button>
            <Button variant="secondary" className="bg-[#222222] hover:bg-[#2a2a2a]">
              <ScanSearch className="mr-2 h-4 w-4" /> Analizar
            </Button>
            <Button variant="secondary" className="bg-[#222222] hover:bg-[#2a2a2a]">
              Investigación
            </Button>
            <Button variant="secondary" className="bg-[#222222] hover:bg-[#2a2a2a]">
              <Code className="mr-2 h-4 w-4" /> Código
            </Button>
            <Button variant="secondary" className="bg-[#222222] hover:bg-[#2a2a2a]">
              <Play className="mr-2 h-4 w-4" /> Playbook
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}