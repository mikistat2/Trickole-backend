const { pool } = require('../config/database');
const { generateInviteCode } = require('../utils/helpers');

async function createRoom(req, res) {
  const { name, starts_at, ends_at } = req.body;
  if (!name || !starts_at || !ends_at) {
    return res.status(400).json({ error: 'name, starts_at, ends_at required' });
  }
  try {
    const code = generateInviteCode();
    const result = await pool.query(
      `INSERT INTO rooms (name, invite_code, owner_id, starts_at, ends_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, code, req.user.id, starts_at, ends_at]
    );
    const room = result.rows[0];
    // Owner auto-joins
    await pool.query(
      'INSERT INTO room_members (room_id, user_id) VALUES ($1, $2)',
      [room.id, req.user.id]
    );
    res.status(201).json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function joinRoom(req, res) {
  const { invite_code } = req.body;
  if (!invite_code) return res.status(400).json({ error: 'invite_code required' });
  try {
    const roomResult = await pool.query(
      'SELECT * FROM rooms WHERE invite_code=$1', [invite_code.toUpperCase()]
    );
    if (!roomResult.rows.length) return res.status(404).json({ error: 'Room not found' });
    const room = roomResult.rows[0];

    await pool.query(
      'INSERT INTO room_members (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [room.id, req.user.id]
    );
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getMyRooms(req, res) {
  try {
    const result = await pool.query(
      `SELECT r.*, COUNT(rm2.user_id)::int AS member_count
       FROM rooms r
       JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = $1
       JOIN room_members rm2 ON rm2.room_id = r.id
       GROUP BY r.id
       ORDER BY r.ends_at ASC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getRoomDetail(req, res) {
  const { id } = req.params;
  try {
    const member = await pool.query(
      'SELECT 1 FROM room_members WHERE room_id=$1 AND user_id=$2',
      [id, req.user.id]
    );
    if (!member.rows.length) return res.status(403).json({ error: 'Not a member' });

    const result = await pool.query('SELECT * FROM rooms WHERE id=$1', [id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function leaveRoom(req, res) {
  const { id } = req.params;
  try {
    await pool.query(
      'DELETE FROM room_members WHERE room_id=$1 AND user_id=$2',
      [id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { createRoom, joinRoom, getMyRooms, getRoomDetail, leaveRoom };
