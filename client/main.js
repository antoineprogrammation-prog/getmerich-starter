// --- Helpers UI ---
const notice = document.getElementById('notice') || (() => {
  const n = document.createElement('div');
  n.id = 'notice'; n.className = 'notice hidden';
  document.querySelector('.container').prepend(n);
  return n;
})();
function showError(msg) {
  notice.className = 'notice error';
  notice.textContent = msg;
  notice.classList.remove('hidden');
}
function clearError() {
  notice.className = 'notice hidden';
  notice.textContent = '';
}

// --- WebSocket sur même origine ---
const socket = io();
const totalEl = document.getElementById('total');
const lastEl = document.getElementById('last');
const progressEl = document.getElementById('progress');
const donateBtn = document.getElementById('donateBtn');
const pseudoEl = document.getElementById('pseudo');
const amountEl = document.getElementById('amount');
const coinSound = document.getElementById('coinSound');

// --- Canvas & animation ---
const canvas = document.getElementById('animationCanvas');
const ctx = canvas.getContext('2d');
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

let particles = [];
const coinsImg = new Image(); coinsImg.src = '/assets/coins.png';
const billsImg = new Image(); billsImg.src = '/assets/bills.png';

// --- Stripe ---
let stripe, elements, paymentElement;

async function fetchConfig() {
  const r = await fetch('/api/config');
  const data = await r.json();
  if (!data.publishableKey) throw new Error('Stripe publishable key missing on server.');
  return data;
}

async function createPaymentIntent(amount, pseudo) {
  const r = await fetch('/api/create-payment-intent', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ amount, pseudo })
  });
  const data = await r.json();
  if (!r.ok || !data.clientSecret) {
    throw new Error(data.error || 'PaymentIntent creation failed.');
  }
  return data.clientSecret;
}

async function mountPaymentElement() {
  clearError();
  const { publishableKey, mode } = await fetchConfig();
  stripe = Stripe(publishableKey);

  const amount = Math.max(1, Math.floor(Number(amountEl.value || 1)));
  const pseudo = (pseudoEl.value || 'Anonymous').slice(0, 50);
  const clientSecret = await createPaymentIntent(amount, pseudo);

  if (paymentElement) paymentElement.destroy();
  elements = stripe.elements({ clientSecret });
  paymentElement = elements.create('payment');
  paymentElement.mount('#payment-element');

  donateBtn.disabled = false;

  if (mode === 'live') {
    showError('Live mode: utilisez une vraie carte (les cartes de test seront refusées).');
    setTimeout(() => clearError(), 6000);
  }
}

// --- WebSocket: mise à jour temps réel reçue du serveur ---
socket.on('update', ({ total, last }) => {
  applyTotals(total, last);
});

// --- Helpers UI pour total/last ---
function applyTotals(total, last) {
  const t = Number(total) || 0;
  totalEl.textContent = t;
  progressEl.style.width = `${Math.min((t / 1_000_000) * 100, 100)}%`;
  lastEl.textContent = last ? `Last donor: ${last.pseudo} ($${last.amount})` : 'Last donor: -';
}

// --- Animation réaliste et limitée ---
function createParticles(amount) {
  const maxCoins = Math.min(Math.max(3, Math.floor(amount / 5)), 10);
  const maxBills = amount >= 20 ? Math.min(Math.floor(amount / 20), 5) : 0;

  for (let i = 0; i < maxCoins; i++) {
    particles.push({
      img: coinsImg,
      x: Math.random() * canvas.width,
      y: -50,
      vx: (Math.random() - 0.5) * 1.2,
      vy: 2 + Math.random() * 2,
      r: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.2
    });
  }
  for (let i = 0; i < maxBills; i++) {
    particles.push({
      img: billsImg,
      x: Math.random() * canvas.width,
      y: -50,
      vx: (Math.random() - 0.5) * 0.6,
      vy: 1 + Math.random() * 1.2,
      r: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.05
    });
  }
}
function animate() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.r);
    ctx.drawImage(p.img, -p.img.width/2, -p.img.height/2);
    ctx.restore();

    p.x += p.vx; p.y += p.vy; p.r += p.vr;
    if (p.img === coinsImg && p.y + (p.img.height/2) > canvas.height) {
      p.vy *= -0.5; p.y = canvas.height - (p.img.height/2); p.vx *= 0.7;
    }
    if (p.y > canvas.height + 120) particles.splice(i, 1);
  }
  requestAnimationFrame(animate);
}
animate();

// --- Flux "Donate" ---
async function confirmAndRecord() {
  // 1) Confirmer le paiement
  const { error } = await stripe.confirmPayment({ elements, redirect: 'if_required' });
  if (error) throw new Error(error.message || 'Payment failed');

  // 2) Son (interaction OK)
  try { coinSound.currentTime = 0; await coinSound.play(); } catch {}

  // 3) Enregistrer le don et récupérer total/last directement
  const amount = Math.max(1, Math.floor(Number(amountEl.value || 1)));
  const pseudo = (pseudoEl.value || 'Anonymous').slice(0, 50);

  const r = await fetch('/api/donate', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ pseudo, amount })
  });
  const data = await r.json();
  if (!r.ok || !data.success) {
    throw new Error(data.error || 'Donation save failed');
  }

  // 4) Mise à jour immédiate de l’UI (en plus du socket “update”)
  applyTotals(data.total, data.last);

  // 5) Animation
  createParticles(amount);

  // 6) Recréer un PaymentIntent pour le prochain don
  await mountPaymentElement();
}

// Init + events
document.addEventListener('DOMContentLoaded', () => {
  mountPaymentElement().catch(err => showError('Stripe init error: ' + err.message));
});

donateBtn.addEventListener('click', async () => {
  donateBtn.disabled = true;
  clearError();
  try {
    await confirmAndRecord();
  } catch (e) {
    showError(e.message);
  } finally {
    donateBtn.disabled = false;
  }
});
