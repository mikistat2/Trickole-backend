const { pool } = require('../config/database');

// Global leaderboard
async function getGlobal(req, res) {
  try {
    const result = await pool.query(
      `SELECT
         u.id, u.username, u.avatar_url,
         COUNT(vw.id)::int            AS total_watched,
         COALESCE(SUM(vw.runtime_min), 0)::int AS total_minutes,
         MAX(vw.verified_at)          AS last_verified
       FROM users u
       LEFT JOIN verified_watches vw ON vw.user_id = u.id
       GROUP BY u.id, u.username, u.avatar_url
       ORDER BY total_watched DESC, total_minutes DESC
       LIMIT 50`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Room-scoped leaderboard
async function getRoomLeaderboard(req, res) {
  const { roomId } = req.params;
  try {
    // Check user is member
    const member = await pool.query(
      'SELECT 1 FROM room_members WHERE room_id=$1 AND user_id=$2',
      [roomId, req.user.id]
    );
    if (!member.rows.length) return res.status(403).json({ error: 'Not a member of this room' });

    const result = await pool.query(
      `SELECT
         u.id, u.username, u.avatar_url,
         COUNT(vw.id)::int              AS total_watched,
         COALESCE(SUM(vw.runtime_min), 0)::int AS total_minutes,
         MAX(vw.verified_at)            AS last_verified,
         -- daily counts for streak calc
         json_agg(DISTINCT DATE(vw.verified_at)) FILTER (WHERE vw.id IS NOT NULL) AS watch_dates
       FROM room_members rm
       JOIN users u ON u.id = rm.user_id
       LEFT JOIN verified_watches vw ON vw.user_id = rm.user_id AND vw.room_id = $1
       WHERE rm.room_id = $1
       GROUP BY u.id, u.username, u.avatar_url
       ORDER BY total_watched DESC, total_minutes DESC`,
      [roomId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// User's own stats
async function getMyStats(req, res) {
  try {
    const [total, daily, genres] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total, COALESCE(SUM(runtime_min),0)::int AS minutes
         FROM verified_watches WHERE user_id=$1`,
        [req.user.id]
      ),
      pool.query(
        `SELECT DATE(verified_at) AS day, COUNT(*)::int AS count
         FROM verified_watches WHERE user_id=$1
         GROUP BY day ORDER BY day DESC LIMIT 30`,
        [req.user.id]
      ),
      pool.query(
        `SELECT unnest(w.genres) AS genre, COUNT(*)::int AS count
         FROM verified_watches vw
         JOIN watchlist w ON w.tmdb_id = vw.tmdb_id AND w.user_id = vw.user_id
         WHERE vw.user_id=$1
         GROUP BY genre ORDER BY count DESC LIMIT 5`,
        [req.user.id]
      ),
    ]);

    res.json({
      total_watched: total.rows[0].total,
      total_minutes: total.rows[0].minutes,
      daily: daily.rows,
      top_genres: genres.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getGlobal, getRoomLeaderboard, getMyStats };
