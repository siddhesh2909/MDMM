FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Set build-time environment variable for Next.js
ENV NEXT_PUBLIC_API_URL=http://backend:5001
ENV NODE_ENV=production

# Build the Next.js project
RUN npm run build

# Expose Next.js default port
EXPOSE 3000

# Start Next.js server
CMD ["npm", "run", "start"]
