const { pool } = require('../config/database');

async function getSetting(req, res) {
  try {
    const { key } = req.params;
    const { rows } = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    res.json({ value: rows[0].value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateSetting(req, res) {
  try {
    const { key } = req.params;
    const { value } = req.body;
    if (typeof value !== 'string') {
      return res.status(400).json({ error: 'Value must be a string' });
    }
    
    await pool.query(
      `INSERT INTO settings (key, value, updated_at) 
       VALUES ($1, $2, NOW()) 
       ON CONFLICT (key) DO UPDATE 
       SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, value]
    );
    
    res.json({ success: true, key, value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getSetting, updateSetting };
