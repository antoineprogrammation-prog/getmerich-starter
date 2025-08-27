# ---------- Base image ----------
FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# ---------- Dependencies layer ----------
FROM base AS deps
# Copie les manifests pour profiter du cache
COPY package.json package-lock.json* ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
# Installe les deps racine (serveur) et prépare client
RUN npm ci --omit=dev && mkdir -p client && cd client && npm ci --include=dev || true

# ---------- Builder (build du client) ----------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app /app
# Copie le reste du code
COPY . .
# Build du client via postinstall (défini dans package.json racine)
RUN npm run postinstall

# ---------- Runner (image finale minimale) ----------
FROM base AS runner
WORKDIR /app
# Copie le code + node_modules du serveur et le dist du client
COPY --from=builder /app /app

# Le serveur Express écoute 8080 (cf. server/index.js)
EXPOSE 8080
CMD ["npm","start"]
