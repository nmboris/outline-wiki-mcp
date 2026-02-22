FROM oven/bun:1.3.8-alpine AS base
WORKDIR /app

# Install dependencies stage
FROM base AS deps
COPY package.json ./
COPY bun.lock* ./
RUN bun install --frozen-lockfile --production

# Build stage
FROM base AS builder
COPY package.json ./
COPY bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# Production stage
FROM base AS production
ENV NODE_ENV=production

# Copy dependencies and built files
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["bun", "dist/index.js"]
