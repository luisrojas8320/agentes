# api/mcp_server.py - Servidor MCP sin dependencias externas
import asyncio
import logging
import os
import json
import sys
from typing import Any, Dict, List, Optional, Union
from supabase.client import create_client
from api.tools import tool_registry
from api.rag_processor import process_and_store_document

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mcp_server")

class MCPServer:
    """Servidor MCP básico sin dependencias externas"""
    
    def __init__(self, name: str, version: str = "1.0.0"):
        self.name = name
        self.version = version
        self.tools = {}
        self.resources = {}
        self.prompts = {}
    
    def tool(self, name: str = None, description: str = None):
        """Decorador para registrar herramientas"""
        def decorator(func):
            tool_name = name or func.__name__
            tool_description = description or func.__doc__ or "Sin descripción"
            
            self.tools[tool_name] = {
                "name": tool_name,
                "description": tool_description,
                "function": func,
                "schema": self._generate_schema(func)
            }
            return func
        return decorator
    
    def resource(self, uri: str, description: str = None):
        """Decorador para registrar recursos"""
        def decorator(func):
            resource_description = description or func.__doc__ or "Sin descripción"
            
            self.resources[uri] = {
                "uri": uri,
                "description": resource_description,
                "function": func
            }
            return func
        return decorator
    
    def prompt(self, name: str = None, description: str = None):
        """Decorador para registrar prompts"""
        def decorator(func):
            prompt_name = name or func.__name__
            prompt_description = description or func.__doc__ or "Sin descripción"
            
            self.prompts[prompt_name] = {
                "name": prompt_name,
                "description": prompt_description,
                "function": func
            }
            return func
        return decorator
    
    def _generate_schema(self, func):
        """Genera schema básico para una función"""
        import inspect
        sig = inspect.signature(func)
        
        schema = {
            "type": "object",
            "properties": {},
            "required": []
        }
        
        for param_name, param in sig.parameters.items():
            if param_name == 'self':
                continue
                
            param_type = "string"  # Tipo por defecto
            if param.annotation != inspect.Parameter.empty:
                if param.annotation == int:
                    param_type = "integer"
                elif param.annotation == bool:
                    param_type = "boolean"
                elif param.annotation == list:
                    param_type = "array"
            
            schema["properties"][param_name] = {
                "type": param_type,
                "description": f"Parámetro {param_name}"
            }
            
            if param.default == inspect.Parameter.empty:
                schema["required"].append(param_name)
        
        return schema
    
    async def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Maneja peticiones MCP básicas"""
        method = request.get("method")
        params = request.get("params", {})
        
        try:
            if method == "tools/list":
                return await self._list_tools()
            elif method == "tools/call":
                return await self._call_tool(params)
            elif method == "resources/list":
                return await self._list_resources()
            elif method == "resources/read":
                return await self._read_resource(params)
            elif method == "prompts/list":
                return await self._list_prompts()
            elif method == "prompts/get":
                return await self._get_prompt(params)
            else:
                return {"error": f"Método '{method}' no soportado"}
                
        except Exception as e:
            logger.error(f"Error manejando petición {method}: {e}")
            return {"error": str(e)}
    
    async def _list_tools(self) -> Dict[str, Any]:
        """Lista herramientas disponibles"""
        tools_list = []
        for tool_name, tool_info in self.tools.items():
            tools_list.append({
                "name": tool_name,
                "description": tool_info["description"],
                "inputSchema": tool_info["schema"]
            })
        
        return {"tools": tools_list}
    
    async def _call_tool(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Ejecuta una herramienta"""
        tool_name = params.get("name")
        arguments = params.get("arguments", {})
        
        if tool_name not in self.tools:
            return {"error": f"Herramienta '{tool_name}' no encontrada"}
        
        tool_func = self.tools[tool_name]["function"]
        
        try:
            if asyncio.iscoroutinefunction(tool_func):
                result = await tool_func(**arguments)
            else:
                result = tool_func(**arguments)
            
            return {
                "content": [{"type": "text", "text": str(result)}]
            }
        except Exception as e:
            return {"error": f"Error ejecutando herramienta: {str(e)}"}
    
    async def _list_resources(self) -> Dict[str, Any]:
        """Lista recursos disponibles"""
        resources_list = []
        for uri, resource_info in self.resources.items():
            resources_list.append({
                "uri": uri,
                "name": uri.split("/")[-1],
                "description": resource_info["description"]
            })
        
        return {"resources": resources_list}
    
    async def _read_resource(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Lee un recurso"""
        uri = params.get("uri")
        
        if uri not in self.resources:
            return {"error": f"Recurso '{uri}' no encontrado"}
        
        resource_func = self.resources[uri]["function"]
        
        try:
            if asyncio.iscoroutinefunction(resource_func):
                content = await resource_func()
            else:
                content = resource_func()
            
            return {
                "contents": [{"uri": uri, "mimeType": "text/plain", "text": str(content)}]
            }
        except Exception as e:
            return {"error": f"Error leyendo recurso: {str(e)}"}
    
    async def _list_prompts(self) -> Dict[str, Any]:
        """Lista prompts disponibles"""
        prompts_list = []
        for prompt_name, prompt_info in self.prompts.items():
            prompts_list.append({
                "name": prompt_name,
                "description": prompt_info["description"]
            })
        
        return {"prompts": prompts_list}
    
    async def _get_prompt(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Obtiene un prompt"""
        prompt_name = params.get("name")
        
        if prompt_name not in self.prompts:
            return {"error": f"Prompt '{prompt_name}' no encontrado"}
        
        prompt_func = self.prompts[prompt_name]["function"]
        
        try:
            if asyncio.iscoroutinefunction(prompt_func):
                content = await prompt_func()
            else:
                content = prompt_func()
            
            return {
                "description": self.prompts[prompt_name]["description"],
                "messages": [{"role": "user", "content": {"type": "text", "text": str(content)}}]
            }
        except Exception as e:
            return {"error": f"Error obteniendo prompt: {str(e)}"}

# Crear instancia del servidor
app = MCPServer("ai-playground-platform", "1.0.0")

def get_supabase_client():
    """Crea cliente de Supabase"""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    if not url or not key:
        raise ValueError("Variables de Supabase no configuradas")
    
    return create_client(url, key)

@app.tool("search_internet", "Busca información en internet usando Jina AI")
async def search_internet(query: str) -> str:
    """Busca información en internet"""
    logger.info(f"Búsqueda en internet: {query}")
    return tool_registry.execute_tool("internet_search", query=query)

@app.tool("analyze_url", "Analiza el contenido de una URL usando OCR")
async def analyze_url(url: str) -> str:
    """Analiza el contenido de una URL"""
    logger.info(f"Analizando URL: {url}")
    return tool_registry.execute_tool("analyze_url_content", url=url)

@app.tool("search_documents", "Busca en los documentos personales del usuario")
async def search_documents(query: str, user_id: str = None) -> str:
    """Busca en documentos personales"""
    logger.info(f"Búsqueda en documentos: {query}")
    
    try:
        supabase_client = get_supabase_client()
        return tool_registry.execute_tool(
            "search_my_documents", 
            query=query, 
            supabase_user_client=supabase_client
        )
    except Exception as e:
        logger.error(f"Error en búsqueda de documentos: {e}")
        return f"Error al buscar en documentos: {str(e)}"

@app.tool("get_system_stats", "Obtiene estadísticas del sistema")
async def get_system_stats() -> str:
    """Obtiene estadísticas del sistema"""
    logger.info("Obteniendo estadísticas del sistema")
    
    try:
        supabase_client = get_supabase_client()
        
        # Contar chats
        chats_response = supabase_client.from_('chats').select('id', count='exact').execute()
        chats_count = chats_response.count or 0
        
        # Contar documentos
        docs_response = supabase_client.from_('documents').select('id', count='exact').execute()
        docs_count = docs_response.count or 0
        
        # Contar mensajes
        messages_response = supabase_client.from_('messages').select('id', count='exact').execute()
        messages_count = messages_response.count or 0
        
        stats = f"""Estadísticas de la plataforma:
- Chats totales: {chats_count}
- Documentos procesados: {docs_count}
- Mensajes intercambiados: {messages_count}
- Herramientas disponibles: {len(tool_registry.list_tools())}
"""
        return stats
        
    except Exception as e:
        logger.error(f"Error obteniendo estadísticas: {e}")
        return f"Error al obtener estadísticas: {str(e)}"

@app.resource("platform://tools", "Lista todas las herramientas disponibles en la plataforma")
async def list_platform_tools() -> str:
    """Lista herramientas de la plataforma"""
    tools = tool_registry.list_tools()
    tools_info = []
    
    for tool in tools:
        tools_info.append(f"- {tool['name']}: {tool['description']}")
    
    return "Herramientas disponibles en la plataforma:\n" + "\n".join(tools_info)

@app.resource("platform://status", "Estado actual de la plataforma")
async def platform_status() -> str:
    """Estado de la plataforma"""
    try:
        supabase_client = get_supabase_client()
        
        # Verificar conexión a Supabase
        health_response = supabase_client.from_('chats').select('id').limit(1).execute()
        supabase_status = "✓ Conectado" if health_response else "✗ Error"
        
        # Verificar variables de entorno
        env_vars = {
            "SUPABASE_URL": "✓" if os.getenv("SUPABASE_URL") else "✗",
            "OPENAI_API_KEY": "✓" if os.getenv("OPENAI_API_KEY") else "✗",
            "JINA_API_KEY": "✓" if os.getenv("JINA_API_KEY") else "✗",
            "OCR_SPACE_API_KEY": "✓" if os.getenv("OCR_SPACE_API_KEY") else "✗",
        }
        
        status = f"""Estado de la plataforma:

Base de datos (Supabase): {supabase_status}

Variables de entorno:
{chr(10).join(f"- {var}: {status}" for var, status in env_vars.items())}

Herramientas registradas: {len(tool_registry.list_tools())}
"""
        return status
        
    except Exception as e:
        return f"Error verificando estado: {str(e)}"

@app.prompt("help_prompt", "Prompt de ayuda para usar la plataforma")
async def help_prompt() -> str:
    """Prompt de ayuda"""
    return """Eres un asistente de la plataforma AI Playground. Puedes ayudar con:

1. Búsquedas en internet usando search_internet()
2. Análisis de URLs con analyze_url() 
3. Búsqueda en documentos personales con search_documents()
4. Obtener estadísticas del sistema con get_system_stats()

Siempre sé útil, preciso y mantén la privacidad de los usuarios."""

class StdioTransport:
    """Transporte básico stdio para MCP"""
    
    def __init__(self, server: MCPServer):
        self.server = server
    
    async def run(self):
        """Ejecuta el servidor via stdio"""
        logger.info("Iniciando servidor MCP via stdio...")
        
        while True:
            try:
                # Leer línea de stdin
                line = sys.stdin.readline()
                if not line:
                    break
                
                # Parsear JSON
                try:
                    request = json.loads(line.strip())
                except json.JSONDecodeError:
                    continue
                
                # Procesar petición
                response = await self.server.handle_request(request)
                
                # Enviar respuesta
                print(json.dumps(response))
                sys.stdout.flush()
                
            except KeyboardInterrupt:
                break
            except Exception as e:
                logger.error(f"Error en transport stdio: {e}")
                break

async def main():
    """Función principal del servidor MCP"""
    logger.info("Iniciando servidor MCP de AI Playground...")
    
    try:
        # Verificar configuración
        supabase_client = get_supabase_client()
        logger.info("✓ Conexión a Supabase verificada")
        
        # Verificar herramientas
        tools = tool_registry.list_tools()
        logger.info(f"✓ {len(tools)} herramientas cargadas")
        
        # Crear transporte stdio
        transport = StdioTransport(app)
        
        # Ejecutar servidor
        await transport.run()
        
    except Exception as e:
        logger.error(f"Error iniciando servidor MCP: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main())