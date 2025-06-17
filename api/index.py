import os
from flask import Flask, request, jsonify
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_deepseek import ChatDeepSeek
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain.tools import create_tool
from supabase.client import create_client, Client
from pydantic import BaseModel, Field
from typing import Type

# Cargar variables de entorno desde el archivo .env
load_dotenv()

# --- Configuración Inicial de la Aplicación Flask ---
app = Flask(__name__)

# --- Conexión a Supabase ---
def create_supabase_client() -> Client:
    """Crea y retorna un cliente de Supabase usando las variables de entorno."""
    url: str = os.environ.get("SUPABASE_URL")
    key: str = os.environ.get("SUPABASE_ANON_KEY")
    if not url or not key:
        raise ValueError("Las variables de entorno SUPABASE_URL y SUPABASE_ANON_KEY deben estar configuradas.")
    return create_client(url, key)

# --- Creador de Modelos de Lenguaje (LLMs) ---
def get_chat_model(provider: str, model_name: str, temperature: float = 0.7):
    """
    Retorna una instancia de un modelo de chat (OpenAI, Google, DeepSeek)
    basado en el proveedor y nombre del modelo.
    Las claves de API se obtienen de las variables de entorno.
    """
    api_key = os.environ.get(f"{provider.upper()}_API_KEY")
    
    if provider == "openai":
        if not api_key:
            print("Advertencia: OPENAI_API_KEY no está configurada.")
        return ChatOpenAI(model=model_name, temperature=temperature, api_key=api_key)
    elif provider == "google":
        if not api_key:
            print("Advertencia: GOOGLE_API_KEY no está configurada.")
        return ChatGoogleGenerativeAI(model=model_name, temperature=temperature, api_key=api_key)
    elif provider == "deepseek":
        if not api_key:
            print("Advertencia: DEEPSEEK_API_KEY no está configurada.")
        return ChatDeepSeek(model=model_name, temperature=temperature, api_key=api_key)
    else:
        # Modelo por defecto si el proveedor no coincide
        default_api_key = os.environ.get("OPENAI_API_KEY")
        if not default_api_key:
            print("Advertencia: Usando modelo por defecto (gpt-4o-mini) pero OPENAI_API_KEY no está configurada.")
        return ChatOpenAI(model="gpt-4o-mini", temperature=temperature, api_key=default_api_key)

# --- Lógica para Ejecutar un Agente Especializado ---
def run_specialist_agent(agent_config: dict, task_content: str):
    """
    Ejecuta un agente especializado usando su configuración y la tarea recibida.
    Esta función ahora espera 'task_content' como una cadena directamente.
    """
    try:
        model = get_chat_model(agent_config['model_provider'], agent_config['model_name'])
        
        system_prompt = agent_config.get('system_prompt', "Eres un asistente especializado.")
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=task_content)
        ]
        print(f"DEBUG: Invocando agente '{agent_config['name']}' con tarea: '{task_content}'")
        result = model.invoke(messages)
        print(f"DEBUG: Agente '{agent_config['name']}' respondió: {result.content[:100]}...") # Log de los primeros 100 caracteres
        return result.content
    except Exception as e:
        print(f"ERROR: Fallo al ejecutar agente especializado '{agent_config['name']}': {e}")
        return f"Error al ejecutar el agente {agent_config['name']}: {e}"


# --- Creador de Herramientas (Agentes Especializados desde Supabase) ---
def get_specialist_agents_as_tools(supabase: Client):
    """
    Obtiene la configuración de los agentes especializados desde Supabase
    y los convierte en herramientas de LangChain.
    """
    response = supabase.from_("agents").select("*").neq("name", "Asistente Orquestador").execute()
    tools = []
    if not response.data:
        print("Advertencia: No se encontraron agentes especializados en Supabase.")
        return []

    for agent_config in response.data:
        class ToolSchema(BaseModel):
            task: str = Field(description=f"La tarea específica o pregunta detallada para el agente '{agent_config['name']}'.")

        def tool_func(task: str, config=agent_config):
            return run_specialist_agent(config, task)

        tool = create_tool(
            name=agent_config['name'].lower().replace(' ', '_'),
            description=f"Agente especializado en: {agent_config['description']}. Úsalo para...",
            func=tool_func,
            args_schema=ToolSchema
        )
        tools.append(tool)
    return tools

# --- API Endpoint Principal ---
@app.route('/api/chat', methods=['POST'])
def chat_handler():
    """
    Maneja las solicitudes de chat, orquestando entre el usuario y los agentes especializados.
    """
    try:
        data = request.get_json()
        messages = data.get('messages')
        if not messages:
            return jsonify({"error": "Formato de mensajes incorrecto o ausente."}), 400
        
        user_message_content = messages[-1]['content']
        
        supabase = create_supabase_client()
        tools = get_specialist_agents_as_tools(supabase)
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", "Eres un agente orquestador. Tu función es analizar la petición del usuario y delegarla a la herramienta (agente especializado) más adecuada si existe. Si ninguna herramienta es apropiada, responde directamente a la pregunta del usuario de forma concisa. Siempre intenta utilizar las herramientas disponibles si la pregunta del usuario es clara y se ajusta a la descripción de alguna herramienta."),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ])
        
        llm = get_chat_model("openai", "gpt-4o-mini", temperature=0)
        
        agent = create_tool_calling_agent(llm, tools, prompt)
        
        agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)
        
        print(f"DEBUG: Mensaje de usuario recibido: {user_message_content}")
        
        result = agent_executor.invoke({
            "input": user_message_content,
            "chat_history": []
        })
        
        response_content = result.get('output', 'No se pudo generar una respuesta.')
        print(f"DEBUG: Respuesta final del orquestador: {response_content[:100]}...")
        
        return jsonify({"response": response_content})

    except ValueError as ve:
        print(f"ERROR de configuración: {ve}")
        return jsonify({"error": str(ve)}), 500
    except Exception as e:
        print(f"ERROR inesperado en el handler: {e}")
        import traceback
        traceback.print_exc() 
        return jsonify({"error": "Ocurrió un error interno del servidor. Consulte los logs para más detalles."}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Endpoint de salud para verificar que la aplicación Flask está funcionando."""
    return jsonify({"status": "ok"}), 200