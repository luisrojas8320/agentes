import os
import operator
from flask import Flask, request, jsonify
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

# --- INICIALIZACIÓN GLOBAL (SE EJECUTA UNA SOLA VEZ AL INICIAR EL SERVIDOR) ---
load_dotenv()
app = Flask(__name__)

# --- FUNCIONES DE AYUDA (HELPERS) ---
# Estas funciones definen la lógica de negocio pero no mantienen un estado.

def create_supabase_client() -> Client:
    """Crea y devuelve un cliente de Supabase."""
    url: str = os.environ.get("SUPABASE_URL")
    key: str = os.environ.get("SUPABASE_ANON_KEY")
    if not url or not key:
        raise ValueError("Variables de entorno de Supabase no configuradas.")
    return create_client(url, key)

def get_chat_model(provider: str, model_name: str, temperature: float = 0.0):
    """Obtiene una instancia del modelo de chat según el proveedor."""
    api_key = os.environ.get(f"{provider.upper()}_API_KEY")
    if provider == "openai":
        return ChatOpenAI(model=model_name, temperature=temperature, api_key=api_key)
    elif provider == "google":
        return ChatGoogleGenerativeAI(model=model_name, temperature=temperature, api_key=api_key, convert_system_message_to_human=True)
    # Se elimina la opción 'deepseek' para garantizar la estabilidad.
    else:
        # Modelo por defecto robusto en caso de configuración inesperada.
        return ChatOpenAI(model="gpt-4o-mini", temperature=temperature, api_key=os.environ.get("OPENAI_API_KEY"))

def run_specialist_agent(agent_config: dict, task_content: str):
    """Ejecuta un agente especializado con su configuración específica."""
    try:
        model = get_chat_model(agent_config['model_provider'], agent_config['model_name'])
        system_prompt = agent_config.get('system_prompt', "Eres un asistente especializado.")
        messages = [SystemMessage(content=system_prompt), HumanMessage(content=task_content)]
        result = model.invoke(messages)
        return result.content
    except Exception as e:
        return f"Error al ejecutar el agente {agent_config['name']}: {e}"

def get_specialist_agents_as_tools(supabase: Client):
    """Obtiene los agentes de Supabase y los convierte en herramientas de LangChain."""
    response = supabase.from_("agents").select("*").neq("name", "Asistente Orquestador").execute()
    tools = []
    if not response.data:
        return []
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

# --- LÓGICA DEL GRAFO (NODOS Y ARISTAS) ---
class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]

def call_model(state, llm_with_tools):
    """Nodo que llama al LLM para que decida la siguiente acción."""
    return {"messages": [llm_with_tools.invoke(state['messages'])]}

def call_tool_executor(state, tool_executor):
    """Nodo que ejecuta las herramientas seleccionadas por el LLM."""
    last_message = state['messages'][-1]
    tool_calls = last_message.tool_calls
    tool_outputs = tool_executor.batch(tool_calls)
    tool_messages = [
        ToolMessage(content=str(output), tool_call_id=call['id'])
        for call, output in zip(tool_calls, tool_outputs)
    ]
    return {"messages": tool_messages}

def should_continue(state):
    """Arista condicional que decide si continuar o finalizar."""
    return "action" if state['messages'][-1].tool_calls else END

# --- CONSTRUCCIÓN DEL AGENTE (SE HACE UNA SOLA VEZ AL INICIAR LA APP) ---
print("Inicializando la aplicación del agente. Esto solo debería ocurrir una vez.")
app_graph = None
try:
    # 1. Crear instancias de clientes y herramientas
    supabase_client = create_supabase_client()
    specialist_tools = get_specialist_agents_as_tools(supabase_client)
    tool_executor_instance = ToolExecutor(specialist_tools)
    
    # 2. Configurar el LLM orquestador
    orchestrator_llm = get_chat_model("openai", "gpt-4o-mini")
    llm_with_tools = orchestrator_llm.bind_tools(specialist_tools)

    # 3. Definir la estructura del grafo
    workflow = StateGraph(AgentState)
    workflow.add_node("agent", lambda state: call_model(state, llm_with_tools))
    workflow.add_node("action", lambda state: call_tool_executor(state, tool_executor_instance))
    
    # 4. Conectar los nodos y aristas
    workflow.set_entry_point("agent")
    workflow.add_conditional_edges("agent", should_continue)
    workflow.add_edge("action", "agent")

    # 5. Compilar el grafo en una aplicación ejecutable
    app_graph = workflow.compile()
    print("Grafo del agente compilado y listo para recibir peticiones.")
except Exception as e:
    # Si la inicialización falla, lo registramos y la app responderá con un error.
    print(f"ERROR FATAL DURANTE LA INICIALIZACIÓN DEL AGENTE: {e}")

# --- ENDPOINTS DE LA API (LIGEROS Y RÁPIDOS) ---

@app.route('/api/chat', methods=['POST'])
def chat_handler():
    """Manejador de peticiones de chat. Utiliza el grafo pre-compilado."""
    if app_graph is None:
        return jsonify({"error": "Servicio no disponible por error de inicialización."}), 503

    try:
        data = request.get_json()
        # Extrae solo el último mensaje del usuario para la nueva invocación
        user_message_content = data.get('messages', [{}])[-1].get('content')
        if not user_message_content:
            return jsonify({"error": "Mensaje del usuario ausente."}), 400

        # El prompt del sistema define el comportamiento del orquestador
        system_prompt = "Eres un agente orquestador. Tu función es analizar la petición del usuario y delegarla a la herramienta (agente especializado) más adecuada. Si ninguna herramienta es apropiada, responde directamente."
        
        initial_messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_message_content)
        ]
        
        # Invoca el grafo de manera eficiente
        final_state = app_graph.invoke({"messages": initial_messages})
        response_content = final_state['messages'][-1].content
        
        return jsonify({"response": response_content})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Ocurrió un error interno del servidor: {e}"}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Endpoint de salud para verificar el estado del servicio."""
    status = "ok" if app_graph is not None else "degraded"
    return jsonify({"status": status}), 200

# Esta variable 'app' es la que Vercel busca para el despliegue.
# El nombre de este archivo debe ser 'index.py' y estar dentro de la carpeta '/api'.