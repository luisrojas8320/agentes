// Ruta: lib/tool-manager/tools/fileSystem.ts
import OpenAI from 'openai';
import { SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs/promises';
import * as path from 'path';

const readFileDefinition: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'read_file',
    description: 'Lee el contenido de un archivo.',
    parameters: {
      type: 'object',
      properties: { filePath: { type: 'string', description: 'La ruta del archivo a leer.' } },
      required: ['filePath'],
    },
  },
};

const writeFileDefinition: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'write_file',
    description: 'Escribe contenido en un archivo.',
    parameters: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'La ruta del archivo a escribir.' },
        content: { type: 'string', description: 'El contenido a escribir.' },
      },
      required: ['filePath', 'content'],
    },
  },
};

const listDirectoryDefinition: OpenAI.Chat.Completions.ChatCompletionTool = {
    type: 'function',
    function: {
      name: 'list_directory',
      description: 'Lista los archivos y carpetas en un directorio.',
      parameters: {
        type: 'object',
        properties: { dirPath: { type: 'string', description: 'La ruta del directorio a listar.' } },
        required: ['dirPath'],
      },
    },
  };

const implementationOptions = {
    basePath: path.resolve(process.cwd(), 'agent_workspace'),
    ensureWorkspace: async () => {
        try {
            await fs.mkdir(implementationOptions.basePath, { recursive: true });
        } catch (e) {}
    }
}

const readFileImplementation = async (_s: SupabaseClient, _u: string, args: { filePath: string }) => {
  await implementationOptions.ensureWorkspace();
  const safePath = path.join(implementationOptions.basePath, args.filePath);
  if (!safePath.startsWith(implementationOptions.basePath)) return "Error: Acceso a ruta no permitido.";
  try {
    return await fs.readFile(safePath, 'utf-8');
  } catch (e: any) { return `Error al leer el archivo: ${e.message}`; }
};

const writeFileImplementation = async (_s: SupabaseClient, _u: string, args: { filePath: string; content: string }) => {
  await implementationOptions.ensureWorkspace();
  const safePath = path.join(implementationOptions.basePath, args.filePath);
  if (!safePath.startsWith(implementationOptions.basePath)) return "Error: Acceso a ruta no permitido.";
  try {
    await fs.writeFile(safePath, args.content, 'utf-8');
    return `Archivo '${args.filePath}' escrito correctamente.`;
  } catch (e: any) { return `Error al escribir en el archivo: ${e.message}`; }
};

const listDirectoryImplementation = async (_s: SupabaseClient, _u: string, args: { dirPath: string }) => {
    await implementationOptions.ensureWorkspace();
    const safePath = path.join(implementationOptions.basePath, args.dirPath);
    if (!safePath.startsWith(implementationOptions.basePath)) return "Error: Acceso a ruta no permitido.";
    try {
        const files = await fs.readdir(safePath);
        return files.join('\n');
    } catch (e: any) { return `Error al listar el directorio: ${e.message}`; }
};

export const readFileToolObject = { definition: readFileDefinition, implementation: readFileImplementation };
export const writeFileToolObject = { definition: writeFileDefinition, implementation: writeFileImplementation };
export const listDirectoryToolObject = { definition: listDirectoryDefinition, implementation: listDirectoryImplementation };