// Ruta: supabase/functions/embed/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import * as Supabase from 'https://esm.sh/@supabase/supabase-js@2'

// Nueva forma oficial de crear embeddings
const session = new Supabase.ai.Session('gte-small');

serve(async (req) => {
  try {
    // Validación de seguridad para asegurar que solo usuarios autenticados la usen
    const authHeader = req.headers.get('Authorization')!
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }
    
    // Extraer el texto de entrada del cuerpo de la petición
    const { input } = await req.json();
    if (!input) {
      throw new Error('Missing "input" in request body');
    }

    // Generar el embedding
    const embedding = await session.run(input, {
      mean_pool: true, // normalización y pooling recomendados
      normalize: true,
    });

    // Devolver el embedding generado
    return new Response(JSON.stringify({ embedding }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
