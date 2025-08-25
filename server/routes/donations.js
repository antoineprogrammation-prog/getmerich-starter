const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const { addDonation, getTotals, getLastDonation } = require('../models/donation');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Config frais (modifiable via variables d'env, sinon valeurs par défaut)
const PERC = parseFloat(process.env.FEES_PERCENT || '0.029'); // ex: 2.9% => 0.029
const FIXE = parseFloat(process.env.FEES_FIXED  || '0.30');   // ex: $0.30

function computeNet(amount) {
  const fees = amount * PERC + FIXE;
  const net = Math.max(amount - fees, 0);
  // arrondi 2 décimales
  return Math.round(net * 100) / 100;
}

// Crée un PaymentIntent pour le Payment Element
router.post('/create-payment-intent', async (req, res) => {
  try {
    const rawAmount = Number(req.body?.amount ?? 1);
    const pseudo = (req.body?.pseudo || 'Anonymous').toString().slice(0, 50);

    const amount = Math.max(1, Math.floor(rawAmount));
    const pi = await stripe.paymentIntents.create({
      amount: amount * 100,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: { pseudo }
    });

    res.json({ clientSecret: pi.client_secret });
  } catch (e) {
    console.error('create-payment-intent error:', e);
    res.status(400).json({ error: e.message || 'Stripe error creating PaymentIntent' });
  }
});

// Enregistre le don puis renvoie totaux (net + brut) + dernier don
router.post('/donate', async (req, res) => {
  try {
    const pseudo = (req.body?.pseudo || 'Anonymous').toString().slice(0, 50);
    const amount = Math.max(1, Math.floor(Number(req.body?.amount ?? 0)));

    const netAmount = computeNet(amount);
    const donation = await addDonation(pseudo, amount, netAmount);

    const totals = await getTotals();
    const last = await getLastDonation();

    const io = req.app.get('io');
    if (io) io.emit('update', { totalNet: totals.totalNet, last });

    res.json({ success: true, donation, ...totals, last });
  } catch (e) {
    console.error('donate error:', e);
    res.status(500).json({ success: false, error: e.message || 'DB error' });
  }
});

// Lecture des totaux
router.get('/total', async (_req, res) => {
  const totals = await getTotals();
  res.json(totals); // { totalGross, totalNet }
});

router.get('/last', async (_req, res) => {
  const last = await getLastDonation();
  res.json({ last });
});

module.exports = router;
