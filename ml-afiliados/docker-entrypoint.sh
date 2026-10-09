#!/bin/sh
# O Chromium deixa travas "Singleton*" no perfil quando o contêiner é parado/recriado;
# sem apagar, ele se recusa a abrir ("perfil em uso por outro computador").
find /app/.wwebjs_auth /app/perfil /app/data -name 'Singleton*' -exec rm -f {} + 2>/dev/null || true
exec "$@"
