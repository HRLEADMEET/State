# LEADMEET OS — образ для VPS. Данные и ключ — в томе /app/data (не внутри образа).
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 DATA_DIR=/app/data
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY core ./core
COPY server ./server
COPY web ./web
COPY scripts ./scripts
RUN addgroup -S app && adduser -S app -G app && mkdir -p /app/data && chown -R app:app /app/data
USER app
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:8787/healthz || exit 1
CMD ["node", "--no-warnings", "server/index.js"]
