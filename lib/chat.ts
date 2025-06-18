// lib/chat.ts

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export async function postChatMessage(messages: Message[]): Promise<string> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    throw new Error('La variable de entorno NEXT_PUBLIC_API_URL no está configurada.');
  }

  try {
    const response = await fetch(`${apiUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error del servidor: ${response.status}`);
    }

    const data = await response.json();
    return data.response;

  } catch (error) {
    console.error('Error al conectar con el backend:', error);
    return 'Error al conectar con el servidor de Python. Por favor, revisa la consola del navegador.';
  }
}