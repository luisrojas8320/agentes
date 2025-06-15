// Ruta: lib/tool-manager/tools/shell.ts
import OpenAI from 'openai';
import { SupabaseClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

const definition: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'execute_shell_command',
    description: 'Ejecuta un comando de terminal (shell/bash) en el entorno del servidor.',
    parameters: {
      type: 'object',
      properties: { command: { type: 'string', description: 'El comando a ejecutar. Ej: "ls -la"' } },
      required: ['command'],
    },
  },
};

const implementation = async (
  _supabase: SupabaseClient, 
  _userId: string,
  args: { command: string }
): Promise<string> => {
  try {
    if (!args.command) {
      throw new Error("Se requiere un comando para ejecutar.");
    }
    const { stdout, stderr } = await execPromise(args.command);
    if (stderr) {
      console.error(`STDERR from ${args.command}:`, stderr);
      return `Error al ejecutar el comando: ${stderr}`;
    }
    return stdout || "Comando ejecutado con éxito, sin salida de texto.";
  } catch (e: any) {
    console.error(`Error en la ejecución de execute_shell_command: ${e.message}`);
    return `Error al ejecutar el comando: ${e.message}`;
  }
};

export const shellTool = {
  definition,
  implementation,
};