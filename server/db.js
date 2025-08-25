const { Pool } = require('pg');
require('dotenv').config();

let pool;
const configSummary = {
  hasDatabaseUrl: !!process.env.DATABASE_URL,
  hasDbUser: !!process.env.DB_USER,
  hasDbHost: !!process.env.DB_HOST,
  hasDbName: !!process.env.DB_NAME,
  hasDbPassword: !!process.env.DB_PASSWORD,
  pgSslMode: process.env.PGSSLMODE || null,
  mode: null // 'database_url' | 'db_vars' | 'none'
};

// 1) Cas Railway: DATABASE_URL
if (configSummary.hasDatabaseUrl) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
  });
  configSummary.mode = 'database_url';
}
// 2) Cas variables séparées (local ou autre)
else if (configSummary.hasDbUser && configSummary.hasDbHost && configSummary.hasDbName) {
  pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
  });
  configSummary.mode = 'db_vars';
}
// 3) Pas de config: on crée un faux pool qui renvoie une erreur explicite
else {
  configSummary.mode = 'none';
  pool = {
    query: async () => {
      throw new Error(
        'DB not configured: set DATABASE_URL (recommended) ' +
        'or DB_USER/DB_PASSWORD/DB_HOST/DB_NAME environment variables.'
      );
    }
  };
}

// Initialisation auto de la table
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS donations (
      id SERIAL PRIMARY KEY,
      pseudo VARCHAR(50) NOT NULL,
      amount NUMERIC(10,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

module.exports = { pool, initDB, configSummary };
