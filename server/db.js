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
  mode: null
};

if (configSummary.hasDatabaseUrl) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
  });
  configSummary.mode = 'database_url';
} else if (configSummary.hasDbUser && configSummary.hasDbHost && configSummary.hasDbName) {
  pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
  });
  configSummary.mode = 'db_vars';
} else {
  configSummary.mode = 'none';
  pool = {
    query: async () => {
      throw new Error(
        'DB not configured: set DATABASE_URL (recommended) or DB_USER/DB_PASSWORD/DB_HOST/DB_NAME environment variables.'
      );
    }
  };
}

// Création table + colonne net_amount si absentes
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS donations (
      id SERIAL PRIMARY KEY,
      pseudo VARCHAR(50) NOT NULL,
      amount NUMERIC(10,2) NOT NULL,      -- montant brut
      net_amount NUMERIC(10,2),           -- montant net (après frais)
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='donations' AND column_name='net_amount'
      ) THEN
        ALTER TABLE donations ADD COLUMN net_amount NUMERIC(10,2);
      END IF;
    END$$;
  `);
}

module.exports = { pool, initDB, configSummary };
