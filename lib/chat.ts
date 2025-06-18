// Ruta: lib/chat.ts

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// La función ahora acepta callbacks para manejar el stream
export async function streamChatMessage(
  messages: Message[],
  onChunk: (chunk: string) => void,
  onError: (error: Error) => void,
  onDone: () => void
) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    onError(new Error("La variable de entorno NEXT_PUBLIC_API_URL no está configurada."));
    return;
  }

  try {
    const response = await fetch(`${apiUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages }),
    });

    if (!response.body) {
      throw new Error("La respuesta del servidor no tiene cuerpo.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const rawChunk = decoder.decode(value);
      const lines = rawChunk.split('\n\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          if (data.trim() === '[DONE]') {
            onDone();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            if(parsed.content) {
                onChunk(parsed.content);
            } else if(parsed.error) {
                throw new Error(parsed.error);
            }
          } catch (e) {
            console.error("Error al parsear chunk JSON:", data);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error al conectar con el backend:", error);
    onError(error instanceof Error ? error : new Error("Error desconocido en la conexión."));
  } finally {
    onDone();
  }
}