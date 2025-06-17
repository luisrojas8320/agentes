// ruta: scripts/cache-agents.mjs
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Solución: Apuntar explícitamente al archivo .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

console.log('Iniciando script de cache de agentes...');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: No se encontraron las variables de entorno de Supabase.');
  console.error('Asegúrate de que NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY estén en tu archivo .env.local');
  throw new Error('Variables de entorno de Supabase no definidas.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fetchAndCacheAgents() {
  console.log('Obteniendo agentes desde Supabase...');
  
  const { data: agents, error } = await supabase.from('agents').select('*');

  if (error) {
    console.error('Error al obtener agentes:', error);
    process.exit(1);
  }

  if (!agents || agents.length === 0) {
    console.warn('Advertencia: No se encontraron agentes en la base de datos. Se creará un cache vacío.');
  }

  const outputPath = path.join(process.cwd(), 'lib', 'agents-cache.json');
  fs.writeFileSync(outputPath, JSON.stringify(agents || [], null, 2));
  
  console.log(`Éxito: ${agents ? agents.length : 0} agentes guardados en cache en ${outputPath}`);
}

fetchAndCacheAgents();