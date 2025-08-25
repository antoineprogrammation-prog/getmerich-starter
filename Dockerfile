FROM node:20-alpine

# API workdir
WORKDIR /app/server

# Install deps
COPY server/package*.json ./
RUN npm install --no-audit --no-fund

# Copy API source
COPY server/ .

# Copy static client (servi par Express)
WORKDIR /app
COPY client ./client

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

WORKDIR /app/server
CMD ["npm", "start"]
