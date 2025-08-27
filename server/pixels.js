// server/pixels.js
// Génère une permutation déterministe de [0..999999] avec un PRNG seedé.
// On calcule une fois au démarrage, et on sert des tranches [0..count).

const GRID = 1000;
const TOTAL = GRID * GRID;

// Petit PRNG xorshift32 seedé pour piloter un Fisher-Yates
function xorshift32(seed) {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x << 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return x >>> 0;
  };
}

// Convertit une chaîne en seed 32-bit
function seedFromString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h >>> 0;
}

// Fisher–Yates déterministe
function buildPermutation(seedStr = "getmerich-v1") {
  const seed = seedFromString(seedStr);
  const rnd = xorshift32(seed);
  const arr = new Uint32Array(TOTAL);
  for (let i = 0; i < TOTAL; i++) arr[i] = i;

  for (let i = TOTAL - 1; i > 0; i--) {
    // rnd() renvoie [0..2^32-1], on réduit modulo (i+1)
    const j = rnd() % (i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

let PERM = null;

function getPermutation() {
  if (!PERM) {
    // ⚠️ construit ~4 Mo + un peu de CPU au démarrage
    PERM = buildPermutation(process.env.PIXEL_SEED || "getmerich-v1");
  }
  return PERM;
}

// Retourne un tableau JS (classique) des indices [0..count) de la permutation
function firstN(count) {
  const perm = getPermutation();
  const n = Math.max(0, Math.min(TOTAL, Math.floor(count)));
  // slice sur typed array → copie en typed, on repasse en Array classique pour JSON
  const sub = perm.slice(0, n);
  return Array.from(sub);
}

module.exports = { GRID, TOTAL, firstN };
