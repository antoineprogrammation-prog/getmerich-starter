import React, { useState } from 'react'
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4242'

export default function StripeCheckout({ onSuccess }) {
  const stripe = useStripe()
  const elements = useElements()
  const [amount, setAmount] = useState('10')
  const [pseudo, setPseudo] = useState('Anonyme')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setOk(false)

    if (!stripe || !elements) return

    const amt = Math.max(1, Number(amount || 0)) // USD
    const cents = Math.round(amt * 100)

    setLoading(true)
    try {
      // 1) Create Payment Intent
      const r1 = await fetch(`${SERVER_URL}/api/create-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: cents, pseudo, message })
      })
      const d1 = await r1.json()
      if (!r1.ok) throw new Error(d1.error || 'Erreur create-payment-intent')

      // 2) Confirm on client
      const cardElement = elements.getElement(CardElement)
      const { paymentIntent, error: confirmError } = await stripe.confirmCardPayment(d1.clientSecret, {
        payment_method: { card: cardElement }
      })
      if (confirmError) throw confirmError

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        // 3) Confirm on server (verifies status, persists, broadcasts)
        const r2 = await fetch(`${SERVER_URL}/api/confirm-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentIntentId: paymentIntent.id })
        })
        const d2 = await r2.json()
        if (!r2.ok) throw new Error(d2.error || 'Erreur confirm-payment')

        setOk(true)
        if (onSuccess) onSuccess(amt)
        setAmount('10'); setMessage('')
      }
    } catch (err) {
      console.error(err)
      setError(err.message || 'Erreur de paiement')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label>Montant (USD)</label>
      <input type="number" min="1" step="1" value={amount} onChange={e => setAmount(e.target.value)} />

      <label>Pseudonyme (affiché)</label>
      <input value={pseudo} onChange={e => setPseudo(e.target.value)} maxLength={50} />

      <label>Message (optionnel)</label>
      <textarea value={message} onChange={e => setMessage(e.target.value)} rows="3" maxLength={200} />

      <label>Détails de carte</label>
      <div style={{ padding: '10px 12px', border: '1px solid #2a3a68', borderRadius: 10, background: '#0e1730' }}>
        <CardElement options={{ hidePostalCode: true }} />
      </div>

      <button disabled={!stripe || loading}>{loading ? 'Paiement...' : 'Donner'}</button>
      {error ? <div style={{ color: '#ff6b6b' }}>{error}</div> : null}
      {ok ? <div style={{ color: '#33ff99' }}>Merci pour votre don ! 🎉</div> : null}
    </form>
  )
}
