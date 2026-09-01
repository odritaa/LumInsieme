FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    redis-server \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libdbus-1-3 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 \
    libasound2 libatspi2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && playwright install chromium

COPY . .
RUN chmod +x entrypoint.sh

EXPOSE 8000

ENV HOST=0.0.0.0 PORT=8000 REDIS_HOST=localhost REDIS_PORT=6379 CACHE_TTL=3600

ENTRYPOINT ["./entrypoint.sh"]
