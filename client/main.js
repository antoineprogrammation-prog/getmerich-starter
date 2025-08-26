// -------------------- Helpers UI --------------------
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

// Elements already in your HTML
const totalEl = document.getElementById('total');
const lastEl = document.getElementById('last');
const progressEl = document.getElementById('progress');
const donateBtn = document.getElementById('donateBtn');
const pseudoEl = document.getElementById('pseudo');
const amountEl = document.getElementById('amount');
const coinSound = document.getElementById('coinSound');

// -------------------- WebSocket --------------------
const socket = io();

// -------------------- Mobile audio unlock --------------------
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
  } catch {}
}
window.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

// -------------------- Confetti animation (coins/bills) --------------------
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

// -------------------- 1,000,000-pixel reveal --------------------
const GRID = 1000;                 // 1000 x 1000 = 1,000,000 pixels
const TOTAL_PIXELS = GRID * GRID;

const photoCanvas = document.getElementById('photoCanvas');
const maskCanvas  = document.getElementById('maskCanvas');
const photoCtx = photoCanvas.getContext('2d');
const maskCtx  = maskCanvas.getContext('2d', { willReadFrequently: true });

let photoImg = null;
let maskImageData = null;

// Data structures to keep already revealed pixels persistent (per page session)
let covered = null;    // Uint32Array of remaining pixel indices
let coveredLen = 0;    // active length
let revealedCount = 0; // how many pixels are already revealed

async function initRevealStage() {
  // Internal resolution for the photo (matches CSS aspect ratio 1080x1616)
  photoCanvas.width = 1080;
  photoCanvas.height = 1616;

  // Mask exact grid 1000x1000 (upscaled via CSS)
  maskCanvas.width = GRID;
  maskCanvas.height = GRID;

  try {
    // Your portrait (put the file at /client/assets/me.jpg in the repo)
    photoImg = await loadImage('/assets/me.jpg');
  } catch (e) {
    // Fallback background if photo is missing
    const cw = photoCanvas.width, ch = photoCanvas.height;
    const g = photoCtx.createLinearGradient(0,0, cw,ch);
    g.addColorStop(0, '#111'); g.addColorStop(1, '#222');
    photoCtx.fillStyle = g; photoCtx.fillRect(0,0,cw,ch);
  }

  drawPhotoCover();
  generateGoldMaskOpaque();

  // Prepare the “remaining pixels” index
  covered = new Uint32Array(TOTAL_PIXELS);
  for (let i = 0; i < TOTAL_PIXELS; i++) covered[i] = i;
  coveredLen = TOTAL_PIXELS;
  revealedCount = 0;
}

function drawPhotoCover() {
  const cw = photoCanvas.width, ch = photoCanvas.height;
  photoCtx.clearRect(0,0,cw,ch);

  if (!photoImg) return; // fallback already painted in init

  const iw = photoImg.width, ih = photoImg.height;
  const cr = cw / ch, ir = iw / ih;
  let sx, sy, sw, sh;
  if (ir > cr) { sh = ih; sw = ih * cr; sx = (iw - sw) / 2; sy = 0; }
  else { sw = iw; sh = iw / cr; sx = 0; sy = (ih - sh) / 2; }
  photoCtx.drawImage(photoImg, sx, sy, sw, sh, 0, 0, cw, ch);
}

function generateGoldMaskOpaque() {
  // Start full opaque gold-ish
  const d = maskCtx.createImageData(GRID, GRID);
  const arr = d.data;
  for (let i = 0; i < TOTAL_PIXELS; i++) {
    // subtle golden noise
    const palette = [
      [201,173, 67],[212,175, 55],[184,134, 11],[230,190, 95],[255,215,  0]
    ];
    const base = palette[(Math.random() * palette.length) | 0];
    const vr = (Math.random() * 22) - 11;
    const vg = (Math.random() * 22) - 11;
    const vb = (Math.random() * 22) - 11;
    const r = Math.max(0, Math.min(255, base[0] + vr));
    const g = Math.max(0, Math.min(255, base[1] + vg));
    const b = Math.max(0, Math.min(255, base[2] + vb));
    const j = i * 4;
    arr[j]   = r; arr[j+1] = g; arr[j+2] = b; arr[j+3] = 255; // opaque
  }
  maskImageData = d;
  maskCtx.putImageData(maskImageData, 0, 0);
}

// Reveal N random *unrevealed* pixels permanently (no re-randomization of past)
function revealPixels(count) {
  if (!maskImageData || coveredLen <= 0 || count <= 0) return;
  const d = maskImageData.data;

  // batch for perf
  const BATCH = 10000;
  let remaining = Math.min(count, coveredLen);

  while (remaining > 0) {
    const step = Math.min(remaining, BATCH);
    for (let i = 0; i < step; i++) {
      const r = (Math.random() * coveredLen) | 0;
      const idx = covered[r];
      // remove this idx from the set (swap with the end)
      covered[r] = covered[coveredLen - 1];
      coveredLen--;

      const p = idx * 4;
      d[p + 3] = 0; // alpha -> transparent (revealed)
      revealedCount++;
      if (coveredLen === 0) break;
    }
    maskCtx.putImageData(maskImageData, 0, 0);
    remaining -= step;
    if (coveredLen === 0) break;
  }
}

// Move reveal to match target pixels (floor of totalNet)
function revealToTarget(targetPixels) {
  const t = Math.max(0, Math.min(TOTAL_PIXELS, Math.floor(targetPixels)));
  const need = t - revealedCount;
  if (need > 0) revealPixels(need);
}

// -------------------- Stripe (Payment Element) --------------------
let stripe, elements, paymentElement;

async function fetchConfig() {
  const r = await fetch('/api/config');
  const data = await r.json();
  if (!data.publishableKey) throw new Error('Stripe publishable key missing.');
  return data;
}
async function createPaymentIntent(amount, pseudo) {
  const r = await fetch('/api/create-payment-intent', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ amount, pseudo })
  });
  const data = await r.json();
  if (!r.ok || !data.clientSecret) throw new Error(data.error || 'PaymentIntent failed.');
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

async function confirmAndRecord() {
  const { error } = await stripe.confirmPayment({ elements, redirect: 'if_required' });
  if (error) throw new Error(error.message || 'Payment failed');

  // play sound on success
  try { coinSound.currentTime = 0; await coinSound.play(); } catch {}

  const amount = Math.max(1, Math.floor(Number(amountEl.value || 1)));
  const pseudo = (pseudoEl.value || 'Anonymous').slice(0, 50);

  const r = await fetch('/api/donate', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ pseudo, amount })
  });
  const data = await r.json();
  if (!r.ok || !data.success) throw new Error(data.error || 'Donation save failed');

  // update UI using server totals (NET)
  applyTotalsNet(data.totalNet, data.last);
  // confetti
  createParticles(amount);
  // remount a fresh Payment Element for next donation
  await mountPaymentElement();
}

// -------------------- Totals / Progress / Reveal binding --------------------
function applyTotalsNet(totalNet, last) {
  const t = Number(totalNet) || 0;
  // UI progress
  totalEl.textContent = t.toFixed(2).replace(/\.00$/, '');
  progressEl.style.width = `${Math.min((t / 1_000_000) * 100, 100)}%`;
  lastEl.textContent = last ? `Thanks to the last donor : ${last.pseudo} ($${last.amount})` : 'Thanks to the last donor : -';

  // 🔗 Reveal exactly floor(totalNet) pixels
  revealToTarget(Math.floor(t));
}

// Socket: live update from server
socket.on('update', ({ totalNet, last }) => applyTotalsNet(totalNet, last));

// -------------------- Initial load --------------------
async function loadInitialTotals() {
  // Try a few known endpoints, fall back silently if missing
  const endpoints = ['/api/summary', '/api/donations/summary', '/api/total'];
  for (const url of endpoints) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const data = await r.json();
      // normalize shape
      if (typeof data.totalNet !== 'undefined') {
        applyTotalsNet(data.totalNet, data.last || null);
        return;
      }
      if (typeof data.total !== 'undefined') {
        applyTotalsNet(data.total, data.last || null);
        return;
      }
    } catch {}
  }
  // If no endpoint worked, leave at 0 (revealedCount stays 0)
}

document.addEventListener('DOMContentLoaded', async () => {
  try { await initRevealStage(); }
  catch (e) { showError('Reveal init error: ' + (e.message || e)); }

  // Initialize totals (reveals correct number of pixels if e.g. 19/1,000,000)
  await loadInitialTotals();

  // Stripe
  mountPaymentElement().catch(err => showError('Stripe init error: ' + (err.message || err)));
});

// Recreate PaymentIntent when amount changes
amountEl.addEventListener('change', () => {
  mountPaymentElement().catch(err => showError('Stripe reinit error: ' + (err.message || err)));
});

// Donate button
donateBtn.addEventListener('click', async () => {
  await unlockAudio();
  donateBtn.disabled = true; clearError();
  try { await confirmAndRecord(); }
  catch (e) { showError(e.message || String(e)); }
  finally { donateBtn.disabled = false; }
});
