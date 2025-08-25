const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const { addDonation, getTotalDonations, getLastDonation } = require('../models/donation');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// PaymentIntent pour le Payment Element
router.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount = 1, pseudo = 'Anonymous' } = req.body;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount) * 100),
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: { pseudo }
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Enregistrer le don après confirmation (côté front on appelle ceci après confirm)
router.post('/donate', async (req, res) => {
  try {
    const { pseudo = 'Anonymous', amount = 0 } = req.body;
    const donation = await addDonation(pseudo, Number(amount));

    // Broadcast temps réel
    const io = req.app.get('io');
    if (io) {
      const total = await getTotalDonations();
      const last = await getLastDonation();
      io.emit('update', { total, last });
    }

    res.json({ success: true, donation });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Endpoints de lecture
router.get('/total', async (_req, res) => {
  const total = await getTotalDonations();
  res.json({ total });
});

router.get('/last', async (_req, res) => {
  const last = await getLastDonation();
  res.json({ last });
});

module.exports = router;
