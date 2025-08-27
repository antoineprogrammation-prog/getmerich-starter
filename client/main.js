/*************************
 * UI + helpers
 *************************/
const notice   = document.getElementById('notice');
const totalEl  = document.getElementById('total');
const lastEl   = document.getElementById('last');
const progress = document.getElementById('progress');
const progressLabel = document.getElementById('progress-label');

const donateBtn = document.getElementById('donateBtn');
const pseudoEl  = document.getElementById('pseudo');
const amountEl  = document.getElementById('amount');
const coinSound = document.getElementById('coinSound');

const fmtMoney = (v) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

function showError(msg) {
  if (!notice) return;
  notice.textContent = msg;
  notice.classList.add('error');
  notice.classList.remove('hidden');
}
function hideError() {
  if (!notice) return;
  notice.textContent = '';
  notice.classList.remove('error');
  notice.classList.add('hidden');
}

/*************************
 * Socket.io (live updates)
 *************************/
const socket = window.io ? io() : { on(){}, emit(){} };

/*************************
 * Audio unlock (mobile)
 *************************/
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
addEventListener('pointerdown', unlockAudio, { once: true });
addEventListener('keydown', unlockAudio, { once: true });

/*************************
 * Animations (coins/bills)
 *************************/
const animCanvas = document.getElementById('animationCanvas');
const animCtx    = animCanvas.getContext('2d');
function resizeAnim(){ animCanvas.width = innerWidth; animCanvas.height = innerHeight; }
addEventListener('resize', resizeAnim); resizeAnim();

function loadImage(src){
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('img '+src));
    i.src = src;
  });
}
let coinsImg, billsImg, assetsReady = false;
Promise.all([
  loadImage('/assets/coins.png').then(i => coinsImg = i),
  loadImage('/assets/bills.png').then(i => billsImg = i),
]).then(() => assetsReady = true).catch(() => {});

let particles = [];
function addParticles(amount){
  if (!assetsReady) return;
  const coins = Math.min(Math.max(3, Math.floor(amount / 5)), 10);
  const bills = amount >= 20 ? Math.min(Math.floor(amount / 20), 5) : 0;
  for (let i=0;i<coins;i++){
    particles.push({ img:coinsImg, x:Math.random()*animCanvas.width, y:-50,
      vx:(Math.random()-0.5)*1.2, vy:2+Math.random()*2,
      r:Math.random()*Math.PI*2, vr:(Math.random()-0.5)*0.2 });
  }
  for (let i=0;i<bills;i++){
    particles.push({ img:billsImg, x:Math.random()*animCanvas.width, y:-50,
      vx:(Math.random()-0.5)*0.6, vy:1+Math.random()*1.2,
      r:Math.random()*Math.PI*2, vr:(Math.random()-0.5)*0.05 });
  }
}
(function loop(){
  animCtx.clearRect(0,0,animCanvas.width,animCanvas.height);
  for (let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    animCtx.save(); animCtx.translate(p.x,p.y); animCtx.rotate(p.r);
    p.img && animCtx.drawImage(p.img, -p.img.width/2, -p.img.height/2);
    animCtx.restore();
    p.x += p.vx; p.y += p.vy; p.r += p.vr;
    if (p.img === coinsImg && p.y + (p.img.height/2) > animCanvas.height){
      p.vy *= -0.5; p.y = animCanvas.height - (p.img.height/2); p.vx *= 0.7;
    }
    if (p.y > animCanvas.height + 120) particles.splice(i,1);
  }
  requestAnimationFrame(loop);
})();

/*************************
 * Reveal 1,000,000 pixels (déterministe LCG)
 *************************/
const photoCanvas = document.getElementById('photoCanvas');
const maskCanvas  = document.getElementById('maskCanvas');
const photoCtx = photoCanvas.getContext('2d');
const maskCtx  = maskCanvas.getContext('2d', { willReadFrequently: true });

let photoImg = null;
let maskImageData = null;

// LCG partagé avec le serveur
let LCG = { M: 1_000_000, A: 21, C: 7, SEED: 1234567, GRID: 1000 };
let lcgX = 0;          // état courant
let revealedCount = 0; // combien ont été révélés (toujours en tête de la permutation)

// charge config depuis le serveur (pour rester synchro avec server/pixels.js)
async function loadPixelsConfig(){
  try {
    const r = await fetch('/api/pixels/config', { cache: 'no-store' });
    if (r.ok) {
      const d = await r.json();
      if (d && d.M && d.A && d.C && d.SEED && d.GRID) LCG = d;
    }
  } catch {}
  lcgX = LCG.SEED % LCG.M;
}

// next valeur dans [0..M-1]
function lcgNext(){
  lcgX = ( (LCG.A * lcgX + LCG.C) % LCG.M );
  return lcgX;
}

// convertit index → (x,y)
function idxToXY(idx){
  const x = idx % LCG.GRID;
  const y = (idx / LCG.GRID) | 0;
  return [x, y];
}

// applique transparence pour une position
function clearAlphaAtIndex(i){
  maskImageData.data[i*4 + 3] = 0;
}

function clearAlphaAtXY(x, y){
  const i = (y * LCG.GRID + x);
  clearAlphaAtIndex(i);
}

// révèle jusqu’à target (1 $ = 1 pixel) — ordre déterministe
function revealUpTo(target){
  target = Math.max(0, Math.min(LCG.M, target|0));
  if (!maskImageData) return;
  while (revealedCount < target){
    const idx = lcgNext();           // pixel déterministe suivant
    const [x, y] = idxToXY(idx);
    clearAlphaAtXY(x, y);
    revealedCount++;
  }
  maskCtx.putImageData(maskImageData, 0, 0);
}

async function initRevealStage(){
  await loadPixelsConfig();

  // taille logique
  photoCanvas.width = 1080; photoCanvas.height = 1616;
  maskCanvas.width  = LCG.GRID;  maskCanvas.height  = LCG.GRID;

  // image
  try { photoImg = await loadImage('/assets/me.jpg'); }
  catch {
    const g = photoCtx.createLinearGradient(0,0,photoCanvas.width,photoCanvas.height);
    g.addColorStop(0,'#111'); g.addColorStop(1,'#222');
    photoCtx.fillStyle = g; photoCtx.fillRect(0,0,photoCanvas.width,photoCanvas.height);
  }
  drawPhotoCover();

  // --- Mosaïque de tons dorés (pas un dégradé uniforme) ---
  const d = maskCtx.createImageData(LCG.GRID, LCG.GRID);
  const a = d.data;
  // palette or (variantes)
  const PAL = [
    [201,173,67],  // #c9ad43
    [212,175,55],  // #d4af37
    [184,134,11],  // #b8860b
    [230,190,95],  // #e6be5f
    [255,215,0]    // #ffd700
  ];
  for (let i=0;i<LCG.M;i++){
    const base = PAL[(Math.random()*PAL.length)|0];
    // micro-variations pour l'effet mosaïque
    const r = Math.max(0, Math.min(255, base[0] + (Math.random()*26-13)));
    const g = Math.max(0, Math.min(255, base[1] + (Math.random()*26-13)));
    const b = Math.max(0, Math.min(255, base[2] + (Math.random()*26-13)));
    const j = i*4; a[j]=r; a[j+1]=g; a[j+2]=b; a[j+3]=255;
  }
  maskImageData = d;
  maskCtx.putImageData(maskImageData, 0, 0);
}

function drawPhotoCover(){
  const cw = photoCanvas.width, ch = photoCanvas.height;
  photoCtx.clearRect(0,0,cw,ch);
  if (!photoImg) return;
  // object-fit: cover
  const iw = photoImg.width, ih = photoImg.height;
  const cr = cw / ch, ir = iw / ih;
  let sx,sy,sw,sh;
  if (ir > cr){ sh = ih; sw = ih * cr; sx = (iw - sw)/2; sy = 0; }
  else { sw = iw; sh = iw / cr; sx = 0; sy = (ih - sh)/2; }
  photoCtx.drawImage(photoImg, sx,sy,sw,sh, 0,0,cw,ch);
}

/*************************
 * Jauge + binding pixels
 *************************/
function applyTotalsNet(totalNet, last){
  const t = Number(totalNet) || 0;
  if (totalEl)  totalEl.textContent = fmtMoney(t);
  const pct = Math.max(0, Math.min(100, (t / 1_000_000) * 100));
  if (progress) {
    progress.style.width = `${pct}%`;
    if (pct > 0) progress.classList.add('nonzero'); else progress.classList.remove('nonzero');
  }
  if (progressLabel) progressLabel.textContent = `${pct.toFixed(2)}%`;
  if (lastEl)   lastEl.textContent = last ? `Thanks to the last donor : ${last.pseudo} ($${last.amount})` : 'Thanks to the last donor : -';
  // révélation déterministe jusqu’au floor(totalNet)
  revealUpTo(Math.floor(t));
}

/*************************
 * Chargement initial
 *************************/
async function loadInitialTotals(){
  let serverTotal = null, last = null;
  const endpoints = ['/api/summary', '/api/donations/summary', '/api/total'];
  for (const url of endpoints){
    try{
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) continue;
      const d = await r.json();
      if (typeof d.totalNet !== 'undefined'){ serverTotal = Number(d.totalNet) || 0; last = d.last || null; break; }
      if (typeof d.total    !== 'undefined'){ serverTotal = Number(d.total)    || 0; last = d.last || null; break; }
    }catch{}
  }
  const start = serverTotal ?? 7219.54;
  applyTotalsNet(start, last);
}

// Live updates
socket.on('update', ({ totalNet, last }) => applyTotalsNet(totalNet, last));

/*************************
 * Stripe (Payment Element)
 *************************/
let stripe, elements, paymentElement;

function waitForStripeJs(){
  return new Promise((resolve, reject) => {
    const check = () => {
      if (window.Stripe) return resolve();
      setTimeout(check, 50);
    };
    check();
    setTimeout(() => reject(new Error('Stripe.js not loaded')), 10000);
  });
}

async function fetchConfig(){
  const r = await fetch('/api/config', { cache: 'no-store' });
  const d = await r.json();
  if (!d.publishableKey) throw new Error('Stripe publishable key missing (set STRIPE_PUBLISHABLE_KEY in Railway)');
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
  try{
    hideError();
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
    const pe = document.getElementById('payment-error');
    if (pe) pe.classList.add('hidden');
  } catch (e) {
    showError('Stripe init error: ' + (e.message || e));
    const pe = document.getElementById('payment-error');
    if (pe) { pe.textContent = 'Stripe init error: ' + (e.message || e); pe.classList.remove('hidden'); }
  }
}
async function confirmAndRecord(){
  const { error } = await stripe.confirmPayment({ elements, redirect: 'if_required' });
  if (error) throw new Error(error.message || 'Payment failed');

  // son + particules
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
  await mountPaymentElement(); // prêt pour le don suivant
}

/*************************
 * Boot
 *************************/
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
