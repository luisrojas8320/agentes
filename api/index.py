# Ruta: api/index.py
import os
import operator
import logging
import traceback
import json
from datetime import datetime, timezone
from flask import Flask, request, Response, stream_with_context, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from supabase.client import create_client, Client
import psycopg2 # Necesario para langgraph-postgres

# --- NUEVO: Importaciones para memoria persistente ---
from langgraph.checkpoint.aiopg import AsyncPostgresSaver

from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_community.chat_models import ChatDeepseek
from langchain_core.messages import (
    HumanMessage, SystemMessage, BaseMessage, ToolMessage, AIMessage
)
from langchain.tools import StructuredTool
from pydantic import BaseModel, Field
from typing import TypedDict, Annotated, Sequence
from langgraph.graph import StateGraph, END

# Importaciones de nuestros módulos
from api.tools import internet_search, analyze_url_content, search_my_documents
from api.rag_processor import process_and_store_document

# --- Configuración Inicial ---
load_dotenv()
app = Flask(__name__)

origins = [os.environ.get("VERCEL_URL", "http://localhost:3000")]
CORS(
    app,
    resources={r"/api/*": {"origins": origins}},
    supports_credentials=True,
    methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"]
)

logging.basicConfig(level=logging.INFO)

# --- NUEVO: Configuración de la memoria (checkpointer) ---
db_url = os.environ.get("POSTGRES_URL")
if not db_url:
    raise ValueError("POSTGRES_URL no está configurada para la persistencia del grafo.")
memory = AsyncPostgresSaver.from_conn_string(db_url)
_APP_GRAPH = None
_IS_INITIALIZING = False


# --- Funciones de Ayuda (sin cambios) ---
def create_supabase_client(admin=False) -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") if admin else os.environ.get("SUPABASE_ANON_KEY")
    if not url or not key: raise ValueError("Variables de Supabase no configuradas.")
    return create_client(url, key)

def get_chat_model(provider: str, model_name: str, temperature: float = 0.0):
    provider = provider.lower()
    api_key_name = f"{provider.upper()}_API_KEY"
    api_key = os.environ.get(api_key_name)
    if not api_key: raise ValueError(f"Variable de entorno {api_key_name} no encontrada.")
    
    if provider == "openai":
        return ChatOpenAI(model=model_name, temperature=temperature, api_key=api_key, streaming=True)
    elif provider == "google":
        return ChatGoogleGenerativeAI(model=model_name, temperature=temperature, api_key=api_key, convert_system_message_to_human=True, streaming=True)
    elif provider == "deepseek":
        return ChatDeepseek(model=model_name, temperature=temperature, api_key=api_key, streaming=True)
    else:
        logging.warning(f"Proveedor '{provider}' no soportado. Usando OpenAI gpt-4o-mini como fallback.")
        return ChatOpenAI(model="gpt-4o-mini", temperature=temperature, api_key=os.environ.get("OPENAI_API_KEY"), streaming=True)

def summarize_if_needed(original_query: str, tool_output: str) -> str:
    MAX_CHARS = 32000
    if len(tool_output) > MAX_CHARS:
        logging.warning("Salida de herramienta demasiado larga. Resumiendo...")
        summarizer_model = get_chat_model("openai", "gpt-4o-mini")
        prompt = f'Pregunta Original: "{original_query}"\n\nResultado de Herramienta:\n---\n{tool_output[:MAX_CHARS]}\n---\n\nResume concisamente la información relevante para responder la pregunta:'
        return summarizer_model.invoke([HumanMessage(content=prompt)]).content
    return tool_output

def get_all_available_tools(supabase_user_client: Client) -> list:
    all_tools = []
    search_tool = StructuredTool.from_function(func=internet_search, name="internet_search", description="Busca en internet para obtener información actualizada.")
    url_analyzer_tool = StructuredTool.from_function(func=analyze_url_content, name="analyze_url_content", description="Extrae texto de una imagen o PDF desde una URL.")
    
    rag_tool = StructuredTool.from_function(
        func=lambda q: search_my_documents(q, supabase_user_client),
        name="search_my_documents",
        description="Busca en los documentos personales del usuario para encontrar información relevante. Úsalo si el usuario pregunta sobre 'mi documento', 'el archivo que subí', o temas muy específicos que no son de conocimiento general."
    )
    all_tools.extend([search_tool, url_analyzer_tool, rag_tool])
    
    try:
        response = supabase_user_client.from_("agents").select("name, description, model_provider, model_name, system_prompt").neq("name", "Asistente Orquestador").execute()
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

def get_or_create_agent_graph():
    global _APP_GRAPH, _IS_INITIALIZING
    if _APP_GRAPH is not None: return _APP_GRAPH
    if _IS_INITIALIZING: return None
    _IS_INITIALIZING = True
    logging.info("Iniciando la creación del grafo del agente...")
    try:
        supabase_client = create_supabase_client(admin=False)
        all_tools = get_all_available_tools(supabase_client)
        orchestrator_llm = get_chat_model("openai", "gpt-4o")
        llm_with_tools = orchestrator_llm.bind_tools(all_tools)

        class AgentState(TypedDict):
            messages: Annotated[Sequence[BaseMessage], operator.add]

        def call_model(state):
            return {"messages": [llm_with_tools.invoke(state['messages'])]}

        def call_tool_executor(state):
            last_message = state['messages'][-1]
            tool_calls = last_message.tool_calls
            original_query = next((msg.content for msg in reversed(state['messages']) if isinstance(msg, HumanMessage)), "")
            tool_outputs = []
            tool_map = {tool.name: tool for tool in all_tools}
            for call in tool_calls:
                tool_name = call.get("name")
                if tool_name in tool_map:
                    try:
                        output = tool_map[tool_name].invoke(call.get("args"))
                        summarized_output = summarize_if_needed(original_query, str(output))
                        tool_outputs.append(ToolMessage(content=summarized_output, tool_call_id=call.get("id")))
                    except Exception as e:
                        tool_outputs.append(ToolMessage(content=f"Error al ejecutar '{tool_name}': {e}", tool_call_id=call.get("id")))
                else:
                    tool_outputs.append(ToolMessage(content=f"Error: Herramienta '{tool_name}' no encontrada.", tool_call_id=call.get("id")))
            return {"messages": tool_outputs}

        workflow = StateGraph(AgentState)
        workflow.add_node("agent", call_model)
        workflow.add_node("action", call_tool_executor)
        workflow.set_entry_point("agent")
        workflow.add_conditional_edges("agent", lambda state: "action" if state['messages'][-1].tool_calls else END)
        workflow.add_edge("action", "agent")
        
        # --- MODIFICADO: Compilar el grafo con el checkpointer de memoria ---
        _APP_GRAPH = workflow.compile(checkpointer=memory)
        logging.info("Grafo del agente compilado con memoria persistente y listo para usar.")
        return _APP_GRAPH
    except Exception as e:
        logging.error(f"ERROR FATAL DURANTE LA INICIALIZACIÓN: {e}", exc_info=True)
        _APP_GRAPH = None
        return None
    finally:
        _IS_INITIALIZING = False

def get_user_from_token(request):
    """Función de ayuda para obtener el usuario de Supabase a partir del token."""
    jwt = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not jwt:
        return None, (jsonify({"error": "Token de autorización ausente"}), 401)
    
    try:
        supabase_client = create_supabase_client()
        user_response = supabase_client.auth.get_user(jwt)
        if not user_response.user:
            return None, (jsonify({"error": "Token inválido o expirado"}), 401)
        return user_response.user, None
    except Exception as e:
        logging.error(f"Error al validar token: {e}")
        return None, (jsonify({"error": "Error interno al validar el token"}), 500)


@app.route("/")
def health_check():
    if _APP_GRAPH is None and not _IS_INITIALIZING:
        get_or_create_agent_graph()
    if _APP_GRAPH:
        return jsonify({"status": "ok", "message": "AI Playground Agent Backend está inicializado."})
    elif _IS_INITIALIZING:
        return jsonify({"status": "initializing", "message": "La inicialización del agente está en curso."}), 503
    else:
        return jsonify({"status": "error", "message": "La inicialización del agente falló."}), 500

# --- NUEVO: Endpoint para listar los chats del usuario ---
@app.route('/api/chats', methods=['GET'])
def list_chats_handler():
    user, error_response = get_user_from_token(request)
    if error_response:
        return error_response
    
    try:
        supabase_client = create_supabase_client()
        # Se asume que el cliente se inicializa con el token del usuario para que RLS funcione
        response = supabase_client.from_('chats').select('id, title, created_at').eq('user_id', user.id).order('created_at', desc=True).execute()
        
        if response.data is not None:
            return jsonify(response.data), 200
        else:
            return jsonify({"error": "No se pudieron obtener los chats."}), 500

    except Exception as e:
        logging.error(f"Error en list_chats_handler: {traceback.format_exc()}")
        return jsonify({"error": "Error interno del servidor al listar chats"}), 500


@app.route('/api/upload', methods=['POST'])
def upload_handler():
    user, error_response = get_user_from_token(request)
    if error_response:
        return error_response

    if 'file' not in request.files:
        return jsonify({"error": "No se encontró ningún archivo"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No se seleccionó ningún archivo"}), 400
    
    try:
        file_content = file.read()
        supabase_admin_client = create_supabase_client(admin=True)
        result = process_and_store_document(supabase_admin_client, file_content, user.id)
        
        if result["success"]:
            return jsonify({"message": result["message"]}), 200
        else:
            return jsonify({"error": result["message"]}), 500
            
    except Exception as e:
        logging.error(f"Error en upload_handler: {traceback.format_exc()}")
        return jsonify({"error": "Error interno del servidor al subir el archivo"}), 500

# --- MODIFICADO: Endpoint de chat para usar memoria persistente ---
@app.route('/api/chat', methods=['POST'])
async def chat_handler():
    app_graph = get_or_create_agent_graph()
    if app_graph is None:
        return Response(json.dumps({"error": "Agente no disponible."}), status=503, mimetype='application/json')
    
    user, error_response = get_user_from_token(request)
    if error_response:
        return error_response
    
    try:
        data = request.get_json()
        message_content = data.get('message', '')
        thread_id = data.get('thread_id') # Puede ser None
        
        # El cliente Supabase necesita el token para que RLS funcione en la creación del chat
        jwt = request.headers.get('Authorization')
        supabase_client = create_supabase_client()
        supabase_client.auth.set_session(access_token=jwt.replace('Bearer ', ''), refresh_token="dummy")


        # Si no hay thread_id, creamos una nueva conversación
        if not thread_id:
            first_message_content = message_content.split('\n')[0]
            title = (first_message_content[:50] + '...') if len(first_message_content) > 50 else first_message_content
            
            response = supabase_client.from_('chats').insert({
                'user_id': user.id,
                'title': title
            }).execute()
            
            if not response.data:
                 return Response(json.dumps({"error": "No se pudo crear el chat."}), status=500, mimetype='application/json')
            
            thread_id = response.data[0]['id']
            
        # Configuración para la ejecución del grafo con estado
        config = {"configurable": {"thread_id": str(thread_id)}}

        current_date = datetime.now(timezone.utc).strftime('%d de %B de %Y')
        system_prompt = f"Hoy es {current_date}. Eres un orquestador experto. Tu principal objetivo es determinar la intención del usuario y seleccionar la herramienta más adecuada de tu lista. Si la petición es un saludo o una pregunta general sin tarea clara, responde directamente. Cuando una herramienta te devuelva información, sintetízala en una respuesta clara y concisa para el usuario, basándote siempre en la fecha actual."
        
        input_message = HumanMessage(content=message_content)
        
        # El checkpointer ya maneja el historial, pero inyectamos el system prompt si es la primera vez.
        current_state = await memory.aget(config)
        if not current_state:
            input_messages = [SystemMessage(content=system_prompt), input_message]
        else:
            input_messages = [input_message]

        async def generate_stream():
            try:
                # El 'stream' ahora recibe la configuración del hilo
                async for chunk in app_graph.astream({"messages": input_messages}, config=config, recursion_limit=25):
                    if 'agent' in chunk:
                        agent_messages = chunk['agent'].get('messages', [])
                        if agent_messages:
                            ai_message = agent_messages[-1]
                            if ai_message.content and not ai_message.tool_calls:
                                yield f"data: {json.dumps({'content': ai_message.content, 'thread_id': str(thread_id)})}\n\n"
            except Exception as e:
                logging.error(f"Error en stream: {traceback.format_exc()}")
                yield f"data: {json.dumps({'error': f'Error en el backend: {str(e)}'})}\n\n"
            yield f"data: [DONE]\n\n"
            
        return Response(stream_with_context(generate_stream()), mimetype='text/event-stream')
    except Exception as e:
        logging.error(f"Error en chat_handler: {traceback.format_exc()}")
        return Response(json.dumps({"error": f"Error en el servidor: {str(e)}"}), status=500, mimetype='application/json')


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
