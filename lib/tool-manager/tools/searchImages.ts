// Ruta: lib/tool-manager/tools/searchImages.ts

import { SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { OpenAIEmbeddings } from "@langchain/openai";

type ImageDocument = {
    image_url: string;
};

const embeddings = new OpenAIEmbeddings({
  modelName: "text-embedding-3-small",
  openAIApiKey: process.env.OPENAI_API_KEY,
});

const definition: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'search_images',
    description: 'Busca una imagen relevante en la biblioteca del usuario para responder preguntas visuales o sobre el contenido de una imagen.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Descripción de la imagen a buscar. Por ej., "foto del módulo en Marte" o "diagrama del sistema de soporte vital".'
        }
      },
      required: ['query'],
    },
  },
};

const implementation = async (
  supabase: SupabaseClient,
  userId: string,
  // La herramienta ahora recibe los argumentos enriquecidos.
  args: { query: string; lastUploadedFileId?: string; }
): Promise<string> => {
  try {
    const { query, lastUploadedFileId } = args;
    let image: ImageDocument | null = null;

    // --- Lógica de Búsqueda Mejorada ---

    // 1. Intenta la búsqueda semántica primero.
    const { data: matchedImage, error: matchError } = await supabase.rpc('match_image_documents', {
        query_embedding: await embeddings.embedQuery(query),
        match_threshold: 0.5,
        match_count: 1,
        p_user_id: userId,
      })
      .single();

    if (matchError) {
      console.error('Error en búsqueda semántica de imagen:', matchError);
    } else {
      image = matchedImage as ImageDocument;
    }

    // 2. PLAN B: Si la búsqueda semántica no devuelve nada Y tenemos un ID de archivo reciente...
    if (!image && lastUploadedFileId) {
      console.log(`[SEARCH IMG] Búsqueda semántica vacía. Usando Plan B: recuperando imagen reciente ID: ${lastUploadedFileId}`);
      // ASUNCIÓN: Tu tabla 'image_documents' tiene la columna 'image_id'.
      const { data: recentImage, error: recentError } = await supabase
        .from('image_documents')
        .select('image_url')
        .eq('image_id', lastUploadedFileId)
        .eq('user_id', userId)
        .single();
      
      if (recentError) {
        console.error('Error recuperando imagen reciente:', recentError);
      } else {
        image = recentImage;
      }
    }

    // 3. Procesamiento final
    if (!image || !image.image_url) {
      return 'No se encontró una imagen relevante en la base de conocimiento visual. Informa al usuario que no encontraste una imagen que coincida.';
    }

    const imageUrl = image.image_url;
    // El formato de respuesta no cambia, ya que la API de chat lo maneja bien.
    return `[IMAGEN ENCONTRADA]\nLa URL de la imagen es:\nURL: ${imageUrl}`;
  } catch (e: any) {
    console.error(`Error en la ejecución de search_images: ${e.message}`);
    return `Error en la ejecución de la herramienta search_images: ${e.message}`;
  }
};

export const searchImagesTool = {
  definition,
  implementation,
};