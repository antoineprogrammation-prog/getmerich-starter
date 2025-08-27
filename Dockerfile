# ---------- Base ----------
FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# ---------- Install deps ----------
# Copie des manifests pour profiter du cache Docker
COPY package.json package-lock.json* ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json

# Installe les deps du projet (celles déclarées à la racine)
RUN npm install --omit=dev

# ---------- Build client ----------
# Copie le reste du code
COPY . .
# Build du client via postinstall (utilise npm install côté client)
RUN npm run postinstall

# ---------- Run ----------
EXPOSE 8080
CMD ["npm","start"]
