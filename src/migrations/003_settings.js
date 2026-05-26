require('dotenv').config();
const { pool } = require('../config/database');

async function up() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(50) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    // Insert default leaderboard message if not exists
    await client.query(`
      INSERT INTO settings (key, value)
      VALUES ('leaderboard_message', 'Until Dec 20 1st place will win a total of 2000 birr!')
      ON CONFLICT (key) DO NOTHING
    `);
    
    console.log('Migration 003: settings table created');
  } finally {
    client.release();
  }
}

up().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
