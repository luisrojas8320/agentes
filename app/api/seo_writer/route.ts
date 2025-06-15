// Ruta: app/api/seo_writer/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateChatCompletion } from '@/lib/llm/llm_service';

export async function POST(request: NextRequest) {
  const supabase = createClient();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const { keywords } = await request.json();
    if (!keywords) {
      return NextResponse.json({ error: 'Faltan las palabras clave.' }, { status: 400 });
    }

    // Obtener la configuración del agente SEO de la base de datos
    const { data: agentData, error } = await supabase
      .from('agents')
      .select('*')
      .eq('name', 'Redactor SEO Técnico') // Buscamos por el nombre único
      .single();

    if (error || !agentData) {
      throw new Error('No se pudo encontrar la configuración del agente Redactor SEO.');
    }

    // --- Proceso de Generación Multi-paso ---
    console.log(`[SEO Writer] Iniciando generación para keywords: "${keywords}" con ${agentData.model_name}`);

    // Paso 1: Generar el artículo completo
    const articleResponse = await generateChatCompletion({
      provider: agentData.model_provider,
      model: agentData.model_name,
      messages: [
        { role: 'system', content: agentData.system_prompt },
        { role: 'user', content: `La palabra clave principal es: "${keywords}"` }
      ]
    });

    const article = articleResponse.choices[0].message.content;

    return NextResponse.json({ article });

  } catch (error: any) {
    console.error('Error en API de Redactor SEO:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}