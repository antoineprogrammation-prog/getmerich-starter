const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
require('dotenv').config();
const { addDonation, getTotalDonations, getLastDonation } = require('../models/donation');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Créer PaymentIntent pour Payment Element
router.post('/create-payment-intent', async (req, res) => {
  const { pseudo, amount } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount*100),
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: { pseudo }
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// Ajouter le don dans la base
router.post('/donate', async (req, res) => {
  const { pseudo, amount } = req.body;
  try {
    const donation = await addDonation(pseudo, amount);

    // Envoyer l'update via WebSocket
    if (req.app.get('io')) {
      const total = await getTotalDonations();
      const last = await getLastDonation();
      req.app.get('io').emit('update', { total, last });
    }

    res.json({ success: true, donation });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
