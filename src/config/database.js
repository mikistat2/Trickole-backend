const { Pool } = require('pg');

function normalizeDatabaseUrl(rawUrl = '') {
  const trimmed = String(rawUrl).trim();
  if (!trimmed) return '';

  // Handle accidental shell wrapper format: psql 'postgresql://...'
  const match = trimmed.match(/^psql\s+['\"](.+?)['\"]$/i);
  const extracted = match ? match[1] : trimmed;                     

  try {
    const parsed = new URL(extracted);
    const sslmode = parsed.searchParams.get('sslmode');
    const hasCompat = parsed.searchParams.has('uselibpqcompat');

    if (
      !hasCompat &&
      sslmode &&
      ['prefer', 'require', 'verify-ca'].includes(sslmode)
    ) {
      parsed.searchParams.set('uselibpqcompat', 'true');
      return parsed.toString();
    }

    return extracted;
  } catch {
    return extracted;
  }
}

const pool = new Pool({
  connectionString: normalizeDatabaseUrl(process.env.DATABASE_URL),
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
});

// Catch idle client errors (e.g. from Neon serverless dropping connections)
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

async function connectDB() {
  try {
    const client = await pool.connect();
    console.log('PostgreSQL connected');
    client.release();
  } catch (err) {
    console.error('PostgreSQL connection error:', err.message);
    process.exit(1);
  }
}

module.exports = { pool, connectDB };
