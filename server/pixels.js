// Ordre de révélation déterministe via LCG (période complète sur 1 000 000)
const GRID = 1000;         // 1000 x 1000 = 1 000 000
const M = GRID * GRID;     // 1_000_000
// Conditions période complète pour m = 2^6 * 5^6 : a ≡ 1 (mod 20), c coprime à m
const A = 21;              // 21 ≡ 1 (mod 20)
const C = 7;               // impair, coprime à 2 et 5
const SEED = 1234567 % M;  // graine fixe (modifie si besoin, rester stable)

module.exports = { GRID, M, A, C, SEED };
