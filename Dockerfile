FROM node:20-alpine AS builder

WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --only=production

FROM node:20-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

COPY --from=builder /app/node_modules ./node_modules
COPY backend/ ./
COPY frontend/ ./public/

RUN mkdir -p uploads

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]
