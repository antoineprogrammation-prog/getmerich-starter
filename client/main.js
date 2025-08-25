// Même origine: l'API est servie par le même service Railway
const socket = io(); // auto-connect to same origin

const totalEl = document.getElementById('total');
const lastEl = document.getElementById('last');
const progressEl = document.getElementById('progress');
const donateBtn = document.getElementById('donateBtn');
const pseudoEl = document.getElementById('pseudo');
const amountEl = document.getElementById('amount');
const coinSound = document.getElementById('coinSound');

const canvas = document.getElementById('animationCanvas');
const ctx = canvas.getContext('2d');
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

let particles = [];
const coinsImg = new Image(); coinsImg.src = '/assets/coins.png';
const billsImg = new Image(); billsImg.src = '/assets/bills.png';

// --- Stripe Payment Element ---
let stripe, elements, paymentElement;
document.addEventListener('DOMContentLoaded', async () => {
  // 1) Initialiser Stripe avec ta clé publique test
  // 👉 Remplace pk_test_xxx par ta clé publique test (visible côté client)
  stripe = Stripe('pk_test_xxxxxxxxxxxxxxxxxxxxxxxxx'); // TODO: remplace

  await initPaymentElement();
  donateBtn.disabled = false;
});

async function initPaymentElement() {
  const amount = parseFloat(amountEl.value) || 1;
  const pseudo = pseudoEl.value || 'Anonymous';

  const resp = await fetch('/api/create-payment-intent', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ amount, pseudo })
  });
  const { clientSecret } = await resp.json();

  elements = stripe.elements({ clientSecret });
  paymentElement = elements.create('payment');
  paymentElement.mount('#payment-element');
}

// --- WebSocket update initial + temps réel ---
socket.on('update', ({ total, last }) => {
  totalEl.textContent = total;
  lastEl.textContent = last ? `Last donor: ${last.pseudo} ($${last.amount})` : 'Last donor: -';
  progressEl.style.width = `${Math.min((Number(total)||0) / 1000000 * 100, 100)}%`;
});

// --- Animation réaliste limitée ---
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

    p.x += p.vx;
    p.y += p.vy;
    p.r += p.vr;

    if (p.img === coinsImg && p.y + (p.img.height/2) > canvas.height) {
      p.vy *= -0.5;
      p.y = canvas.height - (p.img.height/2);
      p.vx *= 0.7;
    }
    if (p.y > canvas.height + 120) particles.splice(i, 1);
  }
  requestAnimationFrame(animate);
}
animate();

// --- Click Donate ---
donateBtn.addEventListener('click', async () => {
  donateBtn.disabled = true;

  const amount = parseFloat(amountEl.value) || 1;
  const pseudo = pseudoEl.value || 'Anonymous';

  // Confirmer le paiement (Payment Element)
  const { error } = await stripe.confirmPayment({
    elements,
    // Pas de redirection nécessaire, on reste sur la page
    redirect: 'if_required'
  });
  if (error) {
    alert(error.message);
    donateBtn.disabled = false;
    return;
  }

  // Son au clic OK (débloqué par interaction)
  try { coinSound.currentTime = 0; await coinSound.play(); } catch {}

  // Enregistrer le don (DB) + socket.io broadcast côté serveur
  await fetch('/api/donate', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ pseudo, amount })
  });

  // Animation visuelle
  createParticles(amount);

  // Ré-initialiser un nouveau PaymentIntent pour un nouveau don
  await initPaymentElement();
  donateBtn.disabled = false;
});
