# =================================================================
# PRODUCTION DOCKERFILE
# bg-threat-ai Console-First Threat Detection Platform
# =================================================================

# Multi-stage build for optimal production image size
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY scripts/ ./scripts/

# Build the application
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# =================================================================
# PRODUCTION STAGE
# =================================================================

FROM node:18-alpine AS production

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init curl && \
    rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S bg-threat-ai -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=bg-threat-ai:nodejs /app/dist ./dist/
COPY --from=builder --chown=bg-threat-ai:nodejs /app/node_modules ./node_modules/
COPY --from=builder --chown=bg-threat-ai:nodejs /app/package*.json ./

# Copy production configuration files
COPY --chown=bg-threat-ai:nodejs .env.production ./.env.production
COPY --chown=bg-threat-ai:nodejs scripts/validate-environment.js ./scripts/

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs && \
    chown -R bg-threat-ai:nodejs /app/logs

# Switch to non-root user
USER bg-threat-ai

# Expose the port
EXPOSE 3002

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3002/health || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3002
ENV LOG_LEVEL=info

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]

# =================================================================
# METADATA
# =================================================================

LABEL maintainer="bg-threat-ai-team" \
      version="2.0.0" \
      description="Console-First Threat Detection Platform" \
      org.label-schema.name="bg-threat-ai" \
      org.label-schema.description="Real-time threat detection and behavioral analysis" \
      org.label-schema.version="2.0.0" \
      org.label-schema.schema-version="1.0"