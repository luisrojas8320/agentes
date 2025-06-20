import logging
import fitz
from supabase.client import Client
from langchain_openai import OpenAIEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter

logging.basicConfig(level=logging.INFO)

def process_and_store_document(supabase_admin_client: Client, file_content: bytes, user_id: str) -> dict:
    try:
        logging.info(f"Iniciando procesamiento para usuario: {user_id}")
        doc = fitz.open(stream=file_content, filetype="pdf")
        text = "".join(page.get_text() for page in doc)
        doc.close()
        if not text.strip():
            return {"success": False, "message": "PDF no contiene texto."}
        
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200, length_function=len)
        chunks = text_splitter.split_text(text)
        
        embeddings_model = OpenAIEmbeddings(model="text-embedding-3-small")
        embeddings = embeddings_model.embed_documents(chunks)
        
        documents_to_insert = [{'user_id': user_id, 'content': chunk, 'embedding': embeddings[i]} for i, chunk in enumerate(chunks)]
        
        response = supabase_admin_client.from_('documents').insert(documents_to_insert).execute()
        
        if response.data:
            return {"success": True, "message": f"Se añadieron {len(chunks)} fragmentos."}
        else:
            raise Exception("Error al insertar en Supabase.")
            
    except Exception as e:
        logging.error(f"Error en process_and_store_document: {e}", exc_info=True)
        return {"success": False, "message": f"Error interno del servidor: {str(e)}"}