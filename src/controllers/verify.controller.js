const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const { pool } = require('../config/database');
const tmdb = require('../services/tmdb.service');

function getGeminiKey() {
  return process.env.GEMINI_API_KEY
    || process.env.GOOGLE_AI_API_KEY
    || process.env.GOOGLE_GENERATIVE_AI_API_KEY
    || '';
}

function extractJson(text) {
  const raw = String(text || '').trim();
  try {
    return JSON.parse(raw);
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) return JSON.parse(fenced[1]);
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw new Error('AI returned invalid quiz format');
  }
}

function buildFallbackQuestions(movie, requestedTitle) {
  const title = movie.title || requestedTitle || 'this movie';
  const runtime = Number(movie.runtime || 0);
  const runtimeBucket = runtime >= 140 ? '140+ minutes' : runtime >= 110 ? '110-139 minutes' : runtime >= 90 ? '90-109 minutes' : 'under 90 minutes';
  const genres = Array.isArray(movie.genres) ? movie.genres.map(g => g.name).filter(Boolean) : [];
  const primaryGenre = genres[0] || 'Drama';
  const overview = String(movie.overview || '').replace(/\s+/g, ' ').trim();
  const overviewHint = overview
    ? overview.split(/(?<=[.!?])\s+/).slice(0, 3).join(' ')
    : `A ${primaryGenre.toLowerCase()} story with a runtime of about ${runtimeBucket}.`;

  return [
    {
      question: `Which situation best describes the setup of "${title}"?`,
      options: [overviewHint, 'A documentary about filmmaking', 'A concert film with no plot', 'A behind-the-scenes interview special'],
      correct: 0,
    },
    {
      question: `What kind of conflict drives "${title}"?`,
      options: [
        `A ${primaryGenre.toLowerCase()} conflict tied to the story shown in the plot`,
        'A cooking competition with judges',
        'A sports documentary recap',
        'A travel guide with no real conflict',
      ],
      correct: 0,
    },
    {
      question: `Which option best matches the tone or style of "${title}"?`,
      options: [
        `A ${primaryGenre.toLowerCase()} film that runs about ${runtimeBucket}`,
        'A silent black-and-white short film',
        'A live concert performance',
        'A one-scene experimental clip',
      ],
      correct: 0,
    },
    {
      question: `What best describes the main journey in "${title}"?`,
      options: [
        'The characters move through the central story problem shown in the plot',
        'A random collection of unrelated scenes',
        'Only a narrated history lesson',
        'A complete remake of a different movie',
      ],
      correct: 0,
    },
    {
      question: `What should someone remember most about "${title}" after watching it?`,
      options: [
        'The major story beats and how the plot resolves',
        'The movie poster colors only',
        'The streaming platform it was watched on',
        'The opening credits font style',
      ],
      correct: 0,
    },
  ];
}

async function generateQuestionsWithGemini(movie) {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured on backend');

  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const title = movie.title || 'this movie';
  const year = movie.release_date ? String(movie.release_date).slice(0, 4) : '';
  const overview = String(movie.overview || '').trim();
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Generate exactly 5 multiple-choice questions to verify that someone actually watched the movie "${title}" (${year || 'unknown year'}).\n\nMovie overview:\n${overview || 'No overview available.'}\n\nRules:\n- Every question must be about the plot itself: events, twists, story setup, character choices, major scenes, or how the story resolves\n- Do NOT ask about actors, cast, directors, runtime, release year, awards, or production details\n- Each question must have 4 answer options, with exactly one correct answer\n- Make the questions specific enough that someone who only skimmed a summary will struggle\n- Return ONLY valid JSON, no markdown fences, no explanation\n\nJSON format:\n{\n  "questions": [\n    {\n      "question": "...",\n      "options": ["A", "B", "C", "D"],\n      "correct": 0\n    }\n  ]\n}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `Gemini ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const text = payload?.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
  const parsed = extractJson(text);
  return Array.isArray(parsed?.questions) ? parsed.questions : [];
}

// Generate quiz questions for a movie
async function generateQuiz(req, res) {
  const { tmdb_id, title, year } = req.body;
  if (!tmdb_id || !title) return res.status(400).json({ error: 'tmdb_id and title required' });

  try {
    let questions = [];
    let source = 'gemini';
    const movie = await tmdb.get(`/movie/${tmdb_id}`, { append_to_response: 'credits' });

    try {
      questions = await generateQuestionsWithGemini(movie);
    } catch (aiErr) {
      questions = buildFallbackQuestions(movie, title);
      source = 'fallback';
      console.warn('Gemini quiz fallback used:', aiErr.message);
    }

    if (!questions.length) {
      return res.status(500).json({ error: 'Unable to generate quiz questions at this time.' });
    }

    // Store quiz session temporarily (5 min TTL via expires_at)
    const result = await pool.query(
      `INSERT INTO quiz_attempts (user_id, tmdb_id, questions, answers, score, passed)
       VALUES ($1, $2, $3, '[]', 0, false)
       RETURNING id`,
      [req.user.id, tmdb_id, JSON.stringify(questions)]
    );

    res.json({ source, quiz_id: result.rows[0].id, questions: questions.map((q, i) => ({
      index: i,
      question: q.question,
      options: q.options,
      // correct index is NOT sent to client
    }))});
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to generate quiz' });
  }
}

// Grade submitted answers
async function submitAnswers(req, res) {
  const { quiz_id, answers, tmdb_id, title, poster_path, runtime_min, room_id, season_number, media_type } = req.body;
  if (!quiz_id || !answers) return res.status(400).json({ error: 'quiz_id and answers required' });

  try {
    // Load the quiz
    const quizResult = await pool.query(
      'SELECT * FROM quiz_attempts WHERE id=$1 AND user_id=$2',
      [quiz_id, req.user.id]
    );
    if (!quizResult.rows.length) return res.status(404).json({ error: 'Quiz not found' });

    const quiz = quizResult.rows[0];
    const questions = quiz.questions;
    const effectiveTmdbId = tmdb_id || quiz.tmdb_id;

    if (!effectiveTmdbId) {
      return res.status(400).json({ error: 'tmdb_id is required to verify a watch' });
    }

    // Grade
    let correct = 0;
    answers.forEach((ans, i) => {
      if (questions[i] && ans === questions[i].correct) correct++;
    });

    const score = Math.round((correct / questions.length) * 100);
    const passed = correct >= Math.ceil(questions.length / 2);

    // Update quiz attempt record
    await pool.query(
      'UPDATE quiz_attempts SET answers=$1, score=$2, passed=$3 WHERE id=$4',
      [JSON.stringify(answers), score, passed, quiz_id]
    );

    // Ensure we have a runtime (minutes) from TMDB if not provided
    let runtimeToUse = runtime_min;
    if (!runtimeToUse) {
      try {
        const movieDetail = await tmdb.get(`/movie/${effectiveTmdbId}`);
        runtimeToUse = Number(movieDetail.runtime || 0);
      } catch (mErr) {
        try {
          const tvDetail = await tmdb.get(`/tv/${effectiveTmdbId}`);
          const epRun = Array.isArray(tvDetail.episode_run_time) && tvDetail.episode_run_time.length ? tvDetail.episode_run_time[0] : 0;
          runtimeToUse = Number(epRun || 0);
        } catch (tvErr) {
          runtimeToUse = 0;
        }
      }
    }

    // Update watchlist status and attach runtime if not set
    const sn = season_number != null ? season_number : null;
    await pool.query(
      `UPDATE watchlist SET status=$1, runtime_min = COALESCE(runtime_min, $4)
       WHERE user_id=$2 AND tmdb_id=$3 AND COALESCE(season_number, -1) = COALESCE($5, -1)`,
      [passed ? 'verified' : 'failed', req.user.id, effectiveTmdbId, runtimeToUse, sn]
    );

    // Record verified watch with runtime minutes
    const effectiveMediaType = media_type || 'movie';
    if (passed) {
      await pool.query(
        `INSERT INTO verified_watches (user_id, tmdb_id, title, poster_path, runtime_min, score, room_id, media_type, season_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (user_id, tmdb_id, COALESCE(season_number, -1))
         DO UPDATE SET score=$6, runtime_min=EXCLUDED.runtime_min, verified_at=NOW()`,
        [req.user.id, effectiveTmdbId, title, poster_path, runtimeToUse, score, room_id || null, effectiveMediaType, sn]
      );
    }

    // Debug log to help diagnose missing runtime issues
    console.log(`[verify] user=${req.user.id} tmdb=${effectiveTmdbId} passed=${passed} score=${score} runtime_min=${runtimeToUse}`);

    res.json({ passed, score, correct, total: questions.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { generateQuiz, submitAnswers };
