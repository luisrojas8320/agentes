// Ruta: app/api/upload_image/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { createClient as createSupabaseServerClient } from '@/utils/supabase/server';
import { OpenAI } from 'openai';
// =================================================================================
// PASO 1.1: Importar la función para generar UUIDs.
import { v4 as uuidv4 } from 'uuid';
// =================================================================================

const supabaseAdmin = createSupabaseAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

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

    // 1. Subir la imagen (sin cambios)
    const filePath = `${user.id}/${file.name}-${Date.now()}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('images')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('images')
      .getPublicUrl(filePath);

    // 2. Describir la imagen (sin cambios)
    const visionResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Describe esta imagen con gran detalle para que pueda ser encontrada por una búsqueda de texto. Enfócate en objetos, acciones, texto y contexto." },
            { type: "image_url", image_url: { url: publicUrl } },
          ],
        },
      ],
    });
    const description = visionResponse.choices[0].message.content;
    if (!description) throw new Error('No se pudo generar una descripción para la imagen.');

    // 3. Generar embedding (sin cambios)
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: description,
    });
    const embedding = embeddingResponse.data[0].embedding;
    
    // =================================================================================
    // PASO 1.2: Generar un ID único para ESTA imagen.
    const imageId = uuidv4();
    // =================================================================================

    // 4. Guardar en la base de datos
    const { error: dbError } = await supabaseAdmin.from('image_documents').insert({
      // =================================================================================
      // PASO 1.3: Añadir el nuevo 'image_id'.
      // Recuerda que ya ejecutaste el ALTER TABLE para añadir esta columna.
      image_id: imageId,
      // =================================================================================
      user_id: user.id,
      chat_id: chatId,
      image_url: publicUrl,
      description: description,
      embedding: embedding,
    });
    if (dbError) throw dbError;

    // =================================================================================
    // PASO 1.4: Devolver el ID en la respuesta.
    // El frontend lo usará como 'documentId' (el nombre de la variable es genérico).
    return NextResponse.json({ 
      message: `Imagen "${file.name}" procesada.`,
      documentId: imageId, 
    });
    // =================================================================================

  } catch (error: any) {
    console.error('Error en API de subida de imagen:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}