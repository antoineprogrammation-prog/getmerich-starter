const { pool } = require('../db');

async function addDonation(pseudo, amount) {
  const res = await pool.query(
    'INSERT INTO donations(pseudo, amount) VALUES($1,$2) RETURNING *',
    [pseudo, amount]
  );
  return res.rows[0];
}

async function getTotalDonations() {
  const res = await pool.query('SELECT COALESCE(SUM(amount),0) AS total FROM donations');
  return Number(res.rows[0].total || 0);
}

async function getLastDonation() {
  const res = await pool.query('SELECT * FROM donations ORDER BY created_at DESC, id DESC LIMIT 1');
  return res.rows[0] || null;
}

module.exports = { addDonation, getTotalDonations, getLastDonation };
