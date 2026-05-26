const { pool } = require('../config/database');

const migrations = [
  // ─── Users ───────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username    VARCHAR(30)  UNIQUE NOT NULL,
    email       VARCHAR(255) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,
    avatar_url  TEXT,
    created_at  TIMESTAMPTZ  DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  DEFAULT NOW()
  )`,

  // ─── Competition rooms ───────────────────────────────────
  `CREATE TABLE IF NOT EXISTS rooms (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(100) NOT NULL,
    invite_code  VARCHAR(8)   UNIQUE NOT NULL,
    owner_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    starts_at    TIMESTAMPTZ  NOT NULL,
    ends_at      TIMESTAMPTZ  NOT NULL,
    created_at   TIMESTAMPTZ  DEFAULT NOW()
  )`,

  // ─── Room members ────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS room_members (
    room_id    UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (room_id, user_id)
  )`,

  // ─── Watchlist entries ───────────────────────────────────
  `CREATE TABLE IF NOT EXISTS watchlist (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tmdb_id       INTEGER      NOT NULL,
    title         VARCHAR(255) NOT NULL,
    poster_path   TEXT,
    release_year  SMALLINT,
    runtime_min   SMALLINT,
    genres        TEXT[],
    status        VARCHAR(20)  NOT NULL DEFAULT 'queued'
                    CHECK (status IN ('queued','watching','verified','failed')),
    queued_for    DATE         NOT NULL DEFAULT CURRENT_DATE,
    added_at      TIMESTAMPTZ  DEFAULT NOW(),
    UNIQUE (user_id, tmdb_id)
  )`,

  // ─── Verified watches ────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS verified_watches (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tmdb_id       INTEGER NOT NULL,
    title         VARCHAR(255) NOT NULL,
    poster_path   TEXT,
    runtime_min   SMALLINT,
    score         SMALLINT NOT NULL,
    verified_at   TIMESTAMPTZ DEFAULT NOW(),
    room_id       UUID REFERENCES rooms(id) ON DELETE SET NULL,
    UNIQUE (user_id, tmdb_id)
  )`,

  // ─── Quiz attempts ───────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS quiz_attempts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tmdb_id     INTEGER NOT NULL,
    questions   JSONB   NOT NULL,
    answers     JSONB   NOT NULL,
    score       SMALLINT NOT NULL,
    passed      BOOLEAN  NOT NULL,
    attempted_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ─── Indexes ─────────────────────────────────────────────
  `CREATE INDEX IF NOT EXISTS idx_watchlist_user_date ON watchlist(user_id, queued_for)`,
  `CREATE INDEX IF NOT EXISTS idx_verified_user ON verified_watches(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_verified_room ON verified_watches(room_id)`,
  `CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id)`,
];

async function runMigrations() {
  const client = await pool.connect();
  try {
    for (const sql of migrations) {
      await client.query(sql);
    }
    console.log('All migrations applied');
  } finally {
    client.release();
  }
}

runMigrations().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
