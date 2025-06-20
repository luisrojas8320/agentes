# api/tools.py - Sistema de herramientas mejorado
import os
import requests
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from supabase.client import Client
from langchain_openai import OpenAIEmbeddings

class BaseTool(ABC):
    """Clase base para todas las herramientas"""
    
    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
        self.logger = logging.getLogger(f"tool.{name}")
    
    @abstractmethod
    async def execute(self, **kwargs) -> str:
        """Ejecuta la herramienta"""
        pass
    
    def validate_inputs(self, **kwargs) -> bool:
        """Valida las entradas de la herramienta"""
        return True

class InternetSearchTool(BaseTool):
    """Herramienta de búsqueda en internet usando Jina AI"""
    
    def __init__(self):
        super().__init__(
            name="internet_search",
            description="Realiza búsquedas en internet para obtener información actualizada"
        )
    
    async def execute(self, query: str) -> str:
        """Ejecuta búsqueda en internet"""
        self.logger.info(f"Ejecutando búsqueda para: '{query}'")
        
        try:
            jina_api_key = os.environ.get("JINA_API_KEY")
            if not jina_api_key:
                return "Error: JINA_API_KEY no está configurada."

            headers = {
                "Authorization": f"Bearer {jina_api_key}",
                "Accept": "application/json",
            }
            
            response = requests.get(
                f"https://s.jina.ai/{query}", 
                headers=headers, 
                timeout=20
            )
            response.raise_for_status()
            
            return response.text

        except requests.exceptions.RequestException as e:
            self.logger.error(f"Error en la API de Jina AI: {e}")
            return f"Error al buscar en internet: {e}"
        except Exception as e:
            self.logger.error(f"Error inesperado: {e}")
            return "Error inesperado al buscar en internet."

class URLAnalyzerTool(BaseTool):
    """Herramienta para analizar contenido de URLs con OCR"""
    
    def __init__(self):
        super().__init__(
            name="analyze_url_content",
            description="Analiza contenido de URLs usando OCR para extraer texto de imágenes"
        )
    
    async def execute(self, url: str) -> str:
        """Analiza contenido de URL"""
        self.logger.info(f"Analizando URL: {url}")
        
        try:
            ocr_api_key = os.environ.get("OCR_SPACE_API_KEY")
            if not ocr_api_key:
                return "Error: OCR_SPACE_API_KEY no está configurada."
                
            payload = {
                'url': url,
                'apikey': ocr_api_key,
                'language': 'spa',
            }
            
            response = requests.post(
                'https://api.ocr.space/parse/image', 
                data=payload, 
                timeout=30
            )
            response.raise_for_status()

            result = response.json()
            if result.get('IsErroredOnProcessing'):
                return f"Error de OCR: {result.get('ErrorMessage', 'Error desconocido')}"
            
            parsed_text = result.get('ParsedResults', [{}])[0].get('ParsedText', 'No se pudo extraer texto.')
            return f"Texto extraído de la URL:\n\n{parsed_text}"

        except requests.exceptions.RequestException as e:
            self.logger.error(f"Error en OCR API: {e}")
            return f"Error al analizar la URL: {e}"
        except Exception as e:
            self.logger.error(f"Error inesperado: {e}")
            return "Error inesperado al analizar la URL."

class DocumentSearchTool(BaseTool):
    """Herramienta para buscar en documentos personales usando RAG"""
    
    def __init__(self):
        super().__init__(
            name="search_my_documents",
            description="Busca información en documentos personales del usuario"
        )
    
    async def execute(self, query: str, supabase_user_client: Client) -> str:
        """Busca en documentos personales"""
        self.logger.info(f"Buscando en documentos: '{query}'")
        
        try:
            embeddings_model = OpenAIEmbeddings(model="text-embedding-3-small")
            query_embedding = embeddings_model.embed_query(query)
            
            response = supabase_user_client.rpc('match_documents', {
                'query_embedding': query_embedding,
                'match_threshold': 0.5,
                'match_count': 10
            }).execute()

            if response.data and len(response.data) > 0:
                sorted_docs = sorted(
                    response.data, 
                    key=lambda x: x.get('similarity', 0), 
                    reverse=True
                )
                
                documents = []
                for i, doc in enumerate(sorted_docs[:5]):
                    similarity = doc.get('similarity', 0)
                    content = doc.get('content', '')
                    self.logger.info(f"Documento {i+1} - Similaridad: {similarity:.3f}")
                    documents.append(f"[Relevancia: {similarity:.2f}] {content}")
                
                combined_content = "\n---\n".join(documents)
                return f"Información encontrada en documentos personales:\n\n{combined_content}"
            else:
                return f"No se encontró información sobre '{query}' en los documentos."

        except Exception as e:
            self.logger.error(f"Error en búsqueda de documentos: {e}", exc_info=True)
            return f"Error al buscar en documentos: {str(e)}"

class ToolRegistry:
    """Registro central de herramientas"""
    
    def __init__(self):
        self._tools: Dict[str, BaseTool] = {}
        self._initialize_tools()
    
    def _initialize_tools(self):
        """Inicializa las herramientas disponibles"""
        tools = [
            InternetSearchTool(),
            URLAnalyzerTool(),
            DocumentSearchTool(),
        ]
        
        for tool in tools:
            self._tools[tool.name] = tool
    
    def get_tool(self, name: str) -> Optional[BaseTool]:
        """Obtiene una herramienta por nombre"""
        return self._tools.get(name)
    
    def list_tools(self) -> List[Dict[str, str]]:
        """Lista todas las herramientas disponibles"""
        return [
            {
                "name": tool.name,
                "description": tool.description
            }
            for tool in self._tools.values()
        ]
    
    def execute_tool(self, name: str, **kwargs) -> str:
        """Ejecuta una herramienta por nombre"""
        tool = self.get_tool(name)
        if not tool:
            return f"Herramienta '{name}' no encontrada"
        
        try:
            if not tool.validate_inputs(**kwargs):
                return f"Entradas inválidas para herramienta '{name}'"
            
            # Para compatibilidad con el sistema actual
            if name == "search_my_documents":
                return tool.execute(**kwargs)
            else:
                import asyncio
                return asyncio.run(tool.execute(**kwargs))
                
        except Exception as e:
            logging.error(f"Error ejecutando herramienta {name}: {e}")
            return f"Error al ejecutar herramienta '{name}': {str(e)}"

# Instancia global del registro
tool_registry = ToolRegistry()

# Funciones de compatibilidad con el sistema actual
def internet_search(query: str) -> str:
    """Función de compatibilidad para búsqueda en internet"""
    return tool_registry.execute_tool("internet_search", query=query)

def analyze_url_content(url: str) -> str:
    """Función de compatibilidad para análisis de URLs"""
    return tool_registry.execute_tool("analyze_url_content", url=url)

def search_my_documents(query: str, supabase_user_client: Client) -> str:
    """Función de compatibilidad para búsqueda en documentos"""
    return tool_registry.execute_tool("search_my_documents", query=query, supabase_user_client=supabase_user_client)