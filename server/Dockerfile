# Use the official Node.js 18 Alpine image as base
FROM node:18-alpine AS base

# Install pnpm globally
RUN npm install -g pnpm@8.15.4

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies for building
FROM base AS dependencies
RUN pnpm install --frozen-lockfile

# Build stage
FROM dependencies AS build
COPY . .
RUN pnpm run build

# Production stage
FROM node:18-alpine AS production

# Install pnpm globally in production image
RUN npm install -g pnpm@8.15.4

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy built application from build stage
COPY --from=build /app/dist ./dist

# Copy prompts directory (required by AgentService)
COPY --from=build /app/prompts ./prompts

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Change ownership of the app directory
RUN chown -R nestjs:nodejs /app
USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node --version || exit 1

# Start the application
CMD ["pnpm", "run", "start:prod"] 