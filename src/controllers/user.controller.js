const { pool } = require('../config/database');

async function getProfile(req, res) {
  const { username } = req.params;
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.avatar_url, u.created_at,
              COUNT(vw.id)::int AS total_watched
       FROM users u
       LEFT JOIN verified_watches vw ON vw.user_id = u.id
       WHERE u.username = $1
       GROUP BY u.id, u.username, u.avatar_url, u.created_at`,
      [username]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getWatchHistory(req, res) {
  try {
    const result = await pool.query(
      `SELECT tmdb_id, title, poster_path, runtime_min, score, verified_at
       FROM verified_watches
       WHERE user_id = $1
       ORDER BY verified_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getProfile, getWatchHistory };
