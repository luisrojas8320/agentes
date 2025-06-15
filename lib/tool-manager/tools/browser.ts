// Ruta: lib/tool-manager/tools/browser.ts

import OpenAI from 'openai';
import { SupabaseClient } from '@supabase/supabase-js';

const definition: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'browse_web_page',
    description: 'Navega a una página web y extrae su contenido principal en formato Markdown limpio. Útil para obtener información de artículos, blogs o documentación.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'La URL completa y válida de la página web a visitar. Debe empezar con http:// o https://',
        },
      },
      required: ['url'],
    },
  },
};

const implementation = async (
  _supabase: SupabaseClient, 
  _userId: string,
  args: { url: string }
): Promise<string> => {
  if (!args.url) {
    return "Error: Se requiere una URL para navegar.";
  }

  console.log(`[JINA READER] Navegando a: ${args.url}`);
  
  try {
    // La API de Jina Reader se llama prefijando la URL con "https://r.jina.ai/"
    const jinaUrl = `https://r.jina.ai/${args.url}`;

    const response = await fetch(jinaUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/plain', // Pedimos el contenido en texto plano (Markdown)
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Jina AI Reader API respondió con status ${response.status}: ${errorBody}`);
    }

    const mainContent = await response.text();

    if (!mainContent) {
      return `Error: No se pudo extraer contenido de texto de ${args.url}.`;
    }

    console.log(`[JINA READER] Contenido extraído con éxito. Longitud: ${mainContent.length} caracteres.`);
    
    // Devolvemos solo una porción para no exceder los límites de tokens.
    const snippet = mainContent.substring(0, 4000);

    return `
      Se ha extraído el siguiente contenido en formato Markdown de la página web ${args.url}:

      --- INICIO DEL CONTENIDO ---
      ${snippet}...
      --- FIN DEL CONTENIDO ---

      Ahora puedes usar esta información para responder a la pregunta del usuario.
    `;

  } catch (e: any) {
    console.error(`[JINA READER] Error al navegar a ${args.url}:`, e);
    return `Error al intentar acceder a la página web: ${e.message}`;
  }
};

export const browserTool = {
  definition,
  implementation,
};