const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const movieRoutes = require('./routes/movie.routes');
const seriesRoutes = require('./routes/series.routes');
const watchlistRoutes = require('./routes/watchlist.routes');
const leaderboardRoutes = require('./routes/leaderboard.routes');
const roomRoutes = require('./routes/room.routes');
const verifyRoutes = require('./routes/verify.routes');
const userRoutes = require('./routes/user.routes');
const debugRoutes = require('./routes/debug.routes');
const settingsRoutes = require('./routes/settings.routes');

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://cinemarace.app',
  'https://trikole.vercel.app',
  /https:\/\/.*\.vercel\.app$/,
  /capacitor:\/\/.*/,
  'http://localhost',
  'https://localhost',
].filter(Boolean);

// ─── Security ──────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? allowedOrigins
    : ['http://localhost:5173', 'http://localhost:3000', /capacitor:\/\/.*/],
  credentials: true,
}));

// ─── Rate limiting ─────────────────────────────────────────
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));
app.use('/api/verify', rateLimit({ windowMs: 60 * 1000, max: 10 }));
app.use('/api/movies/recommend', rateLimit({ windowMs: 60 * 1000, max: 10 }));

// ─── Body parsing ──────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/series', seriesRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/debug', debugRoutes);
app.use('/api/settings', settingsRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: new Date() }));

// ─── Error handler ─────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
