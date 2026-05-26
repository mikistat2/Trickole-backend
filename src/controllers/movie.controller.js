const tmdb = require('../services/tmdb.service');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

function getGeminiKey() {
  return process.env.GEMINI_API_KEY
    || process.env.GOOGLE_AI_API_KEY
    || process.env.GOOGLE_GENERATIVE_AI_API_KEY
    || '';
}

async function getPopular(req, res) {
  try {
    const { page = 1 } = req.query;
    const data = await tmdb.get('/movie/popular', { page });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function search(req, res) {
  try {
    const { q, page = 1 } = req.query;
    if (!q) return res.status(400).json({ error: 'Query required' });
    const data = await tmdb.get('/search/movie', { query: q, page });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getByGenre(req, res) {
  try {
    const { genreId, page = 1 } = req.query;
    const data = await tmdb.get('/discover/movie', {
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
    const data = await tmdb.get(`/movie/${id}`, {
      append_to_response: 'credits,videos',
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getTrending(req, res) {
  try {
    const data = await tmdb.get('/trending/movie/week');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function recommend(req, res) {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    const apiKey = getGeminiKey();
    if (!apiKey) return res.status(500).json({ error: 'AI API key not configured' });

    const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `You are a movie recommendation engine. Based on this request: "${prompt}", recommend exactly 3 movies.

CRITICAL: Your response must be ONLY valid JSON, nothing else. No explanation, no introduction, no markdown.

Return a JSON array with exactly 3 objects. Each object must have "title" (string) and "year" (string) keys.

Example format:
[
  {"title": "The Matrix", "year": "1999"},
  {"title": "Inception", "year": "2010"},
  {"title": "Interstellar", "year": "2014"}
]

Start your response with [ and end with ]. No other text.`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING' },
              year: { type: 'STRING' }
            },
            required: ['title', 'year']
          }
        }
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error?.message || `Gemini ${response.status}`);
    }

    const text = payload?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
    let movieRequests = [];
    try {
      const raw = String(text || '').trim();
      if (!raw) {
        throw new Error('Empty response from AI');
      }
      
      // Try to extract JSON array from response
      const start = raw.indexOf('[');
      const end = raw.lastIndexOf(']');
      
      if (start !== -1 && end > start) {
        const jsonStr = raw.slice(start, end + 1);
        movieRequests = JSON.parse(jsonStr);
      } else {
        movieRequests = JSON.parse(raw);
      }
      
      // Validate that we got an array
      if (!Array.isArray(movieRequests)) {
        throw new Error('AI response is not an array');
      }
      
      // Validate each item has required fields
      movieRequests = movieRequests.filter(item => item.title && item.title.trim());
      if (movieRequests.length === 0) {
        throw new Error('No valid movies in AI response');
      }
    } catch(e) {
      console.error('Parse error:', e.message, 'Response text:', text);
      throw new Error(`Failed to parse AI response: ${e.message}`);
    }

    const results = [];
    for (const item of movieRequests) {
      const data = await tmdb.get('/search/movie', { query: item.title, primary_release_year: item.year });
      if (data.results && data.results.length > 0) {
        results.push(data.results[0]);
      } else {
        const fallback = await tmdb.get('/search/movie', { query: item.title });
        if (fallback.results && fallback.results.length > 0) {
          results.push(fallback.results[0]);
        }
      }
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getPopular, search, getByGenre, getDetail, getTrending, recommend };
