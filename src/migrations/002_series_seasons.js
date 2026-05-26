require('dotenv').config();
const { pool } = require('../config/database');

/**
 * Migration: Add series/season support to watchlist and verified_watches.
 *
 * - media_type: 'movie' | 'series'
 * - season_number: NULL for movies, season number for series entries
 * - Drops the old UNIQUE(user_id, tmdb_id) and replaces it with
 *   UNIQUE(user_id, tmdb_id, season_number) so the same series
 *   can appear multiple times (once per season).
 */
const migrations = [
  // ─── watchlist: add media_type and season_number ──────────
  `DO $$ BEGIN
     ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS media_type VARCHAR(10) NOT NULL DEFAULT 'movie';
   EXCEPTION WHEN duplicate_column THEN NULL;
   END $$`,

  `DO $$ BEGIN
     ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS season_number SMALLINT;
   EXCEPTION WHEN duplicate_column THEN NULL;
   END $$`,

  `DO $$ BEGIN
     ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS total_seasons SMALLINT;
   EXCEPTION WHEN duplicate_column THEN NULL;
   END $$`,

  // Drop old unique and create new composite unique
  `DO $$ BEGIN
     ALTER TABLE watchlist DROP CONSTRAINT IF EXISTS watchlist_user_id_tmdb_id_key;
   END $$`,

  `CREATE UNIQUE INDEX IF NOT EXISTS idx_watchlist_user_tmdb_season
     ON watchlist (user_id, tmdb_id, COALESCE(season_number, -1))`,

  // ─── verified_watches: add media_type and season_number ───
  `DO $$ BEGIN
     ALTER TABLE verified_watches ADD COLUMN IF NOT EXISTS media_type VARCHAR(10) NOT NULL DEFAULT 'movie';
   EXCEPTION WHEN duplicate_column THEN NULL;
   END $$`,

  `DO $$ BEGIN
     ALTER TABLE verified_watches ADD COLUMN IF NOT EXISTS season_number SMALLINT;
   EXCEPTION WHEN duplicate_column THEN NULL;
   END $$`,

  // Drop old unique and create new composite unique
  `DO $$ BEGIN
     ALTER TABLE verified_watches DROP CONSTRAINT IF EXISTS verified_watches_user_id_tmdb_id_key;
   END $$`,

  `CREATE UNIQUE INDEX IF NOT EXISTS idx_verified_user_tmdb_season
     ON verified_watches (user_id, tmdb_id, COALESCE(season_number, -1))`,
];

async function run() {
  const client = await pool.connect();
  try {
    for (const sql of migrations) {
      await client.query(sql);
    }
    console.log('Migration 002_series_seasons applied successfully');
  } finally {
    client.release();
  }
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
