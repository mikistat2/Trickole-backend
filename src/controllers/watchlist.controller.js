const { pool } = require('../config/database');

async function getWatchlist(req, res) {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const result = await pool.query(
      `SELECT w.*, vw.verified_at
       FROM watchlist w
       LEFT JOIN verified_watches vw
         ON vw.tmdb_id = w.tmdb_id
         AND vw.user_id = w.user_id
         AND COALESCE(vw.season_number, -1) = COALESCE(w.season_number, -1)
       WHERE w.user_id = $1 AND w.queued_for = $2
       ORDER BY w.added_at ASC`,
      [req.user.id, targetDate]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function addToWatchlist(req, res) {
  const {
    tmdb_id, title, poster_path, release_year, runtime_min, genres,
    media_type, season_number, total_seasons,
  } = req.body;

  if (!tmdb_id || !title) return res.status(400).json({ error: 'tmdb_id and title required' });

  const effectiveMediaType = media_type || 'movie';

  try {
    const result = await pool.query(
      `INSERT INTO watchlist
         (user_id, tmdb_id, title, poster_path, release_year, runtime_min, genres,
          media_type, season_number, total_seasons)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (user_id, tmdb_id, COALESCE(season_number, -1))
       DO UPDATE SET queued_for = CURRENT_DATE, status = 'queued'
       RETURNING *`,
      [
        req.user.id, tmdb_id, title, poster_path, release_year, runtime_min, genres,
        effectiveMediaType, season_number || null, total_seasons || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ['queued', 'watching'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    const result = await pool.query(
      `UPDATE watchlist SET status = $1
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [status, id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Entry not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function removeFromWatchlist(req, res) {
  const { id } = req.params;
  try {
    await pool.query(
      'DELETE FROM watchlist WHERE id=$1 AND user_id=$2',
      [id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getWatchlist, addToWatchlist, updateStatus, removeFromWatchlist };
