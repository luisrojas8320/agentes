// Ruta: lib/llm/llm_service.ts

import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY!,
  baseURL: 'https://api.deepseek.com/v1',
});

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type ChatTool = OpenAI.Chat.Completions.ChatCompletionTool;

interface CompletionParams {
  provider: string;
  model: string;
  messages: ChatMessage[];
  tools?: ChatTool[];
  tool_choice?: 'auto' | 'none';
}

export async function generateChatCompletion(params: CompletionParams): Promise<any> {
  try {
    switch (params.provider) {
      case 'openai':
      case 'deepseek':
        const client = params.provider === 'openai' ? openai : deepseek;
        return await client.chat.completions.create({
          model: params.model,
          messages: params.messages,
          tools: params.tools,
          tool_choice: params.tool_choice,
        });

      case 'google':
        const geminiModel = genAI.getGenerativeModel({ model: params.model });
        const { contents, geminiTools } = convertToGeminiFormat(params.messages, params.tools);
        
        const result = await geminiModel.generateContent({
          contents: contents as any,
          tools: geminiTools as any,
        });
        return convertGeminiResponseToOpenAI(result.response);

      default:
        throw new Error(`Proveedor de LLM no soportado: ${params.provider}`);
    }
  } catch (error: any) {
    // --- CORRECCIÓN: Lógica de Fallback ---
    // Si la llamada al proveedor principal (ej. Google) falla, lo reintentamos con OpenAI.
    console.error(`Error con el proveedor ${params.provider}: ${error.message}. Reintentando con OpenAI...`);
    
    return await openai.chat.completions.create({
      model: 'gpt-4o', // Usar un modelo de OpenAI confiable como fallback
      messages: params.messages,
      tools: params.tools,
      tool_choice: params.tool_choice,
    });
  }
}

// ... (el resto de las funciones de conversión permanecen igual)

function convertToGeminiFormat(messages: ChatMessage[], tools?: ChatTool[]) {
  const systemPrompt = messages.find(msg => msg.role === 'system')?.content || '';
  const contents = messages
    .filter(msg => msg.role === 'user' || msg.role === 'assistant' || msg.role === 'tool')
    .map((msg, index) => {
      const role = msg.role === 'assistant' ? 'model' : 'user';
      let textContent = msg.content as string;
      if (index === 0 && msg.role === 'user' && systemPrompt) {
        textContent = `${systemPrompt}\n\n${textContent}`;
      }
      if (msg.role === 'tool') {
        return { role: 'tool', parts: [{ functionResponse: { name: msg.tool_call_id!, response: { name: msg.tool_call_id!, content: msg.content } } }] };
      }
      return { role, parts: [{ text: textContent }] };
    });
  const geminiTools = tools ? [{ functionDeclarations: tools.map(t => t.function) }] : undefined;
  return { contents, geminiTools };
}

function convertGeminiResponseToOpenAI(response: any) {
  const choice = response.candidates[0];
  const message: any = { role: 'assistant', content: null };
  if (choice.content?.parts[0]?.text) {
    message.content = choice.content.parts[0].text;
  }
  const functionCall = choice.content?.parts[0]?.functionCall;
  if (functionCall) {
    message.tool_calls = [{
      id: functionCall.name,
      type: 'function',
      function: { name: functionCall.name, arguments: JSON.stringify(functionCall.args) }
    }];
  }
  return { choices: [{ message }] };
}