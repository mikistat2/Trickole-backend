const { pool } = require('../config/database');

async function myVerified(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, tmdb_id, title, poster_path, runtime_min, score, verified_at, room_id
       FROM verified_watches WHERE user_id=$1 ORDER BY verified_at DESC LIMIT 100`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { myVerified };