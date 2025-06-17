import os
from flask import Flask, request, jsonify
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_deepseek import ChatDeepSeek
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.tools import DynamicStructuredTool
from supabase.client import create_client, Client
from zod import z

# Cargar variables de entorno
load_dotenv()

# --- Configuración Inicial ---
app = Flask(__name__)

# --- Conexión a Supabase ---
def create_supabase_client() -> Client:
    url: str = os.environ.get("SUPABASE_URL")
    key: str = os.environ.get("SUPABASE_ANON_KEY")
    return create_client(url, key)

# --- Creador de Modelos ---
def get_chat_model(provider, model_name, temperature=0.7):
    api_key = os.environ.get(f"{provider.upper()}_API_KEY")
    if provider == "openai":
        return ChatOpenAI(model=model_name, temperature=temperature, api_key=api_key)
    elif provider == "google":
        return ChatGoogleGenerativeAI(model=model_name, temperature=temperature, api_key=api_key)
    elif provider == "deepseek":
        return ChatDeepSeek(model=model_name, temperature=temperature, api_key=api_key)
    else:
        return ChatOpenAI(model="gpt-4o-mini", temperature=temperature, api_key=os.environ.get("OPENAI_API_KEY"))

# --- Creador de Herramientas (Agentes Especializados) ---
def get_specialist_agents_as_tools(supabase: Client):
    response = supabase.from_("agents").select("*").execute()
    if not response.data:
        return []

    tools = []
    for agent_config in response.data:
        tool = DynamicStructuredTool(
            name=agent_config['name'].lower().replace(' ', '_'),
            description=f"Agente especializado en: {agent_config['description']}. Úsalo para tareas relacionadas.",
            args_schema=z.object(
                task=z.string().describe(f"La tarea específica o pregunta detallada para el agente '{agent_config['name']}'.")
            ),
            func=lambda task: run_specialist_agent(agent_config, task)
        )
        tools.append(tool)
    return tools

# --- Lógica para Ejecutar un Agente Especializado ---
def run_specialist_agent(agent_config, task):
    model = get_chat_model(agent_config['model_provider'], agent_config['model_name'])
    messages = [
        SystemMessage(content=agent_config['system_prompt']),
        HumanMessage(content=task)
    ]
    result = model.invoke(messages)
    return result.content

# --- API Endpoint Principal ---
@app.route('/api/chat', methods=['POST'])
def chat_handler():
    try:
        data = request.get_json()
        user_message_content = data['messages'][-1]['content']
        
        supabase = create_supabase_client()
        tools = get_specialist_agents_as_tools(supabase)
        
        # Si no hay herramientas/agentes, responde directamente
        if not tools:
            model = get_chat_model("openai", "gpt-3.5-turbo")
            response = model.invoke(user_message_content)
            return jsonify({"response": response.content})

        # Configuración del Agente Orquestador/Supervisor
        prompt = ChatPromptTemplate.from_messages([
            ("system", "Eres un agente orquestador. Tu función es analizar la petición del usuario y delegarla a la herramienta (agente especializado) más adecuada. Si ninguna herramienta es apropiada, responde directamente a la petición del usuario de la mejor manera posible."),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ])
        
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        agent = create_tool_calling_agent(llm, tools, prompt)
        
        agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)
        
        result = agent_executor.invoke({
            "input": user_message_content,
        })
        
        return jsonify({"response": result['output']})

    except Exception as e:
        print(f"Error en el handler: {e}")
        return jsonify({"error": str(e)}), 500