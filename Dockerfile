# Base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies (only package.json first for caching)
COPY package.json package-lock.json* ./
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
