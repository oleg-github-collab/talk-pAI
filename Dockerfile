# Use Node.js 18 for Railway compatibility
FROM node:18-alpine

# Install minimal dependencies
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Set NODE_ENV for production optimizations
ENV NODE_ENV=production

# Copy package.json only
COPY package.json ./

# Install dependencies (Railway will handle this better)
RUN npm install --omit=dev --no-audit --no-fund

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p public database uploads

# Use non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port (Railway will set this)
EXPOSE $PORT

# Start application
CMD ["node", "server.js"]