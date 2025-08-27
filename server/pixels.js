// server/pixels.js
// Permutation déterministe, calculée à la volée sans shuffle géant.
//
// Idée: bijection linéaire modulo N : perm(i) = (A*i + B) mod N
// Avec N = 1_000_000, choisir A impair et non multiple de 5 (donc gcd(A,N)=1) → bijection.
// B vient du seed pour mélanger la position de départ.

const GRID  = 1000;
const TOTAL = GRID * GRID; // 1_000_000

// seed 32 bits depuis une chaîne (FNV-1a)
function seedFromString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h >>> 0;
}

// fabrique A et B depuis le seed, en garantissant gcd(A, TOTAL) = 1
function deriveAB(seedStr = "getmerich-v1") {
  const s = seedFromString(seedStr);

  // A doit être impair et non multiple de 5 → gcd(A, 2^6*5^6) = 1
  // on construit A à partir du seed puis on force ces contraintes.
  let A = (s | 1);            // force impair
  if (A % 5 === 0) A += 2;    // s'il tombe sur un multiple de 5, on saute de 2 (reste impair)
  A = A % TOTAL;
  if (A === 0) A = 1;         // évite 0

  // B = décalage (n'importe quelle valeur 0..N-1)
  const B = (s * 2654435761) % TOTAL; // mélange simple type Knuth

  return { A, B };
}

let AB = null;
function getAB() {
  if (!AB) AB = deriveAB(process.env.PIXEL_SEED || "getmerich-v1");
  return AB;
}

// Retourne les "count" premiers indices de la permutation déterministe
function firstN(count) {
  const n = Math.max(0, Math.min(TOTAL, Math.floor(count)));
  const { A, B } = getAB();
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    // (A*i + B) mod TOTAL
    out[i] = ( (A * i) % TOTAL + B ) % TOTAL;
  }
  return out;
}

module.exports = { GRID, TOTAL, firstN };
