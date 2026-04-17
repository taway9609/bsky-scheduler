FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    gcc \
    libpq-dev \
    curl \
    wget \
    gnupg \
    ca-certificates \
    libnspr4 \
    libnss3 \
    libxcb1 \
    libxkbcommon0 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN mkdir -p /app/uploads /app/app/static/images /app/logs

COPY app ./app
COPY tests ./tests
COPY app/templates ./templates
COPY gunicorn.conf.py .
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
COPY .env.example /app/.env.example
COPY start.sh /app/start.sh
RUN chmod +x /app/docker-entrypoint.sh /app/start.sh && mkdir -p /app/env

ENV PYTHONPATH=/app
ENV TZ=Asia/Tokyo
ENV LANG=ja_JP.UTF-8
ENV LC_ALL=ja_JP.UTF-8
ENV PYTHONIOENCODING=utf-8

EXPOSE 6969

CMD ["gunicorn", "app.main:app", "-k", "uvicorn.workers.UvicornWorker", "-w", "4", "-b", "0.0.0.0:6969"]
