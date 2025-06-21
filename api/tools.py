# api/tools.py - Sistema de herramientas mejorado
import os
import requests
import logging
import json
import numpy as np
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from supabase.client import Client
from langchain_openai import OpenAIEmbeddings

# Importar herramientas matemáticas avanzadas
try:
    from api.advanced_math_tools import advanced_math
    MATH_TOOLS_AVAILABLE = True
except ImportError as e:
    logging.warning(f"Herramientas matemáticas no disponibles: {e}")
    MATH_TOOLS_AVAILABLE = False

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

# ========== HERRAMIENTAS MATEMÁTICAS AVANZADAS ==========

class MonteCarloTool(BaseTool):
    """Herramienta para simulaciones Monte Carlo"""
    
    def __init__(self):
        super().__init__(
            name="monte_carlo_simulation",
            description="Simulaciones Monte Carlo para análisis financiero y de riesgo"
        )
    
    async def execute(self, scenario: str, **kwargs) -> str:
        """Ejecuta simulación Monte Carlo"""
        if not MATH_TOOLS_AVAILABLE:
            return "Error: Herramientas matemáticas no disponibles. Instalar numpy, scipy, scikit-learn."
        
        self.logger.info(f"Simulación Monte Carlo: {scenario}")
        
        try:
            if scenario == "stock_price":
                initial_price = float(kwargs.get('initial_price', 100))
                days = int(kwargs.get('days', 252))
                mu = float(kwargs.get('mu', 0.1))
                sigma = float(kwargs.get('sigma', 0.2))
                simulations = int(kwargs.get('simulations', 1000))
                
                result = advanced_math.monte_carlo_stock_price(
                    initial_price, days, mu, sigma, simulations
                )
                
                return f"""Simulación Monte Carlo - Precio de Acciones:
Precio inicial: ${initial_price:.2f}
Días simulados: {days}
Simulaciones: {simulations}

Resultados:
• Precio final promedio: ${result['mean_final_price']:.2f}
• Desviación estándar: ${result['std_final_price']:.2f}
• Intervalo de confianza 95%: ${result['confidence_95'][0]:.2f} - ${result['confidence_95'][1]:.2f}
• Rendimiento esperado: {((result['mean_final_price'] / initial_price) - 1) * 100:.2f}%
"""
            
            elif scenario == "portfolio_var":
                returns = np.array(kwargs.get('returns', []))
                weights = np.array(kwargs.get('weights', []))
                confidence_level = float(kwargs.get('confidence_level', 0.05))
                simulations = int(kwargs.get('simulations', 10000))
                
                if len(returns) == 0 or len(weights) == 0:
                    return "Error: Se requieren 'returns' y 'weights' para VaR de portafolio"
                
                result = advanced_math.monte_carlo_portfolio_var(
                    returns, weights, confidence_level, simulations
                )
                
                return f"""Value at Risk (VaR) - Simulación Monte Carlo:
Nivel de confianza: {(1-confidence_level)*100:.0f}%
Simulaciones: {simulations}

Resultados:
• VaR: {result['var']:.4f} ({result['var']*100:.2f}%)
• CVaR (Expected Shortfall): {result['cvar']:.4f} ({result['cvar']*100:.2f}%)
• Retorno esperado: {result['mean_return']:.4f} ({result['mean_return']*100:.2f}%)
• Volatilidad: {result['std_return']:.4f} ({result['std_return']*100:.2f}%)
"""
            
            else:
                return f"Escenario '{scenario}' no soportado. Escenarios disponibles: stock_price, portfolio_var"
                
        except Exception as e:
            self.logger.error(f"Error en simulación Monte Carlo: {e}")
            return f"Error en simulación Monte Carlo: {str(e)}"

class RegressionTool(BaseTool):
    """Herramienta para análisis de regresión"""
    
    def __init__(self):
        super().__init__(
            name="regression_analysis",
            description="Análisis de regresión lineal y polinómica con validación"
        )
    
    async def execute(self, x_data: list, y_data: list, polynomial_degree: int = 1) -> str:
        """Ejecuta análisis de regresión"""
        if not MATH_TOOLS_AVAILABLE:
            return "Error: Herramientas matemáticas no disponibles."
        
        self.logger.info(f"Análisis de regresión grado {polynomial_degree}")
        
        try:
            if len(x_data) != len(y_data):
                return "Error: x_data y y_data deben tener la misma longitud"
            
            if len(x_data) < 3:
                return "Error: Se necesitan al menos 3 puntos de datos"
            
            result = advanced_math.polynomial_regression(x_data, y_data, polynomial_degree)
            
            response = f"""Análisis de Regresión Polinómica (Grado {polynomial_degree}):
Datos: {len(x_data)} observaciones

Métricas de Rendimiento:
• R² (entrenamiento): {result['r2_train']:.4f}
• R² (validación): {result['r2_test']:.4f}
• Error cuadrático medio: {result['mse_test']:.4f}

Coeficientes del modelo:
• Intercepto: {result['intercept']:.4f}
"""
            
            if polynomial_degree == 1:
                response += f"• Pendiente: {result['coefficients'][1]:.4f}\n"
            else:
                for i, coef in enumerate(result['coefficients'][1:], 1):
                    response += f"• x^{i}: {coef:.4f}\n"
            
            # Interpretación
            if result['r2_test'] > 0.8:
                response += "\n✓ Excelente ajuste del modelo"
            elif result['r2_test'] > 0.6:
                response += "\n✓ Buen ajuste del modelo"
            elif result['r2_test'] > 0.4:
                response += "\n⚠ Ajuste moderado del modelo"
            else:
                response += "\n⚠ Ajuste débil del modelo"
            
            return response
            
        except Exception as e:
            self.logger.error(f"Error en análisis de regresión: {e}")
            return f"Error en análisis de regresión: {str(e)}"

class ProjectionTool(BaseTool):
    """Herramienta para proyecciones financieras"""
    
    def __init__(self):
        super().__init__(
            name="financial_projections",
            description="Proyecciones financieras usando diferentes métodos estadísticos"
        )
    
    async def execute(self, data: list, periods_ahead: int = 12, method: str = "linear") -> str:
        """Ejecuta proyecciones financieras"""
        if not MATH_TOOLS_AVAILABLE:
            return "Error: Herramientas matemáticas no disponibles."
        
        self.logger.info(f"Proyecciones {method} para {periods_ahead} períodos")
        
        try:
            if len(data) < 3:
                return "Error: Se necesitan al menos 3 puntos de datos históricos"
            
            if method == "exponential_smoothing":
                alpha = float(kwargs.get('alpha', 0.3))
                result = advanced_math.exponential_smoothing_forecast(data, periods_ahead, alpha)
                
                response = f"""Proyección - Suavizado Exponencial:
Datos históricos: {len(data)} períodos
Períodos proyectados: {periods_ahead}
Parámetro α: {alpha}

Proyecciones:
"""
                for i, forecast in enumerate(result['forecast'], 1):
                    response += f"• Período {i}: {forecast:.2f}\n"
                
                return response
            
            elif method in ["linear", "exponential"]:
                result = advanced_math.trend_projection(data, periods_ahead, method)
                
                response = f"""Proyección - Tendencia {method.title()}:
Datos históricos: {len(data)} períodos
Períodos proyectados: {periods_ahead}
Error estándar: {result['std_error']:.4f}

Proyecciones con intervalos de confianza 95%:
"""
                for i, (proj, upper, lower) in enumerate(zip(
                    result['projections'], 
                    result['upper_confidence'], 
                    result['lower_confidence']
                ), 1):
                    response += f"• Período {i}: {proj:.2f} (IC: {lower:.2f} - {upper:.2f})\n"
                
                return response
            
            else:
                return f"Método '{method}' no soportado. Métodos disponibles: linear, exponential, exponential_smoothing"
                
        except Exception as e:
            self.logger.error(f"Error en proyecciones: {e}")
            return f"Error en proyecciones financieras: {str(e)}"

class PortfolioOptimizationTool(BaseTool):
    """Herramienta para optimización de portafolios"""
    
    def __init__(self):
        super().__init__(
            name="portfolio_optimization",
            description="Optimización de portafolios de inversión usando teoría moderna"
        )
    
    async def execute(self, expected_returns: list, cov_matrix: list, risk_tolerance: float = 1.0) -> str:
        """Ejecuta optimización de portafolio"""
        if not MATH_TOOLS_AVAILABLE:
            return "Error: Herramientas matemáticas no disponibles."
        
        self.logger.info(f"Optimización de portafolio con {len(expected_returns)} activos")
        
        try:
            if len(expected_returns) < 2:
                return "Error: Se necesitan al menos 2 activos para optimizar"
            
            # Validar matriz de covarianza
            cov_array = np.array(cov_matrix)
            if cov_array.shape[0] != cov_array.shape[1] or cov_array.shape[0] != len(expected_returns):
                return "Error: La matriz de covarianza debe ser cuadrada y coincidir con el número de activos"
            
            result = advanced_math.markowitz_optimization(expected_returns, cov_matrix, risk_tolerance)
            
            response = f"""Optimización de Portafolio - Modelo de Markowitz:
Número de activos: {len(expected_returns)}
Tolerancia al riesgo: {risk_tolerance}
Optimización exitosa: {'Sí' if result['optimization_success'] else 'No'}

Portafolio Óptimo:
• Retorno esperado: {result['expected_return']:.4f} ({result['expected_return']*100:.2f}%)
• Riesgo esperado: {result['expected_risk']:.4f} ({result['expected_risk']*100:.2f}%)
• Ratio de Sharpe: {result['sharpe_ratio']:.4f}

Pesos óptimos por activo:
"""
            
            for i, weight in enumerate(result['optimal_weights']):
                response += f"• Activo {i+1}: {weight:.4f} ({weight*100:.2f}%)\n"
            
            return response
            
        except Exception as e:
            self.logger.error(f"Error en optimización de portafolio: {e}")
            return f"Error en optimización de portafolio: {str(e)}"

class StatisticalAnalysisTool(BaseTool):
    """Herramienta para análisis estadístico completo"""
    
    def __init__(self):
        super().__init__(
            name="statistical_analysis",
            description="Análisis estadístico completo con pruebas de normalidad y detección de outliers"
        )
    
    async def execute(self, data: list, confidence_level: float = 0.95) -> str:
        """Ejecuta análisis estadístico completo"""
        if not MATH_TOOLS_AVAILABLE:
            return "Error: Herramientas matemáticas no disponibles."
        
        self.logger.info(f"Análisis estadístico de {len(data)} observaciones")
        
        try:
            if len(data) < 3:
                return "Error: Se necesitan al menos 3 observaciones para análisis estadístico"
            
            result = advanced_math.comprehensive_statistics(data, confidence_level)
            
            desc = result['descriptive_stats']
            dist = result['distribution_stats']
            ci = result['confidence_interval']
            norm = result['normality_test']
            outliers = result['outliers']
            
            response = f"""Análisis Estadístico Completo:
Muestra: {desc['count']} observaciones

ESTADÍSTICAS DESCRIPTIVAS:
• Media: {desc['mean']:.4f}
• Mediana: {desc['median']:.4f}
• Desviación estándar: {desc['std']:.4f}
• Varianza: {desc['variance']:.4f}
• Rango: {desc['range']:.4f} (Min: {desc['min']:.4f}, Max: {desc['max']:.4f})

DISTRIBUCIÓN:
• Asimetría: {dist['skewness']:.4f}
• Curtosis: {dist['kurtosis']:.4f}
• Q1: {dist['q1']:.4f}
• Q3: {dist['q3']:.4f}
• Rango intercuartílico: {dist['iqr']:.4f}

INTERVALO DE CONFIANZA ({ci['level']*100:.0f}%):
• Límite inferior: {ci['lower']:.4f}
• Límite superior: {ci['upper']:.4f}
• Margen de error: {ci['margin_error']:.4f}

PRUEBA DE NORMALIDAD (Shapiro-Wilk):
• Estadístico: {norm['shapiro_stat']:.4f}
• Valor p: {norm['shapiro_p_value']:.4f}
• ¿Es normal?: {'Sí' if norm['is_normal'] else 'No'} (α = 0.05)

VALORES ATÍPICOS:
• Cantidad: {outliers['count']} ({outliers['percentage']:.1f}% de la muestra)
"""
            
            if outliers['count'] > 0:
                response += f"• Valores: {outliers['values']}\n"
            
            # Interpretaciones
            response += "\nINTERPRETACIONES:\n"
            
            if abs(dist['skewness']) < 0.5:
                response += "• Distribución aproximadamente simétrica\n"
            elif dist['skewness'] > 0.5:
                response += "• Distribución sesgada hacia la derecha\n"
            else:
                response += "• Distribución sesgada hacia la izquierda\n"
            
            if abs(dist['kurtosis']) < 0.5:
                response += "• Curtosis normal (mesocúrtica)\n"
            elif dist['kurtosis'] > 0.5:
                response += "• Distribución leptocúrtica (colas pesadas)\n"
            else:
                response += "• Distribución platicúrtica (colas ligeras)\n"
            
            return response
            
        except Exception as e:
            self.logger.error(f"Error en análisis estadístico: {e}")
            return f"Error en análisis estadístico: {str(e)}"

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
        
        # Añadir herramientas matemáticas si están disponibles
        if MATH_TOOLS_AVAILABLE:
            tools.extend([
                MonteCarloTool(),
                RegressionTool(),
                ProjectionTool(),
                PortfolioOptimizationTool(),
                StatisticalAnalysisTool(),
            ])
            logging.info("✓ Herramientas matemáticas avanzadas cargadas")
        else:
            logging.warning("⚠ Herramientas matemáticas no disponibles")
        
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

# Funciones específicas para herramientas matemáticas
def monte_carlo_simulation(scenario: str, **kwargs) -> str:
    """Función de compatibilidad para simulaciones Monte Carlo"""
    return tool_registry.execute_tool("monte_carlo_simulation", scenario=scenario, **kwargs)

def regression_analysis(x_data: list, y_data: list, polynomial_degree: int = 1) -> str:
    """Función de compatibilidad para análisis de regresión"""
    return tool_registry.execute_tool("regression_analysis", x_data=x_data, y_data=y_data, polynomial_degree=polynomial_degree)

def financial_projections(data: list, periods_ahead: int = 12, method: str = "linear", **kwargs) -> str:
    """Función de compatibilidad para proyecciones financieras"""
    return tool_registry.execute_tool("financial_projections", data=data, periods_ahead=periods_ahead, method=method, **kwargs)

def portfolio_optimization(expected_returns: list, cov_matrix: list, risk_tolerance: float = 1.0) -> str:
    """Función de compatibilidad para optimización de portafolios"""
    return tool_registry.execute_tool("portfolio_optimization", expected_returns=expected_returns, cov_matrix=cov_matrix, risk_tolerance=risk_tolerance)

def statistical_analysis(data: list, confidence_level: float = 0.95) -> str:
    """Función de compatibilidad para análisis estadístico"""
    return tool_registry.execute_tool("statistical_analysis", data=data, confidence_level=confidence_level)