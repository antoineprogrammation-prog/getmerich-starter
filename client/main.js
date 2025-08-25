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

// --- Canvas & animation confetti coins/bills ---
const animCanvas = document.getElementById('animationCanvas');
const animCtx = animCanvas.getContext('2d');
function resizeAnim() { animCanvas.width = innerWidth; animCanvas.height = innerHeight; }
addEventListener('resize', resizeAnim); resizeAnim();

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
let coinsImg, billsImg, assetsReady = false;
Promise.all([
  loadImage('/assets/coins.png').then(img => (coinsImg = img)),
  loadImage('/assets/bills.png').then(img => (billsImg = img)),
]).then(() => { assetsReady = true; }).catch(() => {});

/* ---------- NEW: 1,000,000-pixel reveal ---------- */
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
let revealedCount = 0; // combien de pixels déjà révélés (alpha = 0)

// charge la photo et prépare les canvases
async function initRevealStage() {
  // taille visuelle = CSS; taille interne = on suit le container pour la photo
  const stage = document.querySelector('.reveal-stage');
  const rect = stage.getBoundingClientRect();
  photoCanvas.width = rect.width;
  photoCanvas.height = rect.height;

  // masque: résolution 1000x1000 pour 1M pixels (sera upscalé par CSS)
  maskCanvas.width = GRID;
  maskCanvas.height = GRID;

  // charge la photo (mets ton image dans client/assets/me.jpg)
  photoImg = await loadImage('/assets/me.jpg');
  // dessine la photo à la taille du stage (contain ou cover — on va cover)
  drawPhotoCover();

  // initialise le masque doré (nuances aléatoires)
  generateGoldMask();

  // initialise l’indexation des pixels couverts
  covered = new Uint32Array(TOTAL_PIXELS);
  for (let i = 0; i < TOTAL_PIXELS; i++) covered[i] = i;
  coveredLen = TOTAL_PIXELS;
  revealedCount = 0;
}

// dessine la photo en "cover" dans photoCanvas
function drawPhotoCover() {
  const cw = photoCanvas.width, ch = photoCanvas.height;
  photoCtx.clearRect(0,0,cw,ch);

  const iw = photoImg.width, ih = photoImg.height;
  const cr = cw / ch;
  const ir = iw / ih;

  let dw, dh, dx, dy;
  if (ir > cr) {
    // image plus large → on ajuste en hauteur
    dh = ch;
    dw = ih * cr;
    dx = (iw - dw) / 2;
    dy = 0;
    // drawImage sx sy sw sh dx dy dw dh
    photoCtx.drawImage(photoImg, dx, dy, dw, dh, 0, 0, cw, ch);
  } else {
    // image plus haute → on ajuste en largeur
    dw = cw;
    dh = iw / cr;
    dx = 0;
    dy = (ih - dh) / 2;
    photoCtx.drawImage(photoImg, dx, dy, dw, dh, 0, 0, cw, ch);
  }
}

// crée un masque doré granuleux (1 pixel = 1 case)
function generateGoldMask() {
  maskImageData = maskCtx.createImageData(GRID, GRID);
  const d = maskImageData.data;

  for (let i = 0; i < TOTAL_PIXELS; i++) {
    // palette d'or (aléatoire)
    // teintes autour de 45°-55° HSL converties approx → on fait simple en RGB pré-calculées
    // on varie légèrement pour l'effet mosaïque
    const base = [
      [201, 173,  67], // or chaud
      [212, 175,  55],
      [184, 134,  11], // goldenrod
      [230, 190,  95],
      [255, 215,   0]  // gold
    ][Math.floor(Math.random() * 5)];

    // petite variation
    const vr = (Math.random() * 20) - 10;
    const vg = (Math.random() * 20) - 10;
    const vb = (Math.random() * 20) - 10;

    const r = Math.max(0, Math.min(255, base[0] + vr));
    const g = Math.max(0, Math.min(255, base[1] + vg));
    const b = Math.max(0, Math.min(255, base[2] + vb));

    const j = i * 4;
    d[j]   = r;
    d[j+1] = g;
    d[j+2] = b;
    d[j+3] = 255; // opaque (caché)
  }

  maskCtx.putImageData(maskImageData, 0, 0);
}

// révèle un nombre de pixels (aléatoires) en mettant alpha=0
function revealPixels(count) {
  if (!maskImageData || coveredLen <= 0 || count <= 0) return;

  const d = maskImageData.data;

  // On limite pour éviter de bloquer le thread si count est énorme
  const BATCH = 10000; // on commit par blocs
  let remaining = Math.min(count, coveredLen);

  while (remaining > 0) {
    const step = Math.min(remaining, BATCH);
    for (let i = 0; i < step; i++) {
      // random swap-pop
      const r = (Math.random() * coveredLen) | 0;
      const idx = covered[r];
      covered[r] = covered[coveredLen - 1];
      coveredLen--;

      const p = idx * 4;
      d[p + 3] = 0; // alpha transparent → révèle la photo
      revealedCount++;
      if (coveredLen === 0) break;
    }
    maskCtx.putImageData(maskImageData, 0, 0);
    remaining -= step;
    if (coveredLen === 0) break;
  }
}

// aligne l'état avec une cible (ex: totalNet en $)
function revealToTarget(target) {
  const t = Math.max(0, Math.min(TOTAL_PIXELS, Math.floor(target)));
  const need = t - revealedCount;
  if (need > 0) revealPixels(need);
}

// redimensionne le stage si la fenêtre change
window.addEventListener('resize', () => {
  if (!photoImg) return;
  const stage = document.querySelector('.reveal-stage');
  const rect = stage.getBoundingClientRect();
  photoCanvas.width = rect.width;
  photoCanvas.height = rect.height;
  drawPhotoCover();
  // maskCanvas reste à 1000x1000 (volontaire), CSS l'agrandit
});

/* ---------- Fin 1M pixels ---------- */

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
  if (!r.ok || !data.clientSecret) throw new Error(data.error || 'PaymentIntent creation failed.');
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
    showError('Payments are processed live. Test cards will be declined.');
    setTimeout(() => clearError(), 6000);
  }
}

// --- UI net ---
function applyTotalsNet(totalNet, last) {
  const t = Number(totalNet) || 0;
  totalEl.textContent = t.toFixed(2).replace(/\.00$/, '');
  progressEl.style.width = `${Math.min((t / 1_000_000) * 100, 100)}%`;
  lastEl.textContent = last ? `Last donor: ${last.pseudo} ($${last.amount})` : 'Last donor: -';

  // NEW: aligne la révélation des pixels sur le total net
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

  applyTotalsNet(data.totalNet, data.last); // met à jour jauge + révélation
  createParticles(amount);

  // remonte un nouveau PI pour prochain don
  await mountPaymentElement();
}

// Init + events
document.addEventListener('DOMContentLoaded', async () => {
  // init stage (photo + masque)
  try { 
    await initRevealStage();
  } catch (e) {
    showError('Photo not found. Please add /assets/me.jpg');
  }
  // monter Stripe
  mountPaymentElement().catch(err => showError('Stripe init error: ' + (err.message || err)));
});

// re-créer PaymentIntent si le montant change
amountEl.addEventListener('change', () => {
  mountPaymentElement().catch(err => showError('Stripe reinit error: ' + (err.message || err)));
});

// Bouton Donate
donateBtn.addEventListener('click', async () => {
  donateBtn.disabled = true; clearError();
  try { await confirmAndRecord(); }
  catch (e) { showError(e.message || String(e)); }
  finally { donateBtn.disabled = false; }
});
