# api/mcp_client.py - Cliente MCP sin dependencias externas
import asyncio
import subprocess
import logging
import json
import os
from typing import Dict, List, Any, Optional
from langchain.tools import StructuredTool
from pydantic import BaseModel, Field

logger = logging.getLogger("mcp_client")

class BasicMCPClient:
    """Cliente MCP básico usando subprocess"""
    
    def __init__(self, server_command: List[str], server_env: Dict[str, str] = None):
        self.server_command = server_command
        self.server_env = server_env or {}
        self.process = None
        self.tools_cache = []
        self.resources_cache = []
    
    async def connect(self) -> bool:
        """Conecta al servidor MCP"""
        try:
            # Combinar env del sistema con env del servidor
            full_env = {**os.environ.copy(), **self.server_env}
            
            # Iniciar proceso del servidor
            self.process = subprocess.Popen(
                self.server_command,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=full_env
            )
            
            # Esperar un poco para que el servidor se inicie
            await asyncio.sleep(1)
            
            # Verificar que el proceso está vivo
            if self.process.poll() is not None:
                stderr_output = self.process.stderr.read() if self.process.stderr else ""
                raise Exception(f"Servidor MCP falló al iniciar: {stderr_output}")
            
            logger.info(f"✓ Conectado a servidor MCP: {' '.join(self.server_command)}")
            return True
            
        except Exception as e:
            logger.error(f"Error conectando a servidor MCP: {e}")
            return False
    
    async def disconnect(self):
        """Desconecta del servidor MCP"""
        if self.process:
            try:
                self.process.terminate()
                await asyncio.sleep(1)
                if self.process.poll() is None:
                    self.process.kill()
                logger.info("✓ Desconectado de servidor MCP")
            except Exception as e:
                logger.error(f"Error desconectando de servidor MCP: {e}")
    
    async def send_request(self, method: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """Envía petición al servidor MCP"""
        if not self.process or self.process.poll() is not None:
            raise Exception("Servidor MCP no conectado")
        
        request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params or {}
        }
        
        try:
            # Enviar petición
            request_json = json.dumps(request) + "\n"
            self.process.stdin.write(request_json)
            self.process.stdin.flush()
            
            # Leer respuesta (con timeout)
            response_line = await asyncio.wait_for(
                self._read_line_async(), 
                timeout=10.0
            )
            
            if response_line:
                response = json.loads(response_line.strip())
                return response
            else:
                raise Exception("No se recibió respuesta del servidor")
                
        except asyncio.TimeoutError:
            raise Exception("Timeout esperando respuesta del servidor MCP")
        except Exception as e:
            raise Exception(f"Error enviando petición MCP: {e}")
    
    async def _read_line_async(self) -> str:
        """Lee línea del proceso de forma asíncrona"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self.process.stdout.readline)
    
    async def list_tools(self) -> List[Dict[str, Any]]:
        """Lista herramientas del servidor"""
        try:
            response = await self.send_request("tools/list")
            if "error" in response:
                raise Exception(response["error"])
            
            self.tools_cache = response.get("tools", [])
            return self.tools_cache
            
        except Exception as e:
            logger.error(f"Error listando herramientas: {e}")
            return []
    
    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> str:
        """Llama a una herramienta"""
        try:
            params = {
                "name": tool_name,
                "arguments": arguments
            }
            
            response = await self.send_request("tools/call", params)
            
            if "error" in response:
                return f"Error: {response['error']}"
            
            # Extraer contenido de la respuesta
            content = response.get("content", [])
            if content and isinstance(content, list):
                text_parts = []
                for item in content:
                    if isinstance(item, dict) and item.get("type") == "text":
                        text_parts.append(item.get("text", ""))
                return "\n".join(text_parts)
            
            return str(response)
            
        except Exception as e:
            logger.error(f"Error llamando herramienta {tool_name}: {e}")
            return f"Error ejecutando herramienta: {str(e)}"
    
    async def list_resources(self) -> List[Dict[str, Any]]:
        """Lista recursos del servidor"""
        try:
            response = await self.send_request("resources/list")
            if "error" in response:
                raise Exception(response["error"])
            
            self.resources_cache = response.get("resources", [])
            return self.resources_cache
            
        except Exception as e:
            logger.error(f"Error listando recursos: {e}")
            return []

class MCPClientManager:
    """Gestor simplificado de clientes MCP"""
    
    def __init__(self):
        self.clients: Dict[str, BasicMCPClient] = {}
        self.connected_servers: Dict[str, BasicMCPClient] = {}
        self.server_configs = {}
    
    def add_server(self, name: str, command: List[str], env: Dict[str, str] = None):
        """Añade configuración de servidor"""
        self.server_configs[name] = {
            "command": command,
            "env": env or {}
        }
    
    async def connect_to_server(self, server_name: str) -> bool:
        """Conecta a un servidor específico"""
        if server_name not in self.server_configs:
            logger.error(f"Servidor '{server_name}' no configurado")
            return False
        
        config = self.server_configs[server_name]
        client = BasicMCPClient(config["command"], config["env"])
        
        success = await client.connect()
        if success:
            self.clients[server_name] = client
            self.connected_servers[server_name] = client
            logger.info(f"✓ Cliente MCP conectado: {server_name}")
        
        return success
    
    async def connect_all_servers(self):
        """Conecta a todos los servidores configurados"""
        results = []
        for server_name in self.server_configs.keys():
            result = await self.connect_to_server(server_name)
            results.append(result)
        
        successful = sum(results)
        total = len(results)
        logger.info(f"Conectado a {successful}/{total} servidores MCP")
    
    async def get_available_tools(self) -> List[Dict[str, Any]]:
        """Obtiene herramientas de todos los servidores"""
        all_tools = []
        
        for server_name, client in self.clients.items():
            try:
                tools = await client.list_tools()
                for tool in tools:
                    tool_info = {
                        "name": f"{server_name}_{tool['name']}",
                        "original_name": tool["name"],
                        "server": server_name,
                        "description": tool.get("description", ""),
                        "input_schema": tool.get("inputSchema", {})
                    }
                    all_tools.append(tool_info)
            except Exception as e:
                logger.error(f"Error obteniendo herramientas de {server_name}: {e}")
        
        return all_tools
    
    async def get_resources(self) -> List[Dict[str, Any]]:
        """Obtiene recursos de todos los servidores"""
        all_resources = []
        
        for server_name, client in self.clients.items():
            try:
                resources = await client.list_resources()
                for resource in resources:
                    resource_info = {
                        "uri": resource.get("uri", ""),
                        "server": server_name,
                        "description": resource.get("description", "")
                    }
                    all_resources.append(resource_info)
            except Exception as e:
                logger.error(f"Error obteniendo recursos de {server_name}: {e}")
        
        return all_resources
    
    async def call_tool(self, server_name: str, tool_name: str, arguments: Dict[str, Any]) -> str:
        """Llama a una herramienta específica"""
        if server_name not in self.clients:
            return f"Servidor '{server_name}' no conectado"
        
        client = self.clients[server_name]
        return await client.call_tool(tool_name, arguments)
    
    async def cleanup(self):
        """Limpia todas las conexiones"""
        for server_name, client in self.clients.items():
            await client.disconnect()
        self.clients.clear()
        self.connected_servers.clear()

class MCPToolWrapper:
    """Wrapper para convertir herramientas MCP en herramientas LangChain"""
    
    def __init__(self, mcp_manager: MCPClientManager):
        self.mcp_manager = mcp_manager
    
    async def create_langchain_tools(self) -> List[StructuredTool]:
        """Crea herramientas LangChain desde herramientas MCP"""
        mcp_tools = await self.mcp_manager.get_available_tools()
        langchain_tools = []
        
        for tool_info in mcp_tools:
            try:
                # Crear schema dinámico
                class DynamicToolInput(BaseModel):
                    pass
                
                # Añadir campos según el schema
                schema = tool_info.get("input_schema", {})
                if isinstance(schema, dict) and "properties" in schema:
                    properties = schema["properties"]
                    required = schema.get("required", [])
                    
                    for prop_name, prop_schema in properties.items():
                        field_type = str  # Tipo por defecto
                        field_description = prop_schema.get("description", "")
                        field_default = ... if prop_name in required else None
                        
                        # Mapear tipos
                        if prop_schema.get("type") == "integer":
                            field_type = int
                        elif prop_schema.get("type") == "boolean":
                            field_type = bool
                        
                        # Añadir campo dinámicamente
                        setattr(DynamicToolInput, prop_name, Field(
                            default=field_default,
                            description=field_description
                        ))
                
                # Crear función de ejecución con closure correcto
                def make_tool_function(ti):
                    def execute_tool_sync(**kwargs):
                        return asyncio.run(
                            self.mcp_manager.call_tool(
                                ti["server"], 
                                ti["original_name"], 
                                kwargs
                            )
                        )
                    return execute_tool_sync
                
                tool_function = make_tool_function(tool_info)
                
                # Crear herramienta LangChain
                langchain_tool = StructuredTool.from_function(
                    func=tool_function,
                    name=tool_info["name"],
                    description=tool_info["description"],
                    args_schema=DynamicToolInput
                )
                
                langchain_tools.append(langchain_tool)
                
            except Exception as e:
                logger.error(f"Error creando herramienta LangChain para {tool_info['name']}: {e}")
        
        return langchain_tools

# Instancia global simplificada
mcp_manager = MCPClientManager()

# Configuración básica de servidores
def configure_default_servers():
    """Configura servidores MCP por defecto"""
    
    # Servidor de la plataforma
    mcp_manager.add_server(
        "platform_tools",
        command=["python", "-m", "api.mcp_server"],
        env={
            "SUPABASE_URL": os.getenv("SUPABASE_URL", ""),
            "SUPABASE_SERVICE_ROLE_KEY": os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
            "OPENAI_API_KEY": os.getenv("OPENAI_API_KEY", ""),
            "JINA_API_KEY": os.getenv("JINA_API_KEY", ""),
            "OCR_SPACE_API_KEY": os.getenv("OCR_SPACE_API_KEY", "")
        }
    )

async def initialize_mcp_clients():
    """Inicializa conexiones MCP simplificadas"""
    try:
        configure_default_servers()
        await mcp_manager.connect_all_servers()
        tools = await mcp_manager.get_available_tools()
        logger.info(f"MCP inicializado con {len(tools)} herramientas disponibles")
        return True
    except Exception as e:
        logger.error(f"Error inicializando clientes MCP: {e}")
        return False

async def get_mcp_tools_for_langchain() -> List[StructuredTool]:
    """Obtiene herramientas MCP como herramientas de LangChain"""
    wrapper = MCPToolWrapper(mcp_manager)
    return await wrapper.create_langchain_tools()

async def cleanup_mcp_clients():
    """Limpia conexiones MCP"""
    await mcp_manager.cleanup()
    logger.info("Conexiones MCP cerradas")