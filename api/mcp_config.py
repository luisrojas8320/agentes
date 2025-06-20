# api/mcp_config.py - Configuración MCP simplificada
import os
import json
import logging
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, asdict

@dataclass
class MCPServer:
    """Configuración de un servidor MCP"""
    name: str
    command: str
    args: List[str] = None
    env: Dict[str, str] = None
    description: str = ""
    enabled: bool = True
    
    def __post_init__(self):
        if self.args is None:
            self.args = []
        if self.env is None:
            self.env = {}

@dataclass
class MCPConfig:
    """Configuración completa de MCP"""
    servers: Dict[str, MCPServer]
    global_env: Dict[str, str] = None
    
    def __post_init__(self):
        if self.global_env is None:
            self.global_env = {}

class MCPConfigManager:
    """Gestor de configuración MCP simplificado"""
    
    def __init__(self, config_path: str = None):
        self.config_path = config_path or os.path.join(os.getcwd(), "mcp_config.json")
        self.config: Optional[MCPConfig] = None
        self.logger = logging.getLogger("mcp_config")
    
    def create_default_config(self) -> MCPConfig:
        """Crea configuración por defecto simplificada"""
        servers = {
            # Servidor personalizado de la plataforma
            "platform_tools": MCPServer(
                name="platform_tools",
                command="python",
                args=["-m", "api.mcp_server"],
                env={
                    "SUPABASE_URL": os.getenv("SUPABASE_URL", ""),
                    "SUPABASE_SERVICE_ROLE_KEY": os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
                    "OPENAI_API_KEY": os.getenv("OPENAI_API_KEY", ""),
                    "JINA_API_KEY": os.getenv("JINA_API_KEY", ""),
                    "OCR_SPACE_API_KEY": os.getenv("OCR_SPACE_API_KEY", "")
                },
                description="Herramientas específicas de la plataforma",
                enabled=True
            )
        }
        
        # Solo añadir servidores externos si están disponibles
        if os.getenv("GITHUB_TOKEN"):
            servers["github"] = MCPServer(
                name="github",
                command="npx",
                args=["-y", "@modelcontextprotocol/server-github"],
                env={"GITHUB_PERSONAL_ACCESS_TOKEN": os.getenv("GITHUB_TOKEN", "")},
                description="Integración con GitHub",
                enabled=False  # Deshabilitado por defecto hasta verificar instalación
            )
        
        global_env = {
            "PYTHONPATH": os.getcwd(),
            "NODE_ENV": "production"
        }
        
        return MCPConfig(servers=servers, global_env=global_env)
    
    def load_config(self) -> MCPConfig:
        """Carga configuración desde archivo"""
        try:
            if os.path.exists(self.config_path):
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # Convertir dict a objetos MCPServer
                servers = {}
                for name, server_data in data.get('servers', {}).items():
                    servers[name] = MCPServer(**server_data)
                
                self.config = MCPConfig(
                    servers=servers,
                    global_env=data.get('global_env', {})
                )
                
                self.logger.info(f"Configuración MCP cargada desde {self.config_path}")
            else:
                self.logger.info("Archivo de configuración no encontrado, creando por defecto")
                self.config = self.create_default_config()
                self.save_config()
                
        except Exception as e:
            self.logger.error(f"Error cargando configuración MCP: {e}")
            self.config = self.create_default_config()
        
        return self.config
    
    def save_config(self):
        """Guarda configuración a archivo"""
        if not self.config:
            return
        
        try:
            # Convertir a dict serializable
            config_dict = {
                'servers': {
                    name: asdict(server) 
                    for name, server in self.config.servers.items()
                },
                'global_env': self.config.global_env
            }
            
            os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
            
            with open(self.config_path, 'w', encoding='utf-8') as f:
                json.dump(config_dict, f, indent=2, ensure_ascii=False)
            
            self.logger.info(f"Configuración MCP guardada en {self.config_path}")
            
        except Exception as e:
            self.logger.error(f"Error guardando configuración MCP: {e}")
    
    def get_enabled_servers(self) -> List[MCPServer]:
        """Obtiene servidores habilitados"""
        if not self.config:
            self.load_config()
        
        return [
            server for server in self.config.servers.values() 
            if server.enabled
        ]
    
    def to_claude_desktop_config(self) -> Dict[str, Any]:
        """Convierte configuración para Claude Desktop"""
        if not self.config:
            self.load_config()
        
        claude_config = {
            "mcpServers": {}
        }
        
        for name, server in self.config.servers.items():
            if server.enabled:
                claude_config["mcpServers"][name] = {
                    "command": server.command,
                    "args": server.args
                }
                
                # Añadir variables de entorno si existen
                if server.env:
                    claude_config["mcpServers"][name]["env"] = server.env
        
        return claude_config

# Instancia global del gestor
mcp_config_manager = MCPConfigManager()

def get_mcp_config() -> MCPConfig:
    """Obtiene la configuración MCP"""
    return mcp_config_manager.load_config()