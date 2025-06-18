# Usar una imagen base de Python slim
FROM python:3.12-slim

# 1. Establecer el directorio de trabajo
WORKDIR /app

# 2. Instalar las herramientas necesarias
RUN pip install --upgrade pip
RUN pip install poetry

# 3. Configurar Poetry para que instale en el sistema, no en un venv
RUN poetry config virtualenvs.create false

# 4. Copiar los archivos de dependencias
COPY pyproject.toml poetry.lock ./

# 5. Instalar las dependencias de producción.
#    Gunicorn se instalará en una ruta de sistema estándar (ej. /usr/local/bin)
RUN poetry install --no-root --only main

# 6. Copiar el código de la aplicación
COPY ./api ./api

# 7. Exponer el puerto que Cloud Run usará
ENV PORT=8080

# 8. Comando para ejecutar la aplicación. Gunicorn ahora será encontrado en el PATH del sistema.
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "--threads", "8", "--timeout", "0", "api.index:app"]