const { pool } = require('../db');

async function addDonation(pseudo, amount, netAmount) {
  const res = await pool.query(
    'INSERT INTO donations(pseudo, amount, net_amount) VALUES($1,$2,$3) RETURNING *',
    [pseudo, amount, netAmount]
  );
  return res.rows[0];
}

async function getTotals() {
  const res = await pool.query(`
    SELECT
      COALESCE(SUM(amount),0)      AS total_gross,
      COALESCE(SUM(COALESCE(net_amount, amount)),0) AS total_net
    FROM donations
  `);
  return {
    totalGross: Number(res.rows[0].total_gross || 0),
    totalNet: Number(res.rows[0].total_net || 0),
  };
}

async function getLastDonation() {
  const res = await pool.query('SELECT * FROM donations ORDER BY created_at DESC, id DESC LIMIT 1');
  return res.rows[0] || null;
}

module.exports = { addDonation, getTotals, getLastDonation };
