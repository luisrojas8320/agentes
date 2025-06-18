# FASE 1: Builder (para instalar dependencias de forma segura)
FROM python:3.12-slim as builder
RUN pip install poetry
WORKDIR /app
COPY pyproject.toml poetry.lock ./
RUN poetry install --no-root --only main

# FASE 2: Final (la imagen de producción)
FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /root/.cache/pypoetry/virtualenvs/ /opt/pypoetry/virtualenvs/
COPY ./api ./api
# La variable de entorno PATH se actualiza para que se pueda encontrar gunicorn
ENV PATH="/opt/pypoetry/virtualenvs/agentes-nuevo-py3.12/bin:$PATH"
# Cloud Run proporciona el puerto a través de esta variable de entorno
ENV PORT=8080

# Comando para iniciar el servidor Gunicorn
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 api.index:app