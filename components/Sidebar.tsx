"use client";

import { Button } from "@/components/ui/button";
import { HardDrive, Heart, Plus, Share2, Star, User } from "lucide-react";

export default function Sidebar() {
  const menuItems = [
    { name: "Creación de sistema de agente...", icon: HardDrive },
    { name: "Plan de Contenidos para Posici...", icon: Star },
  ];

  return (
    <aside className="w-1/4 min-w-[280px] max-w-[320px] bg-[#111111] text-gray-300 flex flex-col p-4">
      <div className="flex-grow">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">manus</h1>
        </div>
        <Button className="w-full bg-white text-black hover:bg-gray-200">
          <Plus className="mr-2 h-4 w-4" />
          Nueva tarea
        </Button>
        <nav className="mt-6">
          <ul className="space-y-2">
            <li>
              <a href="#" className="flex items-center p-2 text-base font-normal text-white bg-[#1e1e1e] rounded-lg">
                Todo
              </a>
            </li>
            <li>
              <a href="#" className="flex items-center p-2 text-base font-normal rounded-lg hover:bg-[#1e1e1e]">
                Favoritos
              </a>
            </li>
            <li>
              <a href="#" className="flex items-center p-2 text-base font-normal rounded-lg hover:bg-[#1e1e1e]">
                Programado
              </a>
            </li>
          </ul>
        </nav>
        <div className="mt-8">
          {menuItems.map((item, index) => (
            <a key={index} href="#" className="flex items-center p-2 text-sm text-gray-400 hover:text-white rounded-lg">
              <item.icon className="h-4 w-4 mr-3" />
              <span>{item.name}</span>
            </a>
          ))}
        </div>
      </div>
      <div className="flex-shrink-0">
         <div className="p-3 rounded-lg hover:bg-[#1e1e1e] cursor-pointer mb-2">
            <p className="font-semibold text-white">Comparte Manus con un amigo</p>
            <p className="text-sm text-gray-400">Obtén 500 créditos cada uno</p>
         </div>
         <div className="flex items-center p-2">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center mr-3">
                <User className="h-5 w-5 text-white" />
            </div>
            <span className="font-semibold text-white">Luis Rojas</span>
         </div>
      </div>
    </aside>
  );
}