import os
import operator
from flask import Flask, request, jsonify
from dotenv import load_dotenv
from supabase.client import create_client, Client

from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_deepseek import ChatDeepSeek

from langchain_core.messages import HumanMessage, SystemMessage, BaseMessage, ToolMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.tools import StructuredTool
from pydantic import BaseModel, Field

from typing import TypedDict, Annotated, Sequence, Type
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolExecutor

# --- Configuración Inicial ---
load_dotenv()
app = Flask(__name__)

# --- Conexión a Supabase ---
def create_supabase_client() -> Client:
    url: str = os.environ.get("SUPABASE_URL")
    key: str = os.environ.get("SUPABASE_ANON_KEY")
    if not url or not key:
        raise ValueError("Variables de entorno de Supabase no configuradas.")
    return create_client(url, key)

# --- Creador de Modelos de Lenguaje (LLMs) ---
# (Sin cambios, esta función es correcta)
def get_chat_model(provider: str, model_name: str, temperature: float = 0.0):
    api_key = os.environ.get(f"{provider.upper()}_API_KEY")
    if provider == "openai":
        return ChatOpenAI(model=model_name, temperature=temperature, api_key=api_key)
    elif provider == "google":
        return ChatGoogleGenerativeAI(model=model_name, temperature=temperature, api_key=api_key, convert_system_message_to_human=True)
    elif provider == "deepseek":
        return ChatDeepSeek(model=model_name, temperature=temperature, api_key=api_key)
    else:
        return ChatOpenAI(model="gpt-4o-mini", temperature=temperature, api_key=os.environ.get("OPENAI_API_KEY"))

# --- Lógica de Agentes Especializados ---
# (Sin cambios, esta función es correcta)
def run_specialist_agent(agent_config: dict, task_content: str):
    try:
        model = get_chat_model(agent_config['model_provider'], agent_config['model_name'])
        system_prompt = agent_config.get('system_prompt', "Eres un asistente especializado.")
        messages = [SystemMessage(content=system_prompt), HumanMessage(content=task_content)]
        result = model.invoke(messages)
        return result.content
    except Exception as e:
        return f"Error al ejecutar el agente {agent_config['name']}: {e}"

# --- Creador de Herramientas (Agentes como Herramientas) ---
# (Sin cambios, esta función es correcta)
def get_specialist_agents_as_tools(supabase: Client):
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

### --- NUEVA ARQUITECTURA CON LANGGRAPH --- ###

# 1. Definición del Estado del Grafo
# El estado es el objeto que fluye entre los nodos del grafo.
# 'messages' acumulará el historial de la conversación.
class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]

# 2. Definición de Nodos y Lógica Condicional
# Los nodos son las funciones que realizan el trabajo.

# Nodo Agente: Llama al LLM para decidir el siguiente paso.
def call_model(state, llm, tools, tool_executor):
    messages = state['messages']
    # Vincula las herramientas al LLM para que sepa cuáles puede usar
    model_with_tools = llm.bind_tools(tools)
    response = model_with_tools.invoke(messages)
    # Añade la respuesta del LLM al estado para el siguiente paso
    return {"messages": [response]}

# Nodo de Herramientas: Ejecuta las herramientas que el LLM decidió usar.
def call_tool_executor(state, tool_executor):
    # El último mensaje del 'call_model' contiene las llamadas a herramientas
    last_message = state['messages'][-1]
    tool_calls = last_message.tool_calls
    
    # Llama al ejecutor de herramientas
    tool_outputs = tool_executor.batch(tool_calls)

    # Formatea la salida como ToolMessage
    tool_messages = [
        ToolMessage(content=str(output), tool_call_id=call['id'])
        for call, output in zip(tool_calls, tool_outputs)
    ]
    return {"messages": tool_messages}

# Lógica Condicional: Decide a qué nodo ir después del 'call_model'.
def should_continue(state):
    last_message = state['messages'][-1]
    # Si el LLM llamó a una herramienta, vamos al nodo de herramientas.
    if last_message.tool_calls:
        return "action"
    # Si no, hemos terminado.
    return END

### --- API ENDPOINT PRINCIPAL --- ###
@app.route('/api/chat', methods=['POST'])
def chat_handler():
    try:
        data = request.get_json()
        user_message_content = data.get('messages', [{}])[-1].get('content')
        if not user_message_content:
            return jsonify({"error": "Mensaje del usuario ausente."}), 400

        # --- Creación y Compilación del Grafo ---
        supabase = create_supabase_client()
        tools = get_specialist_agents_as_tools(supabase)
        tool_executor = ToolExecutor(tools)

        # Usamos el orquestador principal
        llm = get_chat_model("openai", "gpt-4o-mini")

        # 1. Definir el grafo
        workflow = StateGraph(AgentState)

        # 2. Añadir los nodos
        workflow.add_node("agent", lambda state: call_model(state, llm, tools, tool_executor))
        workflow.add_node("action", lambda state: call_tool_executor(state, tool_executor))

        # 3. Definir las aristas (el flujo)
        workflow.set_entry_point("agent")
        workflow.add_conditional_edges(
            "agent",
            should_continue,
            {"action": "action", END: END}
        )
        workflow.add_edge("action", "agent")

        # 4. Compilar el grafo en una aplicación ejecutable
        app_graph = workflow.compile()
        
        # --- Invocación del Grafo ---
        system_prompt = "Eres un agente orquestador. Tu función es analizar la petición del usuario y delegarla a la herramienta (agente especializado) más adecuada. Si ninguna herramienta es apropiada, responde directamente. Si la respuesta de una herramienta es un error, informa al usuario sobre el error."
        
        initial_messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_message_content)
        ]
        
        final_state = app_graph.invoke({"messages": initial_messages})
        response_content = final_state['messages'][-1].content
        
        return jsonify({"response": response_content})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Ocurrió un error interno del servidor: {e}"}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"}), 200

# Punto de entrada para Vercel
# Esta variable 'app' es la que Vercel busca