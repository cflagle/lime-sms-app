# Base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install system dependencies for Prisma (Required for Alpine)
RUN apk add --no-cache openssl

# Install dependencies
COPY package.json package-lock.json* ./
COPY prisma ./prisma/

RUN npm install

# Copy all files
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js app
RUN npm run build

# Expose port
EXPOSE 3000

# Start command (Default to web app, but can be overridden)
CMD ["npm", "start"]
