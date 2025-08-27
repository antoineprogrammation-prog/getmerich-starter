// ... le reste de ton fichier inchangé jusqu’à la section Stripe ...

/*************************
 * Stripe (Payment Element)
 *************************/
let stripe, elements, paymentElement;

function waitForStripeJs(){
  return new Promise((resolve, reject) => {
    const check = () => { if (window.Stripe) return resolve(); setTimeout(check, 50); };
    check();
    setTimeout(() => reject(new Error('Stripe.js not loaded')), 10000);
  });
}
async function fetchConfig(){
  const r = await fetch('/api/config', { cache: 'no-store' });
  const d = await r.json();
  if (!d.publishableKey) throw new Error('Stripe publishable key missing (STRIPE_PUBLISHABLE_KEY)');
  return d;
}
async function createPaymentIntent(amount, pseudo){
  const r = await fetch('/api/create-payment-intent', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ amount, pseudo })
  });
  const d = await r.json();
  if (!r.ok || !d.clientSecret) throw new Error(d.error || 'PaymentIntent failed');
  return d.clientSecret;
}
async function mountPaymentElement(){
  const errorBox = document.getElementById('payment-error');
  try{
    hideError();
    if (errorBox) { errorBox.textContent = ''; errorBox.classList.add('hidden'); }

    await waitForStripeJs();
    const { publishableKey } = await fetchConfig();
    stripe = Stripe(publishableKey);

    const amount = Math.max(1, Math.floor(Number(amountEl?.value || 1)));
    const pseudo = (pseudoEl?.value || 'Anonymous').slice(0,50);
    const clientSecret = await createPaymentIntent(amount, pseudo);

    if (paymentElement) paymentElement.destroy();
    elements = stripe.elements({ clientSecret });
    paymentElement = elements.create('payment');
    paymentElement.mount('#payment-element');

    if (donateBtn) donateBtn.disabled = false;
    const diag = document.getElementById('stripe-diag');
    if (diag) diag.classList.add('hidden');
  } catch (e) {
    const msg = 'Stripe init error: ' + (e.message || e);
    showError(msg);
    if (errorBox) { errorBox.textContent = msg; errorBox.classList.remove('hidden'); }
    // Diagnostic serveur
    try {
      const r = await fetch('/api/diag/stripe', { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        const diag = document.getElementById('stripe-diag');
        if (diag) {
          diag.textContent = `Stripe diag — publishableKey: ${d.havePublishableKey ? 'OK' : 'MISSING'} `
            + `(prefix: ${d.publishableKeyPrefix ?? 'n/a'}), secretKey: ${d.haveSecretKey ? 'OK' : 'MISSING'} `
            + `(mode: ${d.modeHint}).`;
          diag.classList.remove('hidden');
        }
      }
    } catch {}
  }
}
async function confirmAndRecord(){
  const { error } = await stripe.confirmPayment({ elements, redirect: 'if_required' });
  if (error) throw new Error(error.message || 'Payment failed');

  try { coinSound.currentTime = 0; await coinSound.play(); } catch {}
  addParticles(Math.max(1, Math.floor(Number(amountEl?.value || 1))));

  const amount = Math.max(1, Math.floor(Number(amountEl?.value || 1)));
  const pseudo = (pseudoEl?.value || 'Anonymous').slice(0,50);

  const r = await fetch('/api/donate', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ pseudo, amount })
  });
  const data = await r.json();
  if (!r.ok || !data.success) throw new Error(data.error || 'Donation save failed');

  applyTotalsNet(data.totalNet, data.last);
  await mountPaymentElement();
}

// Boot: garde ces trois lignes
document.addEventListener('DOMContentLoaded', async () => {
  await initRevealStage();
  await loadInitialTotals();
  mountPaymentElement().catch(() => {});
});
amountEl?.addEventListener('change', () => { mountPaymentElement().catch(() => {}); });
donateBtn?.addEventListener('click', async () => {
  await unlockAudio();
  donateBtn.disabled = true; hideError();
  try { await confirmAndRecord(); }
  catch (e) { showError(e.message || String(e)); }
  finally { donateBtn.disabled = false; }
});
