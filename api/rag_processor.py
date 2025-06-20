import logging
import fitz  # PyMuPDF
from supabase.client import Client
from langchain_openai import OpenAIEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter

# Configuración del logging
logging.basicConfig(level=logging.INFO)

def process_and_store_document(supabase_admin_client: Client, file_content: bytes, user_id: str) -> dict:
    """
    Procesa el contenido de un archivo PDF, extrae texto, lo divide, genera embeddings y lo almacena en Supabase.
    """
    try:
        logging.info(f"Iniciando procesamiento de documento para el usuario: {user_id}")

        # 1. Extraer texto del PDF
        doc = fitz.open(stream=file_content, filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()

        if not text.strip():
            return {"success": False, "message": "El documento PDF no contiene texto extraíble."}
        
        logging.info(f"Texto extraído: {len(text)} caracteres.")

        # 2. Dividir el texto en fragmentos (chunks)
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len
        )
        chunks = text_splitter.split_text(text)
        logging.info(f"Texto dividido en {len(chunks)} fragmentos.")

        # 3. Generar embeddings para cada fragmento
        embeddings_model = OpenAIEmbeddings(model="text-embedding-3-small")
        embeddings = embeddings_model.embed_documents(chunks)
        logging.info(f"Embeddings generados para {len(embeddings)} fragmentos.")

        # 4. Preparar los datos para Supabase
        documents_to_insert = []
        for i, chunk in enumerate(chunks):
            documents_to_insert.append({
                'user_id': user_id,
                'content': chunk,
                'embedding': embeddings[i]
            })

        # 5. Insertar los datos en la tabla 'documents'
        response = supabase_admin_client.from_('documents').insert(documents_to_insert).execute()

        if response.data:
            logging.info(f"Se insertaron {len(response.data)} fragmentos en Supabase.")
            return {"success": True, "message": f"Documento procesado y almacenado con éxito. Se añadieron {len(chunks)} fragmentos a tu base de conocimiento."}
        else:
            # En v2 de supabase-py, un error puede no lanzar una excepción sino estar en response.error
            error_message = "Error desconocido al insertar en Supabase."
            if hasattr(response, 'error') and response.error:
                error_message = response.error.message
            raise Exception(error_message)

    except Exception as e:
        logging.error(f"Error en process_and_store_document: {e}", exc_info=True)
        return {"success": False, "message": f"Error interno al procesar el documento: {str(e)}"}