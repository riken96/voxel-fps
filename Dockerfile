# ==============================================================
# Multi-Stage Dockerfile for 3D Voxel Multiplayer FPS Platform
# ==============================================================

# Stage 1: Build Frontend Assets
FROM node:24-alpine AS builder
WORKDIR /app

COPY package*.json tsconfig.json vite.config.ts ./
COPY client/ ./client/
COPY shared/ ./shared/

RUN npm ci
RUN npm run build

# Stage 2: Production Container
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

RUN apk add --no-cache curl

COPY package*.json tsconfig.json ./
RUN npm ci --omit=dev && npm install -g tsx

# Copy source modules and compiled client assets
COPY shared/ ./shared/
COPY server/ ./server/
COPY --from=builder /app/dist/client/ ./dist/client/

# Persistent data directory for user accounts and community maps
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 8080

# Production Health Check
HEALTHCHECK --interval=20s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["tsx", "server/src/server.ts"]
