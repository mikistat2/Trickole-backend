// Migration 004 — Google Auth support
// - Makes `password` nullable (Google-only users have no password)
// - Adds `google_id` column (unique, nullable) for OAuth linking

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const { pool } = require('../config/database');

async function up() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE users
        ALTER COLUMN password DROP NOT NULL
    `);
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE
    `);
    console.log('Migration 004 applied: google_id column added, password made nullable');
  } catch (err) {
    // Column may already exist on re-runs — log but don't crash
    if (err.code === '42701') {
      console.log('Migration 004: google_id column already exists, skipping');
    } else {
      throw err;
    }
  } finally {
    client.release();
  }
}

up().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
