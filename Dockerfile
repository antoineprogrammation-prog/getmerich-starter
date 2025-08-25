# ---- Base image ----
FROM node:20-alpine

# ---- Workdir ----
WORKDIR /app/server

# ---- Copy package files ----
COPY server/package*.json ./

# ---- Install dependencies ----
RUN npm install --no-audit --no-fund

# ---- Copy source code ----
COPY server/ .

# ---- Env ----
ENV NODE_ENV=production
ENV PORT=3000

# ---- Expose & Start ----
EXPOSE 3000
CMD ["npm", "start"]
