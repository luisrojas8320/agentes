// Ruta: lib/tool-manager/index.ts

import { SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { ToolMessage } from '@langchain/core/messages';

// La interfaz para definir una herramienta no cambia.
export interface Tool {
  definition: OpenAI.Chat.Completions.ChatCompletionTool;
  implementation: (supabase: SupabaseClient, userId: string, args: any) => Promise<string>;
}

// =================================================================================
// REGISTRO DE HERRAMIENTAS
// ¡Asegúrate de que este objeto esté lleno con tus herramientas reales!
// =================================================================================
const toolRegistry: { [key: string]: Tool } = {
  // Ejemplo: Herramienta para buscar en la web
  search_web: {
    definition: {
      type: "function",
      function: {
        name: "search_web",
        description: "Realiza una búsqueda en la web para obtener información actualizada sobre un tema.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "El término o la pregunta a buscar en la web.",
            },
          },
          required: ["query"],
        },
      },
    },
    implementation: async (supabase, userId, args) => {
      console.log(`Ejecutando búsqueda web para: ${args.query}`);
      // Aquí iría tu lógica real para buscar en la web.
      // Devolvemos un resultado de ejemplo.
      return `Resultados de la búsqueda para "${args.query}": La IA está transformando el mundo y la depuración de código es un arte.`;
    },
  },
  // ... puedes añadir más herramientas aquí
};
// =================================================================================


/**
 * Gestiona la definición y ejecución de herramientas para el agente.
 */
class ToolManager {
  private supabase: SupabaseClient;
  private userId: string;
  // Mapeo de nombre de herramienta a su función de implementación.
  private toolImplementations: Record<string, Tool['implementation']>;

  constructor(supabase: SupabaseClient, userId: string) {
    this.supabase = supabase;
    this.userId = userId;
    
    // Creamos un mapa de implementaciones para un acceso rápido.
    this.toolImplementations = Object.entries(toolRegistry).reduce((acc, [name, tool]) => {
      acc[name] = tool.implementation;
      return acc;
    }, {} as Record<string, Tool['implementation']>);
  }

  /**
   * Devuelve las definiciones de las herramientas en el formato que espera OpenAI.
   */
  public getToolDefinitions(): OpenAI.Chat.Completions.ChatCompletionTool[] {
    return Object.values(toolRegistry).map(tool => tool.definition);
  }

  /**
   * Ejecuta una herramienta por su nombre y argumentos, y devuelve un ToolMessage.
   */
  public async executeTool(toolCall: { name: string; args: any; id: string }): Promise<ToolMessage> {
    const { name, args, id } = toolCall;
    
    const implementation = this.toolImplementations[name];
    if (!implementation) {
      throw new Error(`Herramienta "${name}" no encontrada.`);
    }

    try {
      const content = await implementation(this.supabase, this.userId, args);
      return new ToolMessage({ content, tool_call_id: id });
    } catch (error: any) {
      console.error(`Error ejecutando la herramienta "${name}":`, error);
      const content = `Error al ejecutar la herramienta: ${error.message}`;
      return new ToolMessage({ content, tool_call_id: id });
    }
  }
}

export default ToolManager;
