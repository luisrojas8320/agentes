# api/mcp_server.py - Servidor MCP con herramientas matemáticas
import asyncio
import logging
import os
import json
import sys
from typing import Any, Dict, List, Optional, Union
from supabase.client import create_client
from api.tools import tool_registry

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
                elif param.annotation == float:
                    param_type = "number"
            
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

# ========== HERRAMIENTAS BÁSICAS ==========

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

# ========== HERRAMIENTAS MATEMÁTICAS AVANZADAS ==========

@app.tool("monte_carlo_simulation", "Simulaciones Monte Carlo para análisis financiero")
async def monte_carlo_mcp(scenario: str, **kwargs) -> str:
    """Simulaciones Monte Carlo"""
    logger.info(f"MCP: Simulación Monte Carlo {scenario}")
    return tool_registry.execute_tool("monte_carlo_simulation", scenario=scenario, **kwargs)

@app.tool("regression_analysis", "Análisis de regresión lineal y polinómica")
async def regression_mcp(x_data: list, y_data: list, polynomial_degree: int = 1) -> str:
    """Análisis de regresión"""
    logger.info(f"MCP: Análisis de regresión grado {polynomial_degree}")
    return tool_registry.execute_tool("regression_analysis", x_data=x_data, y_data=y_data, polynomial_degree=polynomial_degree)

@app.tool("financial_projections", "Proyecciones financieras usando diferentes métodos")
async def projections_mcp(data: list, periods_ahead: int = 12, method: str = "linear") -> str:
    """Proyecciones financieras"""
    logger.info(f"MCP: Proyecciones {method} para {periods_ahead} períodos")
    return tool_registry.execute_tool("financial_projections", data=data, periods_ahead=periods_ahead, method=method)

@app.tool("portfolio_optimization", "Optimización de portafolios de inversión")
async def portfolio_mcp(expected_returns: list, cov_matrix: list, risk_tolerance: float = 1.0) -> str:
    """Optimización de portafolios"""
    logger.info(f"MCP: Optimización de portafolio con {len(expected_returns)} activos")
    return tool_registry.execute_tool("portfolio_optimization", expected_returns=expected_returns, cov_matrix=cov_matrix, risk_tolerance=risk_tolerance)

@app.tool("statistical_analysis", "Análisis estadístico completo")
async def statistics_mcp(data: list, confidence_level: float = 0.95) -> str:
    """Análisis estadístico"""
    logger.info(f"MCP: Análisis estadístico de {len(data)} observaciones")
    return tool_registry.execute_tool("statistical_analysis", data=data, confidence_level=confidence_level)

# ========== HERRAMIENTAS ESPECÍFICAS DE EJEMPLO ==========

@app.tool("calculate_compound_interest", "Calcula interés compuesto")
async def compound_interest(principal: float, rate: float, time: int, compound_frequency: int = 1) -> str:
    """Calcula interés compuesto"""
    logger.info(f"Calculando interés compuesto: ${principal} al {rate}% por {time} años")
    
    try:
        # A = P(1 + r/n)^(nt)
        amount = principal * (1 + rate/100/compound_frequency) ** (compound_frequency * time)
        interest = amount - principal
        
        return f"""Cálculo de Interés Compuesto:
Capital inicial: ${principal:,.2f}
Tasa anual: {rate}%
Tiempo: {time} años
Frecuencia de capitalización: {compound_frequency} veces por año

Resultado:
• Monto final: ${amount:,.2f}
• Interés ganado: ${interest:,.2f}
• Rendimiento total: {(interest/principal)*100:.2f}%
"""
    except Exception as e:
        return f"Error calculando interés compuesto: {str(e)}"

@app.tool("calculate_loan_payment", "Calcula pagos de préstamos")
async def loan_payment(principal: float, annual_rate: float, years: int) -> str:
    """Calcula pago mensual de préstamo"""
    logger.info(f"Calculando pago de préstamo: ${principal} al {annual_rate}% por {years} años")
    
    try:
        monthly_rate = annual_rate / 100 / 12
        num_payments = years * 12
        
        if monthly_rate == 0:
            monthly_payment = principal / num_payments
        else:
            monthly_payment = principal * (monthly_rate * (1 + monthly_rate)**num_payments) / ((1 + monthly_rate)**num_payments - 1)
        
        total_paid = monthly_payment * num_payments
        total_interest = total_paid - principal
        
        return f"""Cálculo de Préstamo:
Capital: ${principal:,.2f}
Tasa anual: {annual_rate}%
Plazo: {years} años

Resultado:
• Pago mensual: ${monthly_payment:,.2f}
• Total a pagar: ${total_paid:,.2f}
• Intereses totales: ${total_interest:,.2f}
• % de intereses: {(total_interest/principal)*100:.2f}%
"""
    except Exception as e:
        return f"Error calculando pago de préstamo: {str(e)}"

# ========== RECURSOS Y UTILIDADES ==========

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
        
        # Herramientas disponibles
        tools_count = len(tool_registry.list_tools())
        
        stats = f"""Estadísticas de la plataforma:
• Chats totales: {chats_count:,}
• Documentos procesados: {docs_count:,}
• Mensajes intercambiados: {messages_count:,}
• Herramientas disponibles: {tools_count}

Herramientas matemáticas:
"""
        
        # Listar herramientas matemáticas específicamente
        math_tools = [
            "monte_carlo_simulation",
            "regression_analysis", 
            "financial_projections",
            "portfolio_optimization",
            "statistical_analysis"
        ]
        
        for tool_name in math_tools:
            tool_obj = tool_registry.get_tool(tool_name)
            if tool_obj:
                stats += f"• ✓ {tool_name}\n"
            else:
                stats += f"• ✗ {tool_name} (no disponible)\n"
        
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

@app.resource("platform://math_examples", "Ejemplos de uso de herramientas matemáticas")
async def math_examples() -> str:
    """Ejemplos de herramientas matemáticas"""
    return """Ejemplos de uso de herramientas matemáticas:

1. SIMULACIÓN MONTE CARLO:
   - Precios de acciones: monte_carlo_simulation(scenario="stock_price", initial_price=100, days=252, mu=0.1, sigma=0.2)
   - VaR de portafolio: monte_carlo_simulation(scenario="portfolio_var", returns=[...], weights=[...])

2. ANÁLISIS DE REGRESIÓN:
   - Lineal: regression_analysis(x_data=[1,2,3,4,5], y_data=[2,4,6,8,10])
   - Polinómica: regression_analysis(x_data=[...], y_data=[...], polynomial_degree=3)

3. PROYECCIONES FINANCIERAS:
   - Lineal: financial_projections(data=[100,105,110,115], periods_ahead=12, method="linear")
   - Exponencial: financial_projections(data=[...], method="exponential")
   - Suavizado: financial_projections(data=[...], method="exponential_smoothing", alpha=0.3)

4. OPTIMIZACIÓN DE PORTAFOLIOS:
   - portfolio_optimization(expected_returns=[0.1,0.12,0.08], cov_matrix=[[...]], risk_tolerance=1.0)

5. ANÁLISIS ESTADÍSTICO:
   - statistical_analysis(data=[1,2,3,4,5,6,7,8,9,10], confidence_level=0.95)
"""

@app.prompt("math_help", "Prompt de ayuda para herramientas matemáticas")
async def math_help_prompt() -> str:
    """Prompt de ayuda matemática"""
    return """Soy un asistente especializado en análisis matemático y financiero. Puedo ayudarte con:

SIMULACIONES MONTE CARLO:
- Modelado de precios de acciones con movimiento browniano
- Cálculo de Value at Risk (VaR) para portafolios
- Análisis de escenarios probabilísticos

ANÁLISIS DE REGRESIÓN:
- Regresión lineal y polinómica
- Validación cruzada y métricas de rendimiento
- Predicciones con intervalos de confianza

PROYECCIONES FINANCIERAS:
- Tendencias lineales y exponenciales
- Suavizado exponencial
- Intervalos de confianza para proyecciones

OPTIMIZACIÓN DE PORTAFOLIOS:
- Teoría moderna de portafolios (Markowitz)
- Cálculo de frontera eficiente
- Optimización riesgo-retorno

ANÁLISIS ESTADÍSTICO:
- Estadísticas descriptivas completas
- Pruebas de normalidad
- Detección de valores atípicos
- Intervalos de confianza

Proporciona datos claros y específicos para obtener análisis precisos."""

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
    logger.info("Iniciando servidor MCP de AI Playground con herramientas matemáticas...")
    
    try:
        # Verificar configuración
        supabase_client = get_supabase_client()
        logger.info("✓ Conexión a Supabase verificada")
        
        # Verificar herramientas
        tools = tool_registry.list_tools()
        logger.info(f"✓ {len(tools)} herramientas cargadas")
        
        # Mostrar herramientas matemáticas disponibles
        math_tools = [t for t in tools if any(keyword in t['name'] for keyword in ['monte_carlo', 'regression', 'projection', 'portfolio', 'statistical'])]
        if math_tools:
            logger.info(f"✓ {len(math_tools)} herramientas matemáticas avanzadas disponibles")
        else:
            logger.warning("⚠ Herramientas matemáticas no disponibles - verificar instalación de numpy, scipy, scikit-learn")
        
        # Crear transporte stdio
        transport = StdioTransport(app)
        
        # Ejecutar servidor
        await transport.run()
        
    except Exception as e:
        logger.error(f"Error iniciando servidor MCP: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main())