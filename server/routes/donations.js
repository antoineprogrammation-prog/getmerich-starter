const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const { addDonation, getTotalDonations, getLastDonation } = require('../models/donation');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Crée un PaymentIntent pour le Payment Element
router.post('/create-payment-intent', async (req, res) => {
  try {
    const rawAmount = Number(req.body?.amount ?? 1);
    const pseudo = (req.body?.pseudo || 'Anonymous').toString().slice(0, 50);

    // Montant minimal: 1 USD
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

// Enregistre le don (appelé côté front après confirmPayment)
router.post('/donate', async (req, res) => {
  try {
    const pseudo = (req.body?.pseudo || 'Anonymous').toString().slice(0, 50);
    const amount = Math.max(1, Math.floor(Number(req.body?.amount ?? 0)));

    const donation = await addDonation(pseudo, amount);

    // Broadcast temps réel
    const io = req.app.get('io');
    if (io) {
      const total = await getTotalDonations();
      const last = await getLastDonation();
      io.emit('update', { total, last });
    }

    res.json({ success: true, donation });
  } catch (e) {
    console.error('donate error:', e);
    res.status(500).json({ error: e.message || 'DB error' });
  }
});

router.get('/total', async (_req, res) => {
  const total = await getTotalDonations();
  res.json({ total });
});

router.get('/last', async (_req, res) => {
  const last = await getLastDonation();
  res.json({ last });
});

module.exports = router;
