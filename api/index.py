import os
import operator
import logging
import traceback
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from supabase.client import create_client, Client
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage, BaseMessage, ToolMessage
from langchain.tools import StructuredTool
from pydantic import BaseModel, Field
from typing import TypedDict, Annotated, Sequence
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolExecutor

# --- Configuración Inicial y Estado Global ---
load_dotenv()
app = Flask(__name__)
# Permitir peticiones desde tu dominio de Vercel y localhost
CORS(app, resources={r"/*": {"origins": [os.environ.get("VERCEL_URL", "http://localhost:3000")]}})
logging.basicConfig(level=logging.INFO)

# Variables globales para gestionar el estado del grafo compilado
_APP_GRAPH = None
_IS_INITIALIZING = False

# --- Lógica de Creación/Obtención del Grafo (Optimizada) ---
def get_or_create_agent_graph():
    global _APP_GRAPH, _IS_INITIALIZING
    
    # Si el grafo ya está compilado, devolverlo inmediatamente.
    if _APP_GRAPH is not None:
        return _APP_GRAPH

    # Si otra petición ya está inicializando, esperar.
    if _IS_INITIALIZING:
        logging.info("La inicialización ya está en curso, esperando...")
        # En un entorno de producción real, aquí podría haber un bucle de espera con timeout.
        # Por simplicidad, devolvemos None, y el endpoint lo manejará.
        return None 

    _IS_INITIALIZING = True
    logging.info("Iniciando la creación del grafo del agente...")
    try:
        supabase_client = create_supabase_client()
        specialist_tools = get_specialist_agents_as_tools(supabase_client)
        if not specialist_tools:
            logging.warning("No se encontraron herramientas de agentes especializados en Supabase.")
        
        tool_executor_instance = ToolExecutor(specialist_tools)
        orchestrator_llm = get_chat_model("openai", "gpt-4o-mini")
        llm_with_tools = orchestrator_llm.bind_tools(specialist_tools)

        class AgentState(TypedDict):
            messages: Annotated[Sequence[BaseMessage], operator.add]

        def call_model(state):
            return {"messages": [llm_with_tools.invoke(state['messages'])]}

        def call_tool_executor(state):
            last_message = state['messages'][-1]
            tool_calls = last_message.tool_calls
            tool_outputs = tool_executor_instance.batch(tool_calls)
            return {"messages": [ToolMessage(content=str(output), tool_call_id=call['id']) for call, output in zip(tool_calls, tool_outputs)]}

        def should_continue(state):
            last_message = state['messages'][-1]
            return "action" if hasattr(last_message, 'tool_calls') and last_message.tool_calls else END

        workflow = StateGraph(AgentState)
        workflow.add_node("agent", call_model)
        workflow.add_node("action", call_tool_executor)
        workflow.set_entry_point("agent")
        workflow.add_conditional_edges("agent", should_continue, {"action": "action", END: END})
        workflow.add_edge("action", "agent")

        # Asignar el grafo compilado a la variable global
        _APP_GRAPH = workflow.compile()
        logging.info("Grafo del agente compilado y listo para usar.")
        return _APP_GRAPH
    except Exception:
        logging.error(f"ERROR FATAL DURANTE LA INICIALIZACIÓN DEL GRAFO: {traceback.format_exc()}")
        _APP_GRAPH = None # Asegurarse de que el grafo no se considere inicializado si falla
        return None
    finally:
        _IS_INITIALIZING = False


# --- Rutas de la API ---

@app.route("/")
def health_check():
    """
    Endpoint de "calentamiento" y chequeo de salud.
    Dispara la inicialización del grafo si no está listo.
    """
    if _APP_GRAPH is None and not _IS_INITIALIZING:
        get_or_create_agent_graph() # Dispara la inicialización
    
    if _APP_GRAPH:
        return jsonify({"status": "ok", "message": "AI Playground Agent Backend está inicializado y corriendo."})
    elif _IS_INITIALIZING:
        return jsonify({"status": "initializing", "message": "La inicialización del agente está en curso."}), 503
    else:
        return jsonify({"status": "error", "message": "La inicialización del agente falló. Revise los logs del backend."}), 500

@app.route('/api/chat', methods=['POST'])
def chat_handler():
    # Obtener el grafo. No intentar crearlo aquí, solo obtenerlo.
    app_graph = get_or_create_agent_graph()

    if app_graph is None:
        # Esto puede ocurrir si el backend recién arrancó y la inicialización no ha terminado o falló.
        return jsonify({"error": "El agente se está inicializando o ha fallado. Por favor, inténtelo de nuevo en un momento."}), 503 # 503 Service Unavailable
        
    try:
        data = request.get_json()
        if not data or not data.get('messages'):
             return jsonify({"error": "Estructura de mensaje inválida."}), 400

        user_message_content = data['messages'][-1].get('content')
        if not user_message_content:
            return jsonify({"error": "Mensaje del usuario ausente o vacío."}), 400
            
        system_prompt = "Eres un agente orquestador experto. Tu trabajo es analizar la petición del usuario y delegarla a la herramienta/agente especializado más adecuado. No respondas directamente al usuario. Tu única función es llamar a la herramienta correcta."
        initial_messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_message_content)]
        
        # Invocar el grafo con el estado inicial
        final_state = app_graph.invoke({"messages": initial_messages})
        response_content = final_state['messages'][-1].content
        
        return jsonify({"response": response_content})
        
    except Exception:
        logging.error(f"Error en el manejador de chat: {traceback.format_exc()}")
        return jsonify({"error": "Ocurrió un error interno del servidor durante el procesamiento del chat."}), 500

# --- Funciones de Ayuda (Sin cambios) ---

def create_supabase_client() -> Client:
    url: str = os.environ.get("SUPABASE_URL")
    key: str = os.environ.get("SUPABASE_ANON_KEY")
    if not url or not key:
        raise ValueError("Variables de entorno de Supabase (URL y ANON_KEY) no configuradas.")
    return create_client(url, key)

def get_chat_model(provider: str, model_name: str, temperature: float = 0.0):
    api_key_name = f"{provider.upper()}_API_KEY"
    api_key = os.environ.get(api_key_name)
    if not api_key:
        raise ValueError(f"La variable de entorno {api_key_name} no está configurada.")

    if provider == "openai":
        return ChatOpenAI(model=model_name, temperature=temperature, api_key=api_key)
    elif provider == "google":
        return ChatGoogleGenerativeAI(model=model_name, temperature=temperature, api_key=api_key, convert_system_message_to_human=True)
    else:
        logging.warning(f"Proveedor '{provider}' no soportado. Usando OpenAI gpt-4o-mini como fallback.")
        fallback_key = os.environ.get("OPENAI_API_KEY")
        return ChatOpenAI(model="gpt-4o-mini", temperature=temperature, api_key=fallback_key)

def get_specialist_agents_as_tools(supabase: Client) -> list:
    try:
        response = supabase.from_("agents").select("name, description, model_provider, model_name, system_prompt").neq("name", "Asistente Orquestador").execute()
    except Exception as e:
        logging.error(f"Error al obtener agentes de Supabase: {e}")
        return []
    
    tools = []
    if not response.data:
        return []

    for agent_config in response.data:
        class ToolSchema(BaseModel):
            task: str = Field(description=f"La tarea específica o pregunta detallada para el agente '{agent_config['name']}'. Debe contener todo el contexto necesario para que el agente pueda ejecutar la tarea de forma autónoma.")
        
        def run_specialist_agent(task: str, cfg=agent_config):
            logging.info(f"Delegando tarea al agente especializado: {cfg['name']}")
            model = get_chat_model(cfg['model_provider'], cfg['model_name'])
            system_prompt = cfg.get('system_prompt', "Eres un asistente experto.")
            messages = [SystemMessage(content=system_prompt), HumanMessage(content=task)]
            result = model.invoke(messages)
            return result.content

        tool_name = agent_config['name'].lower().replace(' ', '_').replace('-', '_')
        tool = StructuredTool.from_function(
            func=run_specialist_agent,
            name=tool_name,
            description=f"Agente especializado en: {agent_config['description']}. Úsalo para tareas relacionadas.",
            args_schema=ToolSchema
        )
        tools.append(tool)
    logging.info(f"Cargadas {len(tools)} herramientas de agentes especializados.")
    return tools

# --- Punto de Entrada para Gunicorn/Cloud Run ---
if __name__ == "__main__":
    get_or_create_agent_graph() # Pre-calentar al iniciar localmente
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))