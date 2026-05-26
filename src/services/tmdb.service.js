const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const BASE = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const KEY  = process.env.TMDB_API_KEY;

async function get(path, params = {}) {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set('api_key', KEY);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${await res.text()}`);
  return res.json();
}

module.exports = { get };
