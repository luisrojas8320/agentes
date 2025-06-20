# api/index.py - Backend actualizado con soporte MCP
import os
import operator
import logging
import traceback
import json
import asyncio
from datetime import datetime, timezone
from flask import Flask, request, Response, stream_with_context, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from supabase.client import create_client, Client

# Importaciones MCP y herramientas mejoradas
from api.mcp_client import initialize_mcp_clients, get_mcp_tools_for_langchain, cleanup_mcp_clients
from api.tools import tool_registry

# CORREGIDO: Importaciones simplificadas y seguras
try:
    from langgraph.checkpoint import MemorySaver
    CHECKPOINTER_AVAILABLE = True
    logging.info("MemorySaver disponible")
except ImportError:
    CHECKPOINTER_AVAILABLE = False
    logging.warning("No hay checkpointer disponible")

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import (
    HumanMessage, SystemMessage, BaseMessage, ToolMessage, AIMessage
)
from langchain.tools import StructuredTool
from pydantic import BaseModel, Field
from typing import TypedDict, Annotated, Sequence
from langgraph.graph import StateGraph, END

from api.rag_processor import process_and_store_document

load_dotenv()
app = Flask(__name__)

# CORREGIDO: Configuración CORS simplificada
CORS(app, origins=["*"], methods=["GET", "POST", "OPTIONS"], 
     allow_headers=["Content-Type", "Authorization", "Origin", "Accept"])

@app.after_request
def after_request(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Origin, Accept'
    return response

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = Response()
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Origin, Accept'
        return response

logging.basicConfig(level=logging.INFO)

# Variables globales para MCP y sistema
memory = None
_APP_GRAPH = None
_IS_INITIALIZING = False
_MCP_INITIALIZED = False

# CORREGIDO: Configurar checkpointer simplificado
def setup_memory():
    if CHECKPOINTER_AVAILABLE:
        try:
            memory = MemorySaver()
            logging.info("Usando MemorySaver para persistencia de conversaciones")
            return memory
        except Exception as e:
            logging.error(f"Error configurando MemorySaver: {e}")
    
    logging.warning("Sin memoria persistente - conversaciones no se guardarán entre reinicializaciones")
    return None

def create_supabase_client(admin=False) -> Client:
    url = os.environ.get("SUPABASE_URL")
    anon_key = os.environ.get("SUPABASE_ANON_KEY")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    
    key = service_key if admin else anon_key
    if not url or not key: 
        raise ValueError(f"Variables de Supabase no configuradas. URL: {url}, Key: {'***' if key else None}")
    return create_client(url, key)

def get_chat_model(provider: str, model_name: str, temperature: float = 0.0):
    provider = provider.lower()
    api_key_name = f"{provider.upper()}_API_KEY"
    api_key = os.environ.get(api_key_name)
    if not api_key: 
        raise ValueError(f"Variable de entorno {api_key_name} no encontrada.")
    
    if provider == "openai":
        return ChatOpenAI(model=model_name, temperature=temperature, api_key=api_key, streaming=True)
    elif provider == "google":
        return ChatGoogleGenerativeAI(model=model_name, temperature=temperature, api_key=api_key, convert_system_message_to_human=True, streaming=True)
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

async def get_all_available_tools(supabase_user_client: Client) -> list:
    """Obtiene todas las herramientas disponibles incluyendo MCP"""
    global _MCP_INITIALIZED
    all_tools = []
    
    # Herramientas básicas del sistema
    search_tool = StructuredTool.from_function(
        func=lambda q: tool_registry.execute_tool("internet_search", query=q),
        name="internet_search", 
        description="Busca en internet para obtener información actualizada."
    )
    
    url_analyzer_tool = StructuredTool.from_function(
        func=lambda url: tool_registry.execute_tool("analyze_url_content", url=url),
        name="analyze_url_content", 
        description="Extrae texto de una imagen o PDF desde una URL."
    )
    
    rag_tool = StructuredTool.from_function(
        func=lambda q: tool_registry.execute_tool("search_my_documents", query=q, supabase_user_client=supabase_user_client),
        name="search_my_documents",
        description="Busca en los documentos personales del usuario para encontrar información relevante."
    )
    
    all_tools.extend([search_tool, url_analyzer_tool, rag_tool])
    
    # Herramientas MCP
    if _MCP_INITIALIZED:
        try:
            mcp_tools = await get_mcp_tools_for_langchain()
            all_tools.extend(mcp_tools)
            logging.info(f"Añadidas {len(mcp_tools)} herramientas MCP")
        except Exception as e:
            logging.error(f"Error obteniendo herramientas MCP: {e}")
    
    # Agentes especializados de Supabase
    try:
        response = supabase_user_client.from_("agents").select("name, description, model_provider, model_name, system_prompt").neq("name", "Asistente Orquestador").execute()
        if response.data:
            for agent_config in response.data:
                if agent_config['model_provider'].lower() not in ['openai', 'google']:
                    logging.warning(f"Saltando agente {agent_config['name']} con proveedor no soportado: {agent_config['model_provider']}")
                    continue
                    
                class ToolSchema(BaseModel):
                    task: str = Field(description=f"La tarea o pregunta detallada para el agente '{agent_config['name']}'.")
                
                def run_specialist_agent(task: str, cfg=agent_config):
                    model = get_chat_model(cfg['model_provider'], cfg['model_name'])
                    messages = [SystemMessage(content=cfg.get('system_prompt')), HumanMessage(content=task)]
                    return model.invoke(messages).content
                
                tool_name = agent_config['name'].lower().replace(' ', '_').replace('-', '_')
                specialist_tool = StructuredTool.from_function(
                    func=run_specialist_agent, 
                    name=tool_name, 
                    description=f"Agente especializado: {agent_config['description']}", 
                    args_schema=ToolSchema
                )
                all_tools.append(specialist_tool)
    except Exception as e:
        logging.error(f"Error al obtener agentes de Supabase: {e}")
    
    logging.info(f"Cargadas {len(all_tools)} herramientas totales")
    return all_tools

def get_or_create_agent_graph():
    global _APP_GRAPH, _IS_INITIALIZING
    if _APP_GRAPH is not None: 
        return _APP_GRAPH
    if _IS_INITIALIZING: 
        return None
    
    _IS_INITIALIZING = True
    logging.info("Iniciando la creación del grafo del agente...")
    
    try:
        supabase_client = create_supabase_client(admin=False)
        
        # Obtener herramientas en un bucle de eventos asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        all_tools = loop.run_until_complete(get_all_available_tools(supabase_client))
        loop.close()
        
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
        
        # CORREGIDO: Compilar con o sin checkpointer
        global memory
        memory = setup_memory()
        if memory:
            _APP_GRAPH = workflow.compile(checkpointer=memory)
            logging.info("Grafo del agente compilado con memoria persistente.")
        else:
            _APP_GRAPH = workflow.compile()
            logging.info("Grafo del agente compilado sin memoria persistente.")
        
        return _APP_GRAPH
        
    except Exception as e:
        logging.error(f"ERROR FATAL DURANTE LA INICIALIZACIÓN: {e}", exc_info=True)
        _APP_GRAPH = None
        return None
    finally:
        _IS_INITIALIZING = False

def get_user_from_token(request):
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
    global _MCP_INITIALIZED
    
    if _APP_GRAPH is None and not _IS_INITIALIZING:
        get_or_create_agent_graph()
    
    # Inicializar MCP si no está inicializado
    if not _MCP_INITIALIZED:
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            _MCP_INITIALIZED = loop.run_until_complete(initialize_mcp_clients())
            loop.close()
        except Exception as e:
            logging.error(f"Error inicializando MCP: {e}")
            _MCP_INITIALIZED = False
    
    status_info = {
        "status": "ok" if _APP_GRAPH else "error",
        "message": "AI Playground Agent Backend está inicializado." if _APP_GRAPH else "La inicialización del agente falló.",
        "memory": "Disponible" if memory else "No disponible",
        "mcp": "Inicializado" if _MCP_INITIALIZED else "No disponible"
    }
    
    if _APP_GRAPH:
        return jsonify(status_info)
    elif _IS_INITIALIZING:
        return jsonify({**status_info, "status": "initializing", "message": "La inicialización del agente está en curso."}), 503
    else:
        return jsonify(status_info), 500

# [El resto de las rutas permanecen igual...]
@app.route('/api/chats', methods=['GET', 'OPTIONS'])
def list_chats_handler():
    if request.method == 'OPTIONS':
        return Response()
        
    user, error_response = get_user_from_token(request)
    if error_response:
        return error_response
    
    try:
        supabase_client = create_supabase_client()
        response = supabase_client.from_('chats').select('id, title, created_at').eq('user_id', user.id).order('created_at', desc=True).execute()
        
        if response.data is not None:
            return jsonify(response.data), 200
        else:
            return jsonify({"error": "No se pudieron obtener los chats."}), 500

    except Exception as e:
        logging.error(f"Error en list_chats_handler: {traceback.format_exc()}")
        return jsonify({"error": "Error interno del servidor al listar chats"}), 500

@app.route('/api/upload', methods=['POST', 'OPTIONS'])
def upload_handler():
    if request.method == 'OPTIONS':
        return Response()
        
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

@app.route('/api/chat', methods=['POST', 'OPTIONS'])
def chat_handler():
    if request.method == 'OPTIONS':
        return Response()
        
    app_graph = get_or_create_agent_graph()
    if app_graph is None:
        return Response(json.dumps({"error": "Agente no disponible."}), status=503, mimetype='application/json')
    
    user, error_response = get_user_from_token(request)
    if error_response:
        return error_response
    
    try:
        data = request.get_json()
        messages_from_client = data.get('messages', [])
        thread_id = data.get('thread_id')
        
        if not messages_from_client:
            return Response(json.dumps({"error": "No se proporcionaron mensajes."}), status=400, mimetype='application/json')

        last_user_message = messages_from_client[-1]['content']

        if not thread_id:
            jwt = request.headers.get('Authorization')
            supabase_client = create_supabase_client()
            supabase_client.auth.set_session(access_token=jwt.replace('Bearer ', ''), refresh_token="dummy")

            title = (last_user_message[:50] + '...') if len(last_user_message) > 50 else last_user_message
            response_db = supabase_client.from_('chats').insert({'user_id': user.id, 'title': title}).execute()
            if not response_db.data:
                return Response(json.dumps({"error": "No se pudo crear el chat en la base de datos."}), status=500, mimetype='application/json')
            thread_id = response_db.data[0]['id']

        # CORREGIDO: Configuración simplificada
        config = {"configurable": {"thread_id": str(thread_id)}} if memory else {}
        
        current_date = datetime.now(timezone.utc).strftime('%d de %B de %Y')
        system_prompt = f"""Hoy es {current_date}. Eres un orquestador experto con acceso a herramientas locales y MCP. 

Tu principal objetivo es determinar la intención del usuario y seleccionar la herramienta más adecuada:

HERRAMIENTAS DISPONIBLES:
- internet_search: Para búsquedas en internet
- analyze_url_content: Para analizar contenido de URLs
- search_my_documents: Para buscar en documentos del usuario
- Herramientas MCP: Herramientas externas conectadas via MCP
- Agentes especializados: Para tareas específicas

INSTRUCCIONES:
1. Si es un saludo o pregunta general, responde directamente
2. Para información actualizada, usa internet_search
3. Para analizar URLs o imágenes, usa analyze_url_content
4. Para documentos del usuario, usa search_my_documents
5. Para tareas específicas, considera los agentes especializados
6. Cuando uses herramientas MCP, explica brevemente qué estás haciendo

Siempre sintetiza la información en una respuesta clara y concisa."""
        
        input_message = HumanMessage(content=last_user_message)
        input_messages = [SystemMessage(content=system_prompt), input_message]

        def generate_stream():
            try:
                for chunk in app_graph.stream({"messages": input_messages}, config=config):
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

# Nueva ruta para gestión MCP
@app.route('/api/mcp/status', methods=['GET'])
def mcp_status():
    """Obtiene el estado de las conexiones MCP"""
    user, error_response = get_user_from_token(request)
    if error_response:
        return error_response
    
    global _MCP_INITIALIZED
    from api.mcp_client import mcp_manager
    
    try:
        status = {
            "initialized": _MCP_INITIALIZED,
            "connected_servers": list(mcp_manager.connected_servers.keys()),
            "server_count": len(mcp_manager.connected_servers)
        }
        
        if _MCP_INITIALIZED:
            # Obtener herramientas disponibles
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            tools = loop.run_until_complete(mcp_manager.get_available_tools())
            resources = loop.run_until_complete(mcp_manager.get_resources())
            loop.close()
            
            status.update({
                "available_tools": len(tools),
                "available_resources": len(resources),
                "tools": [{"name": t["name"], "server": t["server"], "description": t["description"]} for t in tools[:10]],  # Primeras 10
                "resources": [{"uri": r["uri"], "server": r["server"]} for r in resources[:10]]  # Primeros 10
            })
        
        return jsonify(status)
        
    except Exception as e:
        logging.error(f"Error obteniendo estado MCP: {e}")
        return jsonify({"error": "Error obteniendo estado MCP"}), 500

@app.route('/api/mcp/tools', methods=['GET'])
def list_mcp_tools():
    """Lista todas las herramientas MCP disponibles"""
    user, error_response = get_user_from_token(request)
    if error_response:
        return error_response
    
    global _MCP_INITIALIZED
    if not _MCP_INITIALIZED:
        return jsonify({"error": "MCP no inicializado"}), 503
    
    try:
        from api.mcp_client import mcp_manager
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        tools = loop.run_until_complete(mcp_manager.get_available_tools())
        loop.close()
        
        return jsonify({
            "tools": tools,
            "count": len(tools)
        })
        
    except Exception as e:
        logging.error(f"Error listando herramientas MCP: {e}")
        return jsonify({"error": "Error obteniendo herramientas MCP"}), 500

# Función de limpieza al cerrar la aplicación
import atexit

def cleanup_on_exit():
    """Limpia recursos al cerrar la aplicación"""
    global _MCP_INITIALIZED
    if _MCP_INITIALIZED:
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(cleanup_mcp_clients())
            loop.close()
            logging.info("✓ Recursos MCP limpiados")
        except Exception as e:
            logging.error(f"Error limpiando recursos MCP: {e}")

atexit.register(cleanup_on_exit)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)