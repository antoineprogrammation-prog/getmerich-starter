// --- Helpers UI ---
const notice = document.getElementById('notice');
function showError(msg) {
  notice.className = 'notice error';
  notice.textContent = msg;
  notice.classList.remove('hidden');
}
function clearError() {
  notice.className = 'notice hidden';
  notice.textContent = '';
}

// --- WebSocket ---
const socket = io();
const totalEl = document.getElementById('total');
const lastEl = document.getElementById('last');
const progressEl = document.getElementById('progress');
const donateBtn = document.getElementById('donateBtn');
const pseudoEl = document.getElementById('pseudo');
const amountEl = document.getElementById('amount');
const coinSound = document.getElementById('coinSound');

// --- Reveal avec 1 000 000 pixels ---
const GRID = 1000;
const TOTAL_PIXELS = GRID * GRID;

const photoCanvas = document.getElementById('photoCanvas');
const maskCanvas  = document.getElementById('maskCanvas');
const photoCtx = photoCanvas.getContext('2d');
const maskCtx  = maskCanvas.getContext('2d');

let photoImg = null;
let maskImageData = null;
let covered = null;
let coveredLen = 0;
let revealedCount = 0;

// Charge image
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed: " + src));
    img.src = src;
  });
}

// Init stage
async function initRevealStage() {
  const stage = document.querySelector('.reveal-stage');
  const rect = stage.getBoundingClientRect();
  photoCanvas.width = rect.width;
  photoCanvas.height = rect.height;
  maskCanvas.width = GRID;
  maskCanvas.height = GRID;

  try {
    photoImg = await loadImage('/assets/me.jpg');
  } catch (e) {
    showError("Photo not found: put /assets/me.jpg");
    return;
  }

  drawPhotoCover();
  generateMask();

  covered = new Uint32Array(TOTAL_PIXELS);
  for (let i = 0; i < TOTAL_PIXELS; i++) covered[i] = i;
  coveredLen = TOTAL_PIXELS;
  revealedCount = 0;
}

// Dessine la photo (cover)
function drawPhotoCover() {
  const cw = photoCanvas.width, ch = photoCanvas.height;
  photoCtx.clearRect(0,0,cw,ch);

  if (!photoImg) {
    photoCtx.fillStyle = "#111";
    photoCtx.fillRect(0,0,cw,ch);
    return;
  }

  const iw = photoImg.width, ih = photoImg.height;
  const cr = cw / ch;
  const ir = iw / ih;

  let sx, sy, sw, sh;
  if (ir > cr) {
    sh = ih;
    sw = ih * cr;
    sx = (iw - sw) / 2;
    sy = 0;
  } else {
    sw = iw;
    sh = iw / cr;
    sx = 0;
    sy = (ih - sh) / 2;
  }
  photoCtx.drawImage(photoImg, sx, sy, sw, sh, 0, 0, cw, ch);
}

// Génère un masque pixel art coloré
function generateMask() {
  maskImageData = maskCtx.createImageData(GRID, GRID);
  const d = maskImageData.data;

  const palette = [
    [255,215,0], [212,175,55], [184,134,11], [201,173,67], [230,190,95],
    [255,69,0], [30,144,255], [50,205,50], [148,0,211] // couleurs bonus
  ];

  for (let i = 0; i < TOTAL_PIXELS; i++) {
    const base = palette[(Math.random() * palette.length) | 0];
    const r = base[0] + ((Math.random() * 30) - 15);
    const g = base[1] + ((Math.random() * 30) - 15);
    const b = base[2] + ((Math.random() * 30) - 15);

    const j = i * 4;
    d[j]   = Math.max(0, Math.min(255, r));
    d[j+1] = Math.max(0, Math.min(255, g));
    d[j+2] = Math.max(0, Math.min(255, b));
    d[j+3] = 255; // opaque
  }

  maskCtx.putImageData(maskImageData, 0, 0);
}

// Révèle pixels
function revealPixels(count) {
  if (!maskImageData || coveredLen <= 0) return;
  const d = maskImageData.data;

  let remaining = Math.min(count, coveredLen);
  while (remaining-- > 0) {
    const r = (Math.random() * coveredLen) | 0;
    const idx = covered[r];
    covered[r] = covered[--coveredLen];

    const p = idx * 4;
    d[p+3] = 0;
    revealedCount++;
  }

  maskCtx.putImageData(maskImageData, 0, 0);
}

function revealToTarget(target) {
  const t = Math.max(0, Math.min(TOTAL_PIXELS, Math.floor(target)));
  const need = t - revealedCount;
  if (need > 0) revealPixels(need);
}

// --- Stripe etc (inchangé, je laisse ta logique Stripe + WebSocket + animations de dons ici) ---
// ❗ GARDE TON CODE STRIPE EXISTANT ICI
// (je n’ai pas recollé pour éviter d'écraser ce qui marche déjà, on ne touche que la partie "pixels")

// --- Init ---
document.addEventListener('DOMContentLoaded', async () => {
  await initRevealStage();
});
