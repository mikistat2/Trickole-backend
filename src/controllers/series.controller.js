const tmdb = require('../services/tmdb.service');

async function getPopular(req, res) {
  try {
    const { page = 1 } = req.query;
    const data = await tmdb.get('/tv/popular', { page });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function search(req, res) {
  try {
    const { q, page = 1 } = req.query;
    if (!q) return res.status(400).json({ error: 'Query required' });
    const data = await tmdb.get('/search/tv', { query: q, page });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getByGenre(req, res) {
  try {
    const { genreId, page = 1 } = req.query;
    const data = await tmdb.get('/discover/tv', {
      with_genres: genreId,
      sort_by: 'popularity.desc',
      page,
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getDetail(req, res) {
  try {
    const { id } = req.params;
    const data = await tmdb.get(`/tv/${id}`, {
      append_to_response: 'credits,videos',
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getTrending(req, res) {
  try {
    const data = await tmdb.get('/trending/tv/week');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /series/:id/season/:seasonNumber
 * Returns TMDB season detail (episodes list, air dates, etc.)
 */
async function getSeasonDetail(req, res) {
  try {
    const { id, seasonNumber } = req.params;
    const data = await tmdb.get(`/tv/${id}/season/${seasonNumber}`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getPopular, search, getByGenre, getDetail, getTrending, getSeasonDetail };
