import os
import requests
import logging

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
        # La URL de Jina se construye con la query directamente
        response = requests.get(f"https://s.jina.ai/{query}", headers=headers)
        response.raise_for_status() # Lanza un error para respuestas 4xx/5xx
        
        # Jina devuelve la respuesta en texto plano (Markdown), que es ideal para el LLM.
        return response.text

    except requests.exceptions.RequestException as e:
        logging.error(f"Error en la API de Jina AI: {e}")
        return f"Error al intentar buscar en internet: {e}"
    except Exception as e:
        logging.error(f"Error inesperado en internet_search: {e}")
        return f"Ocurrió un error inesperado al buscar en internet."


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
            'language': 'spa', # Asumimos español, se puede cambiar
        }
        response = requests.post('https://api.ocr.space/parse/image', data=payload)
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