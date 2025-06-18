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

# --- Configuración Inicial ---
load_dotenv()
app = Flask(__name__)
CORS(app)
logging.basicConfig(level=logging.INFO)

# Variable global para almacenar en caché el grafo del agente una vez creado
_APP_GRAPH = None

# --- Funciones de Ayuda (sin cambios) ---
def create_supabase_client() -> Client:
    url: str = os.environ.get("SUPABASE_URL")
    key: str = os.environ.get("SUPABASE_ANON_KEY")
    if not url or not key:
        raise ValueError("Variables de entorno de Supabase no configuradas.")
    return create_client(url, key)

def get_chat_model(provider: str, model_name: str, temperature: float = 0.0):
    api_key = os.environ.get(f"{provider.upper()}_API_KEY")
    if provider == "openai":
        return ChatOpenAI(model=model_name, temperature=temperature, api_key=api_key)
    elif provider == "google":
        return ChatGoogleGenerativeAI(model=model_name, temperature=temperature, api_key=api_key, convert_system_message_to_human=True)
    else:
        return ChatOpenAI(model="gpt-4o-mini", temperature=temperature, api_key=os.environ.get("OPENAI_API_KEY"))

def get_specialist_agents_as_tools(supabase: Client):
    response = supabase.from_("agents").select("*").neq("name", "Asistente Orquestador").execute()
    tools = []
    if not response.data: return []
    for agent_config in response.data:
        class ToolSchema(BaseModel):
            task: str = Field(description=f"La tarea específica o pregunta detallada para el agente '{agent_config['name']}'.")
        tool = StructuredTool.from_function(
            func=lambda task, cfg=agent_config: run_specialist_agent(cfg, task),
            name=agent_config['name'].lower().replace(' ', '_'),
            description=f"Agente especializado en: {agent_config['description']}. Úsalo para tareas relacionadas.",
            args_schema=ToolSchema
        )
        tools.append(tool)
    return tools

def run_specialist_agent(agent_config: dict, task_content: str):
    model = get_chat_model(agent_config['model_provider'], agent_config['model_name'])
    system_prompt = agent_config.get('system_prompt', "Eres un asistente especializado.")
    messages = [SystemMessage(content=system_prompt), HumanMessage(content=task_content)]
    result = model.invoke(messages)
    return result.content

# --- Lógica de Creación del Grafo ---
def get_or_create_agent_graph():
    """
    Crea el grafo del agente si no existe (en la primera petición) 
    o devuelve la instancia existente en memoria.
    """
    global _APP_GRAPH
    if _APP_GRAPH is not None:
        return _APP_GRAPH

    logging.info("Creando instancia del grafo del agente por primera vez...")
    try:
        supabase_client = create_supabase_client()
        specialist_tools = get_specialist_agents_as_tools(supabase_client)
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
            return "action" if state['messages'][-1].tool_calls else END

        workflow = StateGraph(AgentState)
        workflow.add_node("agent", call_model)
        workflow.add_node("action", call_tool_executor)
        workflow.set_entry_point("agent")
        workflow.add_conditional_edges("agent", should_continue)
        workflow.add_edge("action", "agent")

        _APP_GRAPH = workflow.compile()
        logging.info("Grafo del agente compilado y listo en memoria.")
        return _APP_GRAPH
    except Exception as e:
        logging.error("ERROR FATAL DURANTE LA INICIALIZACIÓN DEL AGENTE:")
        logging.error(traceback.format_exc())
        raise e

# --- Rutas de la API ---
@app.route("/")
def health_check():
    return jsonify({"status": "ok", "message": "AI Playground Agent Backend is running."})

@app.route('/api/chat', methods=['POST'])
def chat_handler():
    try:
        app_graph = get_or_create_agent_graph()
        if app_graph is None:
            return jsonify({"error": "Servicio no disponible, el agente no pudo inicializarse."}), 503
            
        data = request.get_json()
        user_message_content = data.get('messages', [{}])[-1].get('content')
        if not user_message_content:
            return jsonify({"error": "Mensaje del usuario ausente."}), 400
            
        system_prompt = "Eres un agente orquestador. Tu función es analizar la petición del usuario y delegarla a la herramienta (agente especializado) más adecuada. Si ninguna herramienta es apropiada, responde directamente."
        initial_messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_message_content)]
        
        final_state = app_graph.invoke({"messages": initial_messages})
        response_content = final_state['messages'][-1].content
        
        return jsonify({"response": response_content})
        
    except Exception as e:
        logging.error(f"Error en chat_handler: {e}")
        logging.error(traceback.format_exc())
        return jsonify({"error": "Ocurrió un error interno del servidor."}), 500