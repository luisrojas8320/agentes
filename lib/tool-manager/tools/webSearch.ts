// Ruta: lib/tool-manager/tools/webSearch.ts

import OpenAI from 'openai';
import { SupabaseClient } from '@supabase/supabase-js';

const definition: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Realiza una búsqueda general en la web para encontrar información.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'La consulta de búsqueda. Por ejemplo: "últimas noticias de la NASA".',
        },
      },
      required: ['query'],
    },
  },
};

const implementation = async (
  _supabase: SupabaseClient, 
  _userId: string,
  args: { query: string }
): Promise<string> => {
  if (!process.env.JINA_API_KEY) {
    return "Error: La API key de Jina AI no está configurada en el servidor.";
  }
  if (!args.query) {
    return "Error: Se requiere una consulta para realizar la búsqueda web.";
  }

  console.log(`[JINA SEARCH] Buscando: ${args.query}`);
  try {
    const searchUrl = `https://s.jina.ai/${encodeURIComponent(args.query)}`;

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        // =================================================================================
        // CORRECCIÓN: Añadir la cabecera de autorización.
        'Authorization': `Bearer ${process.env.JINA_API_KEY}`,
        // =================================================================================
        'Accept': 'application/json', // Pedir JSON para una respuesta más estructurada
      },
    });

    if (!response.ok) {
      throw new Error(`Jina AI Search API respondió con status ${response.status}`);
    }

    const result = await response.json();
    
    // Extraer y formatear los resultados
    const content = result.data?.map((item: any) => 
        `Título: ${item.title}\nURL: ${item.url}\nResumen: ${item.description}`
    ).join('\n\n---\n\n');

    if (!content) {
      return `La búsqueda de "${args.query}" no arrojó resultados.`;
    }

    console.log(`[JINA SEARCH] Resultados encontrados.`);
    const snippet = content.substring(0, 4000);

    return `
      Se encontraron los siguientes resultados de la búsqueda web para "${args.query}":
      --- INICIO DE RESULTADOS ---
      ${snippet}
      --- FIN DE RESULTADOS ---
    `;

  } catch (e: any) {
    console.error(`[JINA SEARCH] Error al buscar:`, e);
    return `Error al intentar realizar la búsqueda web: ${e.message}`;
  }
};

export const webSearchTool = {
  definition,
  implementation,
};