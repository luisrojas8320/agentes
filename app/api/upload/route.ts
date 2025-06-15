// RUTA: app/api/upload/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { createClient as createSupabaseServerClient } from '@/utils/supabase/server';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { OpenAIEmbeddings } from "@langchain/openai";
import { v4 as uuidv4 } from 'uuid';
// FIX: Se importa 'pdf-parse' directamente para evitar el problemático PDFLoader
import pdf from 'pdf-parse';

// Se eliminó la importación del tipo 'Document' porque ya no usamos loader.load()

const supabaseAdmin = createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const embeddings = new OpenAIEmbeddings();

async function performOCR(file: File): Promise<string> {
  // ... (sin cambios en esta función)
  console.log('[OCR] Iniciando OCR para el archivo:', file.name);
  const formData = new FormData();
  formData.append('file', file);
  formData.append('apikey', process.env.OCR_SPACE_API_KEY!);
  formData.append('language', 'spa');
  const response = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body: formData });
  const result = await response.json();
  if (!result.OCRExitCode || result.OCRExitCode !== 1 || !result.ParsedResults?.[0]?.ParsedText) {
    console.error("Error de OCR o texto no encontrado:", result.ErrorMessage);
    throw new Error(`Error de OCR: ${result.ErrorMessage || 'No se pudo extraer texto.'}`);
  }
  console.log('[OCR] OCR completado con éxito.');
  return result.ParsedResults[0].ParsedText;
}

/**
 * Procesa un archivo (PDF o texto), extrae su contenido y lo divide en trozos.
 */
async function processAndSplitDocument(file: File): Promise<string[]> {
  let rawText: string | null = null;

  if (file.type.includes('pdf')) {
    // FIX: Se reemplaza PDFLoader con el uso directo de pdf-parse.
    console.log('[PROCESS] Procesando PDF con pdf-parse...');
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const pdfData = await pdf(buffer);
    const pdfText = pdfData.text.trim();

    if (pdfText.length < 100) {
      console.log('[PROCESS] PDF con poco texto, intentando OCR.');
      try {
        rawText = await performOCR(file);
      } catch (ocrError) {
        console.error("OCR falló, usando el poco texto del PDF si existe:", ocrError);
        rawText = pdfText;
      }
    } else {
      rawText = pdfText;
    }
  } else {
    console.log('[PROCESS] Leyendo archivo de texto plano directamente.');
    rawText = await file.text();
  }

  if (!rawText || rawText.trim().length === 0) {
    throw new Error("No se pudo extraer texto del documento.");
  }

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const chunks = await textSplitter.splitText(rawText);
  return chunks;
}


/**
 * Endpoint POST para subir un archivo, procesarlo, generar embeddings
 * y guardar los trozos en la base de datos de Supabase.
 */
export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const chatId = formData.get('chatId') as string | null;

    if (!file || !chatId) {
      return NextResponse.json({ error: 'Faltan archivo o chatId.' }, { status: 400 });
    }

    const chunks = await processAndSplitDocument(file);
    console.log(`[UPLOAD] Documento procesado, ${chunks.length} trozos creados.`);
    
    const chunkEmbeddings = await embeddings.embedDocuments(chunks);
    const documentId = uuidv4(); 

    const documentsToInsert = chunks.map((chunk, i) => ({
      document_id: documentId,
      content: chunk,
      chat_id: chatId,
      user_id: user.id,
      embedding: chunkEmbeddings[i] as any,
    }));

    const { error: dbError } = await supabaseAdmin.from('documents').insert(documentsToInsert);
    if (dbError) throw dbError;

    return NextResponse.json({ 
      message: `Archivo "${file.name}" procesado.`,
      documentId: documentId 
    });

  } catch (error: any) {
    console.error('Error en API de subida:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}