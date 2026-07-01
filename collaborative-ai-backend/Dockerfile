FROM node:20-alpine

WORKDIR /app

# Install openssl and other prisma dependencies for Alpine
RUN apk add --no-cache openssl

# Copy package files
COPY package*.json ./

# Install all dependencies (dev + production) to build TS
RUN npm ci

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma Client
RUN npx prisma generate

# Copy the rest of the application code
COPY . .

# Build the TypeScript project
RUN npm run build

# Expose backend port
EXPOSE 5001

# Start the application
CMD ["npm", "run", "start"]
