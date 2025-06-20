import os
import requests
import logging
from supabase.client import Client
from langchain_openai import OpenAIEmbeddings

def internet_search(query: str) -> str:
    """
    Realiza una búsqueda en internet utilizando la API de Jina AI para obtener resultados concisos.
    Es ideal para preguntas sobre eventos actuales, datos específicos o información general.
    """
    logging.info(f"Ejecutando búsqueda en internet con Jina AI para: '{query}'")
    try:
        jina_api_key = os.environ.get("JINA_API_KEY")
        if not jina_api_key:
            return "Error: JINA_API_KEY no está configurada."

        headers = {
            "Authorization": f"Bearer {jina_api_key}",
            "Accept": "application/json",
        }
        response = requests.get(f"https://s.jina.ai/{query}", headers=headers, timeout=20)
        response.raise_for_status()
        return response.text

    except requests.exceptions.RequestException as e:
        logging.error(f"Error en la API de Jina AI: {e}")
        return f"Error al intentar buscar en internet: {e}"
    except Exception as e:
        logging.error(f"Error inesperado en internet_search: {e}")
        return "Ocurrió un error inesperado al buscar en internet."


def analyze_url_content(url: str) -> str:
    """
    Analiza el contenido de una URL, principalmente para extraer texto de imágenes o PDFs escaneados usando OCR.space.
    Útil para 'leer' documentos o imágenes en línea.
    """
    logging.info(f"Analizando contenido de URL con OCR.space: {url}")
    try:
        ocr_api_key = os.environ.get("OCR_SPACE_API_KEY")
        if not ocr_api_key:
            return "Error: OCR_SPACE_API_KEY no está configurada."
            
        payload = {
            'url': url,
            'apikey': ocr_api_key,
            'language': 'spa',
        }
        response = requests.post('https://api.ocr.space/parse/image', data=payload, timeout=30)
        response.raise_for_status()

        result = response.json()
        if result.get('IsErroredOnProcessing'):
            return f"Error de OCR.space: {result.get('ErrorMessage', 'Error desconocido')}"
        
        parsed_text = result.get('ParsedResults', [{}])[0].get('ParsedText', 'No se pudo extraer texto.')
        return f"Texto extraído de la URL: \n\n{parsed_text}"

    except requests.exceptions.RequestException as e:
        logging.error(f"Error en la API de OCR.space: {e}")
        return f"Error al analizar la URL: {e}"
    except Exception as e:
        logging.error(f"Error inesperado en analyze_url_content: {e}")
        return "Ocurrió un error inesperado al analizar la URL."

def search_my_documents(query: str, supabase_user_client: Client) -> str:
    """
    Busca información relevante en los documentos personales que el usuario ha subido previamente.
    Utiliza búsqueda vectorial para encontrar los fragmentos más similares a la pregunta del usuario.
    """
    logging.info(f"Buscando en documentos personales para: '{query}'")
    try:
        # CORREGIDO: Crear embeddings para la consulta
        embeddings_model = OpenAIEmbeddings(model="text-embedding-3-small")
        query_embedding = embeddings_model.embed_query(query)
        
        logging.info(f"Query embedding generado exitosamente, dimensiones: {len(query_embedding)}")
        
        # CORREGIDO: Llamar a la función RPC con parámetros correctos
        response = supabase_user_client.rpc('match_documents', {
            'query_embedding': query_embedding,
            'match_threshold': 0.5,  # CORREGIDO: Umbral más bajo para mayor flexibilidad
            'match_count': 10        # CORREGIDO: Más resultados para mejor cobertura
        }).execute()

        logging.info(f"Respuesta de Supabase RPC: {response}")
        
        if response.data and len(response.data) > 0:
            # CORREGIDO: Ordenar por similaridad y tomar los mejores resultados
            sorted_docs = sorted(response.data, key=lambda x: x.get('similarity', 0), reverse=True)
            
            documents = []
            for i, doc in enumerate(sorted_docs[:5]):  # Tomar los 5 mejores
                similarity = doc.get('similarity', 0)
                content = doc.get('content', '')
                logging.info(f"Documento {i+1} - Similaridad: {similarity:.3f}")
                documents.append(f"[Relevancia: {similarity:.2f}] {content}")
            
            combined_content = "\n---\n".join(documents)
            
            result = f"Se encontró la siguiente información en tus documentos personales:\n\n{combined_content}"
            logging.info(f"Retornando {len(documents)} documentos encontrados")
            return result
        else:
            logging.warning("No se encontraron documentos relevantes")
            return f"No se encontró información específica sobre '{query}' en tus documentos personales. Puedes subir más documentos o reformular tu pregunta con otros términos relacionados."

    except Exception as e:
        logging.error(f"Error al buscar en documentos personales: {e}", exc_info=True)
        return f"Ocurrió un error al intentar buscar en tus documentos: {str(e)}"