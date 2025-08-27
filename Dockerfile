# ---------- Base ----------
FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# ---------- Install deps ----------
# Copie les manifests pour profiter du cache
COPY package.json package-lock.json* ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json

# Installe les deps du projet (racine)
RUN npm install --omit=dev

# ---------- Build client ----------
COPY . .
RUN npm run postinstall

# ---------- Run ----------
EXPOSE 8080
CMD ["npm","start"]
