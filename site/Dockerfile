# Use the official Bun image
FROM oven/bun:latest AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Declare all environment variables as build args
ARG NEXT_PUBLIC_BACKEND_URL

# Set them as environment variables for the build
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the app with environment variables available
RUN bun run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Declare runtime environment variables
ARG NEXT_PUBLIC_BACKEND_URL

# Set runtime environment variables
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL

# Create nextjs user
RUN adduser --system --uid 1001 nextjs

# Copy the built application
COPY --from=builder --chown=nextjs:nextjs /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts

# Copy node_modules for runtime
COPY --from=deps --chown=nextjs:nextjs /app/node_modules ./node_modules

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run the app using Bun with next start
CMD ["bun", "run", "start"] 