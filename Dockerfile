# ---- Base image ----
FROM node:20-alpine

# ---- Workdir ----
WORKDIR /app

# ---- Copy server package files first (cache-friendly) ----
COPY server/package*.json ./server/

# ---- Install deps ----
WORKDIR /app/server
RUN npm install --no-audit --no-fund

# ---- Copy server source ----
COPY server/ .

# ---- Env ----
ENV NODE_ENV=production
ENV PORT=3000

# ---- Expose & Start ----
EXPOSE 3000
CMD ["node", "index.js"]
