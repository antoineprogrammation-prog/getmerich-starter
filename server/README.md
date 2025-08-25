# getmerich - Serveur (Node.js)

## Prérequis
- Node.js 18+
- Compte Stripe (clé secrète + clé publique)
- SSL (en prod, derrière un reverse proxy type Nginx)

## Configuration
1. Copiez `.env.sample` en `.env` puis remplissez :
   - `STRIPE_SECRET_KEY` (clé secrète)
   - `PORT` (ex: 4242)
   - `FRONTEND_ORIGIN` (ex: http://localhost:5173 ou votre domaine en HTTPS)
   - `GOAL` (objectif de la cagnotte, par défaut 1 000 000)

2. Installez les dépendances :
   ```bash
   cd server
   npm install
   ```

3. Lancez le serveur en dev :
   ```bash
   npm run dev
   ```

4. Endpoints utiles :
   - `GET /api/stats` -> total, goal, dernier don
   - `POST /api/create-payment-intent` body: `{ amount (cents), pseudo, message }`
   - `POST /api/confirm-payment` body: `{ paymentIntentId }`

## Notes
- Les paiements sont sécurisés via Stripe (PCI-DSS). Vous n'hébergez pas les numéros de carte.
- La BD est un fichier `db.json` (simplifiée). Pour gros trafic -> utilisez Postgres/Mongo.
- Les mises à jour temps réel passent par Socket.io (`io.emit('donation', ...)`).
