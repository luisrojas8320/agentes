// Ruta: app/seo-writer/page.tsx

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";

export default function SeoWriterPage() {
  const [keywords, setKeywords] = useState("");
  const [article, setArticle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keywords.trim()) {
      toast({ title: "Error", description: "Por favor, introduce palabras clave.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setArticle("");

    try {
      const response = await fetch("/api/seo_writer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      
      setArticle(result.article);
      toast({ title: "Éxito", description: "Artículo generado." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold">Herramienta de Redacción SEO</h1>
          <Button variant="outline" size="sm" onClick={() => router.push('/')}>
            Volver a Agentes
          </Button>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="keywords" className="block text-sm font-medium text-gray-700">Palabra Clave Principal</label>
              <Input
                id="keywords"
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="Ej: 'mejores zapatillas para correr en 2025'"
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Generando..." : "Generar Artículo"}
            </Button>
          </form>
        </div>

        {isLoading && (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
          </div>
        )}

        {article && (
          <div className="mt-6 bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">Artículo Generado</h2>
            {/* Usamos un Textarea para mostrar el Markdown y facilitar el copiado */}
            <Textarea 
              readOnly 
              value={article} 
              className="min-h-[500px] font-mono text-sm" 
            />
            <Button 
              className="mt-4"
              onClick={() => {
                navigator.clipboard.writeText(article);
                toast({ description: "Artículo copiado al portapapeles." });
              }}
            >
              Copiar Artículo
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}