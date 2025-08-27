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

// --- WebSocket (même origine) ---
const socket = io();
const totalEl = document.getElementById('total');
const lastEl = document.getElementById('last');
const progressEl = document.getElementById('progress');
const donateBtn = document.getElementById('donateBtn');
const pseudoEl = document.getElementById('pseudo');
const amountEl = document.getElementById('amount');
const coinSound = document.getElementById('coinSound');

// ====== 🔊 Déblocage audio mobile ======
let audioUnlocked = false;
async function unlockAudio() {
  if (audioUnlocked || !coinSound) return;
  try {
    coinSound.muted = true;
    await coinSound.play();
    await new Promise(r => setTimeout(r, 10));
    coinSound.pause();
    coinSound.currentTime = 0;
    coinSound.muted = false;
    audioUnlocked = true;
  } catch { /* ignoré */ }
}
window.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

// --- Canvas & animation confetti coins/bills ---
const animCanvas = document.getElementById('animationCanvas');
const animCtx = animCanvas.getContext('2d');
function resizeAnim() { animCanvas.width = innerWidth; animCanvas.height = innerHeight; }
addEventListener('resize', resizeAnim); resizeAnim();

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed: ' + src));
    img.src = src;
  });
}
let coinsImg, billsImg, assetsReady = false;
Promise.all([
  loadImage('/assets/coins.png').then(img => (coinsImg = img)),
  loadImage('/assets/bills.png').then(img => (billsImg = img)),
]).then(() => { assetsReady = true; }).catch(() => {});

/* ---------- 1,000,000-pixel reveal ---------- */
const GRID = 1000; // 1000 x 1000 = 1,000,000 pixels
const TOTAL_PIXELS = GRID * GRID;

const photoCanvas = document.getElementById('photoCanvas');
const maskCanvas  = document.getElementById('maskCanvas');
const photoCtx = photoCanvas.getContext('2d');
const maskCtx  = maskCanvas.getContext('2d', { willReadFrequently: true });

let photoImg = null;
let maskImageData = null;
let covered = null;    // Uint32Array indices [0..TOTAL_PIXELS-1]
let coveredLen = 0;    // longueur active
let revealedCount = 0; // combien déjà révélés

async function initRevealStage() {
  photoCanvas.width = 1080;
  photoCanvas.height = 1616;
  maskCanvas.width = GRID;
  maskCanvas.height = GRID;

  try {
    photoImg = await loadImage('/assets/me.jpg');
  } catch (e) {
    showError('Photo not found. Please add /assets/me.jpg');
  }

  drawPhotoCover();
  generateGoldMaskOpaque();

  covered = new Uint32Array(TOTAL_PIXELS);
  for (let i = 0; i < TOTAL_PIXELS; i++) covered[i] = i;
  coveredLen = TOTAL_PIXELS;
  revealedCount = 0;
}

function drawPhotoCover() {
  const cw = photoCanvas.width, ch = photoCanvas.height;
  photoCtx.clearRect(0,0,cw,ch);

  if (!photoImg) {
    const g = photoCtx.createLinearGradient(0,0, cw,ch);
    g.addColorStop(0, '#111'); g.addColorStop(1, '#222');
    photoCtx.fillStyle = g;
    photoCtx.fillRect(0,0,cw,ch);
    return;
  }

  const iw = photoImg.width, ih = photoImg.height;
  const cr = cw / ch;
  const ir = iw / ih;

  let sx, sy, sw, sh;
  if (ir > cr) { sh = ih; sw = ih * cr; sx = (iw - sw) / 2; sy = 0; }
  else { sw = iw; sh = iw / cr; sx = 0; sy = (ih - sh) / 2; }
  photoCtx.drawImage(photoImg, sx, sy, sw, sh, 0, 0, cw, ch);
}

function generateGoldMaskOpaque() {
  maskCtx.save();
  maskCtx.fillStyle = '#c9a227';
  maskCtx.fillRect(0,0,GRID,GRID);
  maskCtx.restore();

  maskImageData = maskCtx.createImageData(GRID, GRID);
  const d = maskImageData.data;

  for (let i = 0; i < TOTAL_PIXELS; i++) {
    const base = [
      [201, 173,  67],
      [212, 175,  55],
      [184, 134,  11],
      [230, 190,  95],
      [255, 215,   0]
    ][(Math.random() * 5) | 0];

    const vr = (Math.random() * 22) - 11;
    const vg = (Math.random() * 22) - 11;
    const vb = (Math.random() * 22) - 11;

    const r = Math.max(0, Math.min(255, base[0] + vr));
    const g = Math.max(0, Math.min(255, base[1] + vg));
    const b = Math.max(0, Math.min(255, base[2] + vb));

    const j = i * 4;
    d[j]   = r;
    d[j+1] = g;
    d[j+2] = b;
    d[j+3] = 255; // opaque
  }

  maskCtx.putImageData(maskImageData, 0, 0);
}

// Révèle `count` pixels aléatoires (alpha → 0)
function revealPixels(count) {
  if (!maskImageData || coveredLen <= 0 || count <= 0) return;

  const d = maskImageData.data;
  const BATCH = 10000;
  let remaining = Math.min(count, coveredLen);

  while (remaining > 0) {
    const step = Math.min(remaining, BATCH);
    for (let i = 0; i < step; i++) {
      const r = (Math.random() * coveredLen) | 0;
      const idx = covered[r];
      covered[r] = covered[coveredLen - 1];
      coveredLen--;

      const p = idx * 4;
      d[p + 3] = 0; // transparent
      revealedCount++;
      if (coveredLen === 0) break;
    }
    maskCtx.putImageData(maskImageData, 0, 0);
    remaining -= step;
    if (coveredLen === 0) break;
  }
}

function revealToTarget(target) {
  const t = Math.max(0, Math.min(TOTAL_PIXELS, Math.floor(target)));
  const need = t - revealedCount;
  if (need > 0) revealPixels(need);
}

// --- Stripe ---
let stripe, elements, paymentElement;

async function fetchConfig() {
  const r = await fetch('/api/config', { cache: 'no-store' });
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
  if (!r.ok || !data.clientSecret) throw new Error(data.error || 'PaymentIntent creation failed.');
  return data.clientSecret;
}
async function mountPaymentElement() {
  clearError();
  const { publishableKey } = await fetchConfig();
  stripe = Stripe(publishableKey);

  const amount = Math.max(1, Math.floor(Number(amountEl.value || 1)));
  const pseudo = (pseudoEl.value || 'Anonymous').slice(0, 50);

  const clientSecret = await createPaymentIntent(amount, pseudo);

  if (paymentElement) paymentElement.destroy();
  elements = stripe.elements({ clientSecret });
  paymentElement = elements.create('payment');
  paymentElement.mount('#payment-element');
  donateBtn.disabled = false;
}

// --- UI net + thanks text + pixels
function applyTotalsNet(totalNet, last) {
  const t = Number(totalNet) || 0;
  totalEl.textContent = t.toFixed(2).replace(/\.00$/, '');
  const pct = Math.min((t / 1_000_000) * 100, 100);
  progressEl.style.width = `${pct}%`;
  if (pct > 0) progressEl.classList.add('nonzero'); else progressEl.classList.remove('nonzero');
  lastEl.textContent = last ? `Thanks to the last donor : ${last.pseudo} ($${last.amount})` : 'Thanks to the last donor : -';
  revealToTarget(t);
}

// --- Socket updates (NET) ---
socket.on('update', ({ totalNet, last }) => applyTotalsNet(totalNet, last));

// --- Confetti (coins/bills) animation ---
let particles = [];
function createParticles(amount) {
  if (!assetsReady) return;
  const maxCoins = Math.min(Math.max(3, Math.floor(amount / 5)), 10);
  const maxBills = amount >= 20 ? Math.min(Math.floor(amount / 20), 5) : 0;
  for (let i = 0; i < maxCoins; i++) {
    particles.push({
      img: coinsImg, x: Math.random() * animCanvas.width, y: -50,
      vx: (Math.random() - 0.5) * 1.2, vy: 2 + Math.random() * 2,
      r: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.2
    });
  }
  for (let i = 0; i < maxBills; i++) {
    particles.push({
      img: billsImg, x: Math.random() * animCanvas.width, y: -50,
      vx: (Math.random() - 0.5) * 0.6, vy: 1 + Math.random() * 1.2,
      r: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.05
    });
  }
}
function animateConfetti() {
  animCtx.clearRect(0,0,animCanvas.width,animCanvas.height);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    animCtx.save();
    animCtx.translate(p.x, p.y);
    animCtx.rotate(p.r);
    if (p.img) animCtx.drawImage(p.img, -p.img.width/2, -p.img.height/2);
    animCtx.restore();
    p.x += p.vx; p.y += p.vy; p.r += p.vr;
    if (p.img === coinsImg && p.y + (p.img.height/2) > animCanvas.height) {
      p.vy *= -0.5; p.y = animCanvas.height - (p.img.height/2); p.vx *= 0.7;
    }
    if (p.y > animCanvas.height + 120) particles.splice(i, 1);
  }
  requestAnimationFrame(animateConfetti);
}
animateConfetti();

// --- Flow Donate ---
async function confirmAndRecord() {
  const { error } = await stripe.confirmPayment({ elements, redirect: 'if_required' });
  if (error) throw new Error(error.message || 'Payment failed');

  try { coinSound.currentTime = 0; await coinSound.play(); } catch {}

  const amount = Math.max(1, Math.floor(Number(amountEl.value || 1)));
  const pseudo = (pseudoEl.value || 'Anonymous').slice(0, 50);

  const r = await fetch('/api/donate', {
    method: 'POST', headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ pseudo, amount })
  });
  const data = await r.json();
  if (!r.ok || !data.success) throw new Error(data.error || 'Donation save failed');

  applyTotalsNet(data.totalNet, data.last);
  createParticles(amount);

  await mountPaymentElement();
}

// --- Chargement initial: récupère le total serveur (important!) ---
async function loadInitialTotal() {
  const endpoints = ['/api/summary', '/api/donations/summary', '/api/total'];
  for (const url of endpoints) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) continue;
      const d = await r.json();
      if (typeof d.totalNet !== 'undefined') { applyTotalsNet(d.totalNet, d.last || null); return; }
      if (typeof d.total    !== 'undefined') { applyTotalsNet(d.total,    d.last || null); return; }
    } catch {}
  }
  // fallback: aligne a minima 7219.54 si aucune route ne répond
  applyTotalsNet(7219.54, null);
}

// Init + events
document.addEventListener('DOMContentLoaded', async () => {
  try { await initRevealStage(); } 
  catch (e) { showError('Reveal init error: ' + (e.message || e)); }

  await loadInitialTotal();           // <-- met à jour la jauge au chargement
  mountPaymentElement().catch(err => showError('Stripe init error: ' + (err.message || err)));
});

amountEl.addEventListener('change', () => {
  mountPaymentElement().catch(err => showError('Stripe reinit error: ' + (err.message || err)));
});

donateBtn.addEventListener('click', async () => {
  await unlockAudio();
  donateBtn.disabled = true; clearError();
  try { await confirmAndRecord(); }
  catch (e) { showError(e.message || String(e)); }
  finally { donateBtn.disabled = false; }
});
