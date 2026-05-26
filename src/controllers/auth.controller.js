const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { pool } = require('../config/database');
const { validationResult } = require('express-validator');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

async function register(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { username, email, password } = req.body;
  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE email=$1 OR username=$2', [email, username]
    );
    if (existing.rows.length) {
      return res.status(409).json({ error: 'Email or username already taken' });
    }
    const hashed = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (username, email, password)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, avatar_url, created_at`,
      [username, email, hashed]
    );
    const user = result.rows[0];
    res.status(201).json({ token: signToken(user), user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function login(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const { password: _, ...safeUser } = user;
    res.json({ token: signToken(safeUser), user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getMe(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, username, email, avatar_url, created_at FROM users WHERE id=$1',
      [req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function googleLogin(req, res) {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Google credential is required' });

  try {
    let email, name, picture, googleId;

    if (credential.length > 500) {
      // Verify the ID token with Google
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      email = payload.email;
      name = payload.name;
      picture = payload.picture;
      googleId = payload.sub;
    } else {
      // Verify the access token
      const tokenInfo = await googleClient.getTokenInfo(credential);
      if (tokenInfo.aud !== process.env.GOOGLE_CLIENT_ID) {
        throw new Error('Invalid audience');
      }

      // Fetch user profile
      const { default: fetch } = await import('node-fetch');
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${credential}` }
      });
      const userInfo = await userInfoRes.json();
      
      if (userInfo.error) throw new Error(userInfo.error.message || 'Invalid token');

      email = userInfo.email;
      name = userInfo.name;
      picture = userInfo.picture;
      googleId = userInfo.sub;
    }

    // Upsert: find existing user by email or google_id, or create new one
    let result = await pool.query(
      'SELECT id, username, email, avatar_url, created_at FROM users WHERE email=$1',
      [email]
    );

    let user;
    if (result.rows.length) {
      // Existing user — update google_id & avatar if not set
      user = result.rows[0];
      await pool.query(
        `UPDATE users SET google_id=COALESCE(google_id,$1), avatar_url=COALESCE(NULLIF(avatar_url,''),$2) WHERE id=$3`,
        [googleId, picture, user.id]
      );
    } else {
      // New user — generate a unique username from their name
      const baseUsername = (name || email.split('@')[0])
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 25);
      let username = baseUsername;
      let suffix = 1;
      while (true) {
        const taken = await pool.query('SELECT id FROM users WHERE username=$1', [username]);
        if (!taken.rows.length) break;
        username = `${baseUsername}${suffix++}`;
      }

      result = await pool.query(
        `INSERT INTO users (username, email, avatar_url, google_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, username, email, avatar_url, created_at`,
        [username, email, picture, googleId]
      );
      user = result.rows[0];
    }

    res.json({ token: signToken(user), user });
  } catch (err) {
    console.error('Google auth error:', err.message);
    res.status(401).json({ error: 'Invalid Google credential' });
  }
}

module.exports = { register, login, getMe, googleLogin };
