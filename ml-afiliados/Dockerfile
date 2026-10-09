# ml-afiliados em Docker: Node 22 + Chromium (para o WhatsApp Web sem janela).
FROM node:22-bookworm-slim

ENV TZ=America/Sao_Paulo \
    CHROME_PATH=/usr/bin/chromium \
    WHATSAPP_JANELA=false \
    ML_PERFIL_DIR=/app/perfil \
    PUPPETEER_SKIP_DOWNLOAD=true

RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-noto-color-emoji tzdata ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json .puppeteerrc.cjs ./
RUN npm ci --no-audit --no-fund && npm cache clean --force

COPY src ./src
COPY test ./test
COPY config ./config
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p data perfil .wwebjs_auth .wwebjs_cache

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
