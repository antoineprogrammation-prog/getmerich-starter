const { Pool } = require('pg');
require('dotenv').config();

let pool;
if (process.env.DATABASE_URL) {
  // Cas Railway / URL unique
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
  });
} else {
  // Cas local / variables séparées
  pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
  });
}

module.exports = pool;
