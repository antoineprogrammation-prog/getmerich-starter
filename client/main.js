/*************************
 * UI + helpers
 *************************/
const notice   = document.getElementById('notice');
const totalEl  = document.getElementById('total');
const lastEl   = document.getElementById('last');
const progress = document.getElementById('progress');

const donateBtn = document.getElementById('donateBtn');
const pseudoEl  = document.getElementById('pseudo');
const amountEl  = document.getElementById('amount');
const coinSound = document.getElementById('coinSound');

const fmtMoney = (v) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

function showError(msg) {
  if (!notice) return;
  notice.textContent = msg;
  notice.classList.remove('hidden');
}
function hideError() {
  if (!notice) return;
  notice.textContent = '';
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
 * Reveal 1,000,000 pixels
 *************************/
const GRID = 1000;                   // 1000 x 1000 = 1 000 000
const TOTAL_PIXELS = GRID * GRID;

const photoCanvas = document.getElementById('photoCanvas');
const maskCanvas  = document.getElementById('maskCanvas');
const photoCtx = photoCanvas.getContext('2d');
const maskCtx  = maskCanvas.getContext('2d', { willReadFrequently: true });

let photoImg = null;
let maskImageData = null;

// Persistance locale des indices révélés
const REVEAL_STORAGE_KEY = 'revealed_indices_v1';
let revealedSet = new Set();

function loadRevealedFromStorage(){
  try {
    const raw = localStorage.getItem(REVEAL_STORAGE_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) revealedSet = new Set(arr);
  } catch {}
}
function saveRevealedToStorage(){
  try { localStorage.setItem(REVEAL_STORAGE_KEY, JSON.stringify([...revealedSet])); } catch {}
}

async function initRevealStage(){
  // taille logique
  photoCanvas.width = 1080; photoCanvas.height = 1616;
  maskCanvas.width  = GRID;  maskCanvas.height  = GRID;

  // image
  try { photoImg = await loadImage('/assets/me.jpg'); }
  catch {
    const g = photoCtx.createLinearGradient(0,0,photoCanvas.width,photoCanvas.height);
    g.addColorStop(0,'#111'); g.addColorStop(1,'#222');
    photoCtx.fillStyle = g; photoCtx.fillRect(0,0,photoCanvas.width,photoCanvas.height);
  }
  drawPhotoCover();

  // masque doré opaque
  const d = maskCtx.createImageData(GRID, GRID);
  const a = d.data;
  for (let i=0;i<TOTAL_PIXELS;i++){
    const pal = [[201,173,67],[212,175,55],[184,134,11],[230,190,95],[255,215,0]];
    const base = pal[(Math.random()*pal.length)|0];
    const r = Math.max(0, Math.min(255, base[0] + (Math.random()*22-11)));
    const g = Math.max(0, Math.min(255, base[1] + (Math.random()*22-11)));
    const b = Math.max(0, Math.min(255, base[2] + (Math.random()*22-11)));
    const j = i*4; a[j]=r; a[j+1]=g; a[j+2]=b; a[j+3]=255;
  }
  maskImageData = d;

  // ré-applique pixels déjà révélés
  loadRevealedFromStorage();
  if (revealedSet.size){
    const data = maskImageData.data;
    for (const idx of revealedSet){
      const p = idx * 4; data[p+3] = 0;
    }
  }
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

// Révèle "count" NOUVEAUX pixels (jamais ceux déjà révélés)
function revealNewPixels(count){
  if (!maskImageData || count <= 0) return;
  const data = maskImageData.data;
  let added = 0, attempts = 0, maxAttempts = count * 50; // sécurité
  while (added < count && attempts < maxAttempts){
    attempts++;
    const idx = (Math.random() * TOTAL_PIXELS) | 0;
    if (revealedSet.has(idx)) continue;
    revealedSet.add(idx);
    const p = idx * 4;
    data[p+3] = 0; // transparent = révélé
    added++;
  }
  if (added > 0){
    maskCtx.putImageData(maskImageData, 0, 0);
    saveRevealedToStorage();
  }
}

// Aligne le nombre de pixels révélés avec le total net ($ → pixels)
function syncRevealToTotal(totalNet){
  const target = Math.max(0, Math.min(TOTAL_PIXELS, Math.floor(totalNet)));
  const have   = revealedSet.size;
  const need   = target - have;
  if (need > 0) revealNewPixels(need);
}

/*************************
 * Totaux / Jauge / Binding reveal
 *************************/
function applyTotalsNet(totalNet, last){
  const t = Number(totalNet) || 0;
  if (totalEl)  totalEl.textContent = fmtMoney(t);
  if (progress) progress.style.width = `${Math.min((t / 1_000_000) * 100, 100)}%`;
  if (lastEl)   lastEl.textContent = last ? `Thanks to the last donor : ${last.pseudo} ($${last.amount})` : 'Thanks to the last donor : -';
  syncRevealToTotal(t);
}

/*************************
 * Chargement initial
 * – Force un minimum à 7 219,53 si l'API ne répond pas (ou renvoie moins)
 *************************/
const MIN_START_TOTAL = 7219.53;

async function loadInitialTotals(){
  let serverTotal = null, last = null;
  const endpoints = ['/api/summary', '/api/donations/summary', '/api/total'];
  for (const url of endpoints){
    try{
      const r = await fetch(url);
      if (!r.ok) continue;
      const d = await r.json();
      if (typeof d.totalNet !== 'undefined'){ serverTotal = Number(d.totalNet) || 0; last = d.last || null; break; }
      if (typeof d.total    !== 'undefined'){ serverTotal = Number(d.total)    || 0; last = d.last || null; break; }
    }catch{}
  }
  const start = serverTotal !== null ? Math.max(MIN_START_TOTAL, serverTotal) : MIN_START_TOTAL;
  applyTotalsNet(start, last);
}

// Live updates depuis le serveur (chaque don à venir)
socket.on('update', ({ totalNet, last }) => applyTotalsNet(totalNet, last));

/*************************
 * Stripe (Payment Element)
 *************************/
let stripe, elements, paymentElement;

async function fetchConfig(){
  const r = await fetch('/api/config');
  const d = await r.json();
  if (!d.publishableKey) throw new Error('Stripe publishable key missing');
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
  } catch (e) { showError('Stripe init error: ' + (e.message || e)); }
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

  // met à jour la jauge + révèle des NOUVEAUX pixels si nécessaire
  applyTotalsNet(data.totalNet, data.last);

  // remonter un Payment Element propre pour le don suivant
  await mountPaymentElement();
}

/*************************
 * Boot
 *************************/
document.addEventListener('DOMContentLoaded', async () => {
  try { await initRevealStage(); } catch (e) { showError('Reveal init error: ' + (e.message || e)); }
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
