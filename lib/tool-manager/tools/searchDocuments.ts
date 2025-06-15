// Ruta: lib/tool-manager/tools/searchDocuments.ts

import { SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { OpenAIEmbeddings } from "@langchain/openai";

type TextDocument = {
  content: string;
};

const embeddings = new OpenAIEmbeddings({
  modelName: "text-embedding-3-small",
  openAIApiKey: process.env.OPENAI_API_KEY,
});

const definition: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'search_documents',
    description: 'Busca en la base de conocimiento del usuario para encontrar información relevante y responder preguntas sobre ella.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'La pregunta o los términos de búsqueda del usuario sobre sus documentos. Por ejemplo: "¿de qué trata el último informe?" o "resumen del archivo sobre Marte".'
        }
      },
      required: ['query'],
    },
  },
};

// =================================================================================
// PASO 4: La nueva implementación de la herramienta.
// =================================================================================
const implementation = async (
  supabase: SupabaseClient,
  userId: string,
  // Ahora la herramienta recibe los argumentos enriquecidos desde la API de chat.
  args: { query: string; lastUploadedFileId?: string; chatId: string; }
): Promise<string> => {
  try {
    const { query, lastUploadedFileId, chatId } = args;
    let documents: TextDocument[] | null = null;
    let error: any = null;

    // --- Lógica de Búsqueda Mejorada ---

    // 1. Intenta la búsqueda semántica primero.
    const { data: matchedDocs, error: matchError } = await supabase.rpc('match_documents', {
      query_embedding: await embeddings.embedQuery(query),
      match_threshold: 0.5,
      match_count: 5,
      p_user_id: userId,
    });

    if (matchError) {
      console.error('Error en búsqueda semántica:', matchError);
      return `Error interno al buscar en los documentos: ${matchError.message}`;
    }

    documents = matchedDocs;

    // 2. PLAN B: Si la búsqueda semántica no devuelve resultados Y tenemos un ID de archivo reciente...
    if ((!documents || documents.length === 0) && lastUploadedFileId) {
      console.log(`[SEARCH] Búsqueda semántica vacía. Usando Plan B: recuperando documento reciente ID: ${lastUploadedFileId}`);
      // Llama a la nueva función SQL para obtener los trozos por document_id.
      // ASUNCIÓN: Tu tabla 'documents' tiene la columna 'document_id'.
      const { data: recentDocs, error: recentDocsError } = await supabase
        .from('documents')
        .select('content')
        .eq('document_id', lastUploadedFileId)
        .eq('user_id', userId)
        .limit(10); // Límite para no sobrecargar el contexto

      if (recentDocsError) {
        console.error('Error recuperando documento reciente:', recentDocsError);
        // No devolvemos error, simplemente continuamos sin contexto del Plan B.
      } else {
        documents = recentDocs;
      }
    }
    
    // 3. Procesamiento final
    if (!documents || documents.length === 0) {
      return 'No se encontraron documentos relevantes que coincidan con tu pregunta. Por favor, sé más específico o sube el documento si aún no lo has hecho.';
    }

    const context = documents.map(doc => doc.content).join('\n\n---\n\n');
    
    return `
      Eres un asistente experto en análisis de documentos. A continuación se te proporciona un conjunto de fragmentos de texto relevantes para la pregunta de un usuario. Tu tarea es leer y comprender estos fragmentos para responder de forma clara y concisa a la pregunta del usuario.

      **Fragmentos de Contexto:**
      \`\`\`
      ${context}
      \`\`\`

      **Pregunta del Usuario:**
      "${query}"

      Basándote EXCLUSIVAMENTE en los fragmentos de contexto proporcionados, responde a la pregunta del usuario. Si los fragmentos no contienen la respuesta, indícalo claramente.
    `;
  } catch (e: any) {
    console.error(`Error en la ejecución de search_documents: ${e.message}`);
    return `Ocurrió un error inesperado al procesar la herramienta de búsqueda: ${e.message}`;
  }
};

export const searchDocumentsTool = {
  definition,
  implementation,
};