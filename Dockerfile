FROM node:20-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy package.json and install dependencies
COPY backend/package.json ./
RUN npm install --omit=dev

# Copy backend source
COPY backend/src ./src

# Copy frontend as public
COPY frontend/public ./public

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]
