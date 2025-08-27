# ---------- Base ----------
FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# ---------- Install deps ----------
# On copie uniquement les manifests pour profiter du cache
COPY package.json package-lock.json* ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm install --omit=dev

# ---------- Copier tout le code ----------
COPY . .

# ---------- Build du client APRES avoir copié le code ----------
RUN npm run build:client

# ---------- Run ----------
EXPOSE 8080
CMD ["npm","start"]
