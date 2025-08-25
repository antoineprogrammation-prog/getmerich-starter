# getmerich.com – Starter complet (serveur + client)

Ce pack contient tout ce qu'il faut pour démarrer votre site de dons en temps réel avec jauge animée, affichage du dernier donateur, messages, pluie de pièces/billets et sons.

## 1) Installation rapide (local)
```bash
unzip getmerich-starter.zip -d getmerich
cd getmerich/server
cp .env.sample .env
# Éditez .env : STRIPE_SECRET_KEY=..., FRONTEND_ORIGIN=http://localhost:5173
npm install
npm run dev
# Laisse le serveur tourner (port 4242 par défaut)
```

Dans un autre terminal :
```bash
cd getmerich/client
cp .env.sample .env
# Éditez .env : VITE_STRIPE_PUBLISHABLE_KEY=..., VITE_SERVER_URL=http://localhost:4242
npm install
npm run dev
# Ouvrez http://localhost:5173
```

## 2) Déploiement (vue d'ensemble)
- **Nom de domaine**: achetez "getmerich.com" chez un registrar (OVH/Namecheap/etc.).
- **DNS**: pointez un enregistrement A/AAAA vers votre serveur (ou CNAME si vous utilisez Vercel/Render).
- **Back-end**: déployez `server` sur un VPS/PAAS (OVH, Render, Railway, Fly.io, etc.).
- **Front-end**: déployez `client` (Vite build -> fichiers statiques) sur Vercel/Netlify/Nginx.
- **SSL**: utilisez HTTPS (Let's Encrypt via Caddy/Nginx/Certbot).
- **CORS**: dans `.env` du serveur, mettez `FRONTEND_ORIGIN=https://getmerich.com`.
- **Reverse proxy**: servez le backend en HTTPS et ouvrez le WebSocket (Socket.io) en upgrade.

## 3) Fonctionnement des paiements
- Le paiement se fait avec Stripe **Elements** intégrés au site – l’utilisateur ne quitte pas votre page.
- Le serveur crée un **PaymentIntent** (`/api/create-payment-intent`), puis le client confirme la carte.
- Après succès, le client appelle `/api/confirm-payment`: le serveur **vérifie** auprès de Stripe que le paiement est `succeeded`,
  puis **persiste** (db.json) et **diffuse** l’événement temps réel à tous les visiteurs.
- (Optionnel) Vous pouvez ajouter un webhook Stripe plus tard pour une robustesse maximale.

## 4) Anonymat / affichage
- Stripe exige votre identité côté compte (compliance), mais sur le site vous affichez **pseudonyme** + **message** seulement.
- Les donateurs peuvent donc être affichés anonymement ou sous pseudo.

## 5) Personnalisation
- Remplacez les sons MP3 dans `client/public/sounds`. Les WAV fournis servent de secours.
- Ajustez les règles d’animation dans `client/index.html` (classes .coin / .bill).
- Ajustez la jauge / paliers dans `client/src/App.jsx` (fonction triggerMoneyAnimation).

## 6) Production – bonnes pratiques
- Remplacez la DB fichier par Postgres/Mongo pour éviter les conflits d’écriture.
- Ajoutez un système anti-spam (reCAPTCHA v3) et une limite de message (déjà en place).
- Activez les logs d’accès / erreurs, mettez un WAF/CDN (Cloudflare) si besoin.
- Utilisez des clés Stripe **live** seulement en prod et gardez-les secrètes.
