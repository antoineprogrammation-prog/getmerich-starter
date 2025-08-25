# getmerich - Client (Vite + React)

## Prérequis
- Node.js 18+
- Clé publique Stripe (publishable key)

## Configuration
1. Copiez `.env.sample` -> `.env` et remplissez :
   - `VITE_STRIPE_PUBLISHABLE_KEY` (clé publique Stripe)
   - `VITE_SERVER_URL` (ex: http://localhost:4242 ou votre domaine backend)
   - `VITE_GOAL` (objectif de cagnotte à afficher)

2. Installez et lancez :
   ```bash
   cd client
   npm install
   npm run dev
   ```

3. Ouvrez http://localhost:5173

## Sons
- Déposez vos MP3 dans `public/sounds/coins.mp3` et `public/sounds/cash.mp3`.
- Des fichiers WAV de secours (coins.wav, cash.wav) sont inclus.
