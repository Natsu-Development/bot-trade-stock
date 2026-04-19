# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for caching
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build argument for API URL (relative path for same-origin)
ARG VITE_API_URL=/api
ARG VITE_APP_VERSION=dev
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_VERSION=$VITE_APP_VERSION

# Build the application
RUN yarn build

# Production stage - Nginx
FROM nginx:alpine

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create SSL directory for mounting certificates
RUN mkdir -p /etc/nginx/ssl

# Expose HTTP (80) and HTTPS (443)
EXPOSE 80 443

# Health check via HTTPS (--no-check-certificate for self-signed Origin CA)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider --no-check-certificate https://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]