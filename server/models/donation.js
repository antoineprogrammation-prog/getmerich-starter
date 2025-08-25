const pool = require('../db');

async function addDonation(pseudo, amount) {
  const res = await pool.query(
    'INSERT INTO donations(pseudo, amount) VALUES($1, $2) RETURNING *',
    [pseudo, amount]
  );
  return res.rows[0];
}

async function getTotalDonations() {
  const res = await pool.query('SELECT SUM(amount) as total FROM donations');
  return res.rows[0].total || 0;
}

async function getLastDonation() {
  const res = await pool.query('SELECT * FROM donations ORDER BY created_at DESC LIMIT 1');
  return res.rows[0];
}

module.exports = { addDonation, getTotalDonations, getLastDonation };
