# Ruta: api/index.py
import os
import operator
import logging
import traceback
import json
from flask import Flask, request, Response, stream_with_context, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from supabase.client import create_client, Client

from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import (
    HumanMessage, SystemMessage, BaseMessage, ToolMessage, AIMessage
)
from langchain.tools import StructuredTool
from pydantic import BaseModel, Field
from typing import TypedDict, Annotated, Sequence
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolExecutor

from api.tools import internet_search, analyze_url_content

# --- Configuración Inicial y Estado Global ---
load_dotenv()
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": [os.environ.get("VERCEL_URL", "http://localhost:3000")]}})
logging.basicConfig(level=logging.INFO)

_APP_GRAPH = None
_IS_INITIALIZING = False

# --- Funciones de Ayuda (sin cambios) ---
def create_supabase_client() -> Client:
    url: str = os.environ.get("SUPABASE_URL")
    key: str = os.environ.get("SUPABASE_ANON_KEY")
    if not url or not key: raise ValueError("Variables de entorno de Supabase no configuradas.")
    return create_client(url, key)

def get_chat_model(provider: str, model_name: str, temperature: float = 0.0):
    api_key = os.environ.get(f"{provider.upper()}_API_KEY")
    if not api_key: raise ValueError(f"Variable de entorno {provider.upper()}_API_KEY no encontrada.")
    if provider == "openai": return ChatOpenAI(model=model_name, temperature=temperature, api_key=api_key, streaming=True)
    elif provider == "google": return ChatGoogleGenerativeAI(model=model_name, temperature=temperature, api_key=api_key, convert_system_message_to_human=True, streaming=True)
    else: return ChatOpenAI(model="gpt-4o-mini", temperature=temperature, api_key=os.environ.get("OPENAI_API_KEY"), streaming=True)

def get_all_available_tools(supabase: Client) -> list:
    all_tools = []
    search_tool = StructuredTool.from_function(func=internet_search, name="internet_search", description="Busca en internet para obtener información actualizada o responder preguntas sobre eventos recientes, personas o temas generales.")
    url_analyzer_tool = StructuredTool.from_function(func=analyze_url_content, name="analyze_url_content", description="Extrae texto de una imagen o PDF a partir de una URL. Útil para leer contenido de enlaces.")
    all_tools.extend([search_tool, url_analyzer_tool])
    try:
        response = supabase.from_("agents").select("name, description, model_provider, model_name, system_prompt").neq("name", "Asistente Orquestador").execute()
        if response.data:
            for agent_config in response.data:
                class ToolSchema(BaseModel):
                    task: str = Field(description=f"La tarea o pregunta detallada para el agente '{agent_config['name']}'.")
                def run_specialist_agent(task: str, cfg=agent_config):
                    model = get_chat_model(cfg['model_provider'], cfg['model_name'])
                    messages = [SystemMessage(content=cfg.get('system_prompt')), HumanMessage(content=task)]
                    return model.invoke(messages).content
                tool_name = agent_config['name'].lower().replace(' ', '_').replace('-', '_')
                specialist_tool = StructuredTool.from_function(func=run_specialist_agent, name=tool_name, description=f"Agente especializado: {agent_config['description']}", args_schema=ToolSchema)
                all_tools.append(specialist_tool)
    except Exception as e:
        logging.error(f"Error al obtener agentes de Supabase: {e}")
    logging.info(f"Cargadas {len(all_tools)} herramientas.")
    return all_tools

# --- Lógica de Creación del Grafo con Ejecutor de Herramientas Manual ---
def get_or_create_agent_graph():
    global _APP_GRAPH, _IS_INITIALIZING
    if _APP_GRAPH is not None: return _APP_GRAPH
    if _IS_INITIALIZING: return None 
    _IS_INITIALIZING = True
    logging.info("Iniciando la creación del grafo del agente...")
    try:
        supabase_client = create_supabase_client()
        all_tools = get_all_available_tools(supabase_client)
        
        orchestrator_llm = get_chat_model("openai", "gpt-4o-mini")
        llm_with_tools = orchestrator_llm.bind_tools(all_tools)

        class AgentState(TypedDict):
            messages: Annotated[Sequence[BaseMessage], operator.add]

        def call_model(state):
            return {"messages": [llm_with_tools.invoke(state['messages'])]}

        # --- CORRECCIÓN DEFINITIVA: Ejecutor de Herramientas Manual ---
        def call_tool_executor(state):
            last_message = state['messages'][-1]
            tool_calls = last_message.tool_calls
            tool_outputs = []

            # Creamos un mapa de herramientas para un acceso rápido
            tool_map = {tool.name: tool for tool in all_tools}

            for call in tool_calls:
                tool_name = call.get("name")
                if tool_name in tool_map:
                    try:
                        # Invocamos la herramienta con sus argumentos
                        output = tool_map[tool_name].invoke(call.get("args"))
                        tool_outputs.append(ToolMessage(content=str(output), tool_call_id=call.get("id")))
                    except Exception as e:
                        error_message = f"Error al ejecutar la herramienta '{tool_name}': {e}"
                        logging.error(f"{error_message} - Traceback: {traceback.format_exc()}")
                        tool_outputs.append(ToolMessage(content=error_message, tool_call_id=call.get("id")))
                else:
                    tool_outputs.append(ToolMessage(content=f"Error: Herramienta '{tool_name}' no encontrada.", tool_call_id=call.get("id")))
            
            return {"messages": tool_outputs}

        def should_continue(state):
            return "action" if state['messages'][-1].tool_calls else END

        workflow = StateGraph(AgentState)
        workflow.add_node("agent", call_model)
        workflow.add_node("action", call_tool_executor)
        workflow.set_entry_point("agent")
        workflow.add_conditional_edges("agent", should_continue)
        workflow.add_edge("action", "agent")

        _APP_GRAPH = workflow.compile()
        logging.info("Grafo del agente compilado y listo para usar.")
        return _APP_GRAPH
    except Exception as e:
        logging.error(f"ERROR FATAL DURANTE LA INICIALIZACIÓN: {e}")
        _APP_GRAPH = None; return None
    finally:
        _IS_INITIALIZING = False

# --- Rutas de la API (sin cambios desde la última versión) ---
@app.route("/")
def health_check():
    # ... (sin cambios)
    pass

@app.route('/api/chat', methods=['POST'])
def chat_handler():
    # ... (sin cambios)
    pass

# --- Punto de Entrada ---
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)