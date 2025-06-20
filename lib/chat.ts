import { toast } from 'sonner';

// --- TIPOS COMPARTIDOS ---
export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

export interface Chat {
    id: string;
    title: string | null;
    created_at: string;
}

// --- FUNCIONES DE API ---

export async function streamChatMessage(
    message: string,
    thread_id: string | null,
    accessToken: string,
    onChunk: (chunk: string, threadId: string | null) => void,
    onError: (error: Error) => void,
    onDone: () => void
): Promise<void> {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
        onError(new Error("NEXT_PUBLIC_API_URL no está configurada."));
        return;
    }
    try {
        const response = await fetch(`${apiUrl}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ message, thread_id }),
        });
        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({ error: `Error HTTP ${response.status}` }));
            throw new Error(errorBody.error || `Error HTTP ${response.status}`);
        }
        if (!response.body) throw new Error("La respuesta no tiene cuerpo.");

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
                        if (parsed.content) {
                            onChunk(parsed.content, parsed.thread_id || null);
                        } else if (parsed.error) {
                            throw new Error(parsed.error);
                        }
                    } catch (e) { 
                        console.error("Error parseando chunk:", data); 
                    }
                }
            }
        }
    } catch (error) {
        onError(error instanceof Error ? error : new Error("Error desconocido."));
    } finally {
        onDone();
    }
}

export async function listChats(accessToken: string): Promise<Chat[]> {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
        console.error("URL de API no configurada.");
        return [];
    }
    try {
        const response = await fetch(`${apiUrl}/api/chats`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (!response.ok) {
            const res = await response.json();
            throw new Error(res.error || 'No se pudo obtener la lista de chats.');
        }
        return await response.json();
    } catch (error) {
        console.error("Error al obtener chats:", error);
        toast.error("Error al cargar chats", { description: (error as Error).message });
        return [];
    }
}

export async function uploadFileToApi(
    file: File,
    accessToken: string
): Promise<{ success: boolean; message: string }> {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return { success: false, message: "URL de API no configurada." };

    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch(`${apiUrl}/api/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` },
            body: formData,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Error HTTP ${response.status}`);
        return { success: true, message: result.message };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Error desconocido.";
        return { success: false, message };
    }
}