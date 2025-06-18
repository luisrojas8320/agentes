import os
import operator
import logging
import traceback
import json
from flask import Flask, request, Response, stream_with_context
from flask_cors import CORS
from dotenv import load_dotenv
from supabase.client import create_client, Client

from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage, BaseMessage, ToolMessage, AIMessage
from langchain.tools import StructuredTool
from pydantic import BaseModel, Field
from typing import TypedDict, Annotated, Sequence
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolExecutor

# --- Configuración Inicial y Estado Global ---
load_dotenv()
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": [os.environ.get("VERCEL_URL", "http://localhost:3000")]}})
logging.basicConfig(level=logging.INFO)

_APP_GRAPH = None
_IS_INITIALIZING = False

# --- LÓGICA DE CREACIÓN/OBTENCIÓN DEL GRAFO (COMPLETA) ---
def get_or_create_agent_graph():
    global _APP_GRAPH, _IS_INITIALIZING
    
    if _APP_GRAPH is not None: return _APP_GRAPH
    if _IS_INITIALIZING: return None 

    _IS_INITIALIZING = True
    logging.info("Iniciando la creación del grafo del agente...")
    try:
        supabase_client = create_supabase_client()
        specialist_tools = get_specialist_agents_as_tools(supabase_client)
        
        tool_executor_instance = ToolExecutor(specialist_tools)
        orchestrator_llm = get_chat_model("openai", "gpt-4o-mini")
        llm_with_tools = orchestrator_llm.bind_tools(specialist_tools)

        class AgentState(TypedDict):
            messages: Annotated[Sequence[BaseMessage], operator.add]

        def call_model(state):
            # La respuesta del LLM puede ser AIMessage con contenido o con tool_calls
            response = llm_with_tools.invoke(state['messages'])
            return {"messages": [response]}

        def call_tool_executor(state):
            last_message = state['messages'][-1]
            tool_calls = last_message.tool_calls
            tool_outputs = tool_executor_instance.batch(tool_calls)
            tool_messages = [ToolMessage(content=str(output), tool_call_id=call['id']) for call, output in zip(tool_calls, tool_outputs)]
            return {"messages": tool_messages}

        def should_continue(state):
            last_message = state['messages'][-1]
            return "action" if hasattr(last_message, 'tool_calls') and last_message.tool_calls else END

        workflow = StateGraph(AgentState)
        workflow.add_node("agent", call_model)
        workflow.add_node("action", call_tool_executor)
        workflow.set_entry_point("agent")
        workflow.add_conditional_edges("agent", should_continue, {"action": "action", END: END})
        workflow.add_edge("action", "agent")

        _APP_GRAPH = workflow.compile()
        logging.info("Grafo del agente compilado y listo para usar.")
        return _APP_GRAPH
    except Exception:
        logging.error(f"ERROR FATAL DURANTE LA INICIALIZACIÓN DEL GRAFO: {traceback.format_exc()}")
        _APP_GRAPH = None
        return None
    finally:
        _IS_INITIALIZING = False


# --- RUTAS DE LA API (Streaming y Health Check) ---

@app.route("/")
def health_check():
    if _APP_GRAPH is None and not _IS_INITIALIZING:
        get_or_create_agent_graph()
    
    if _APP_GRAPH:
        return jsonify({"status": "ok", "message": "AI Playground Agent Backend está inicializado y corriendo."})
    elif _IS_INITIALIZING:
        return jsonify({"status": "initializing", "message": "La inicialización del agente está en curso."}), 503
    else:
        return jsonify({"status": "error", "message": "La inicialización del agente falló. Revise los logs del backend."}), 500

@app.route('/api/chat', methods=['POST'])
def chat_handler():
    app_graph = get_or_create_agent_graph()
    if app_graph is None:
        error_msg = json.dumps({"error": "El agente se está inicializando o ha fallado. Por favor, inténtelo de nuevo en un momento."})
        return Response(error_msg, status=503, mimetype='application/json')

    try:
        data = request.get_json()
        if not data or not data.get('messages'):
            error_msg = json.dumps({"error": "Estructura de mensaje inválida."})
            return Response(error_msg, status=400, mimetype='application/json')

        history = data['messages']
        input_messages = []
        for msg in history:
            if msg['role'] == 'user':
                input_messages.append(HumanMessage(content=msg['content']))
            elif msg['role'] == 'assistant':
                 input_messages.append(AIMessage(content=msg['content']))
        
        if not any(isinstance(m, SystemMessage) for m in input_messages):
            system_prompt = "Eres un agente orquestador experto. Tu trabajo es analizar la petición del usuario y delegarla a la herramienta/agente especializado más adecuado. Si la petición es un saludo o no corresponde a ninguna herramienta, responde amablemente."
            input_messages.insert(0, SystemMessage(content=system_prompt))
            
        def generate_stream():
            try:
                # Usamos .stream() para obtener la respuesta en trozos
                final_answer_streamed = ""
                for chunk in app_graph.stream({"messages": input_messages}):
                    # Buscamos el nodo final del grafo que contiene la respuesta
                    if END in chunk:
                        last_message = chunk[END]['messages'][-1]
                        # El contenido de la respuesta final es lo que queremos streamear
                        if isinstance(last_message.content, str):
                           final_answer_streamed += last_message.content
                
                # Para simular streaming de palabras si la respuesta completa llega de golpe
                # Esto es útil si el LLM no soporta streaming nativo en esta configuración
                if final_answer_streamed:
                    yield f"data: {json.dumps({'content': final_answer_streamed})}\n\n"
                else: # Si no hay contenido, quizás fue una llamada a herramienta sin respuesta directa
                    yield f"data: {json.dumps({'content': 'Tarea procesada.'})}\n\n"

            except Exception as e:
                logging.error(f"Error durante el streaming: {traceback.format_exc()}")
                yield f"data: {json.dumps({'error': 'Ocurrió un error en el servidor durante el streaming.'})}\n\n"
            
            yield f"data: [DONE]\n\n"

        return Response(stream_with_context(generate_stream()), mimetype='text/event-stream')

    except Exception as e:
        logging.error(f"Error en chat_handler: {traceback.format_exc()}")
        error_msg = json.dumps({"error": "Ocurrió un error interno del servidor."})
        return Response(error_msg, status=500, mimetype='application/json')

# --- FUNCIONES DE AYUDA (COMPLETAS) ---

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

    # Habilitar streaming en los modelos
    if provider == "openai":
        return ChatOpenAI(model=model_name, temperature=temperature, api_key=api_key, streaming=True)
    elif provider == "google":
        return ChatGoogleGenerativeAI(model=model_name, temperature=temperature, api_key=api_key, convert_system_message_to_human=True, streaming=True)
    else:
        fallback_key = os.environ.get("OPENAI_API_KEY")
        return ChatOpenAI(model="gpt-4o-mini", temperature=temperature, api_key=fallback_key, streaming=True)

def get_specialist_agents_as_tools(supabase: Client) -> list:
    try:
        response = supabase.from_("agents").select("name, description, model_provider, model_name, system_prompt").neq("name", "Asistente Orquestador").execute()
    except Exception as e:
        logging.error(f"Error al obtener agentes de Supabase: {e}")
        return []
    
    tools = []
    if not response.data: return []

    for agent_config in response.data:
        class ToolSchema(BaseModel):
            task: str = Field(description=f"La tarea específica o pregunta detallada para el agente '{agent_config['name']}'.")
        
        # Función interna que será envuelta por la herramienta
        def run_specialist_agent(task: str, cfg=agent_config):
            logging.info(f"Delegando tarea al agente especializado: {cfg['name']}")
            # El modelo especializado también puede soportar streaming, pero para la herramienta devolvemos la respuesta completa
            model = get_chat_model(cfg['model_provider'], cfg['model_name'])
            system_prompt = cfg.get('system_prompt', "Eres un asistente experto.")
            messages = [SystemMessage(content=system_prompt), HumanMessage(content=task)]
            result = model.invoke(messages)
            return result.content

        tool_name = agent_config['name'].lower().replace(' ', '_').replace('-', '_')
        tool = StructuredTool.from_function(
            func=run_specialist_agent, name=tool_name,
            description=f"Agente especializado en: {agent_config['description']}. Úsalo para tareas relacionadas.",
            args_schema=ToolSchema
        )
        tools.append(tool)
    logging.info(f"Cargadas {len(tools)} herramientas de agentes especializados.")
    return tools

# --- Punto de Entrada para Gunicorn/Cloud Run ---
if __name__ == "__main__":
    get_or_create_agent_graph()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))