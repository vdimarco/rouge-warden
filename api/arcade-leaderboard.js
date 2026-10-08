// Fixed aggregate query only. Never expose the private key or raw visitor events.
const QUERY = `SELECT properties.game_id AS game_id,
  uniqExactIf(properties.session_id, event = 'arcade_game_view') AS views,
  uniqExactIf(properties.session_id, event = 'arcade_game_play') AS plays,
  uniqExactIf(distinct_id, event = 'arcade_game_like') AS likes,
  sumIf(toFloat(ifNull(properties.active_seconds, 0)), event = 'arcade_active_time') AS active_seconds
FROM events
WHERE timestamp >= now() - INTERVAL 30 DAY
  AND properties.app = 'cottage_arcade' AND properties.environment = 'production'
  AND event IN ('arcade_game_view', 'arcade_game_play', 'arcade_game_like', 'arcade_active_time')
GROUP BY game_id LIMIT 100`;
let cached = null, pending = null;
const TTL = 5 * 60 * 1000;
async function load(key, project) {
  const response = await fetch(`https://us.posthog.com/api/projects/${project}/query/`, {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query: QUERY } }), signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('analytics unavailable');
  const data = await response.json();
  if (!Array.isArray(data.results) || data.results.length > 100 || data.error || data.hasMore) throw new Error('unexpected analytics response');
  const games = {};
  for (const row of data.results) {
    if (!Array.isArray(row) || row.length !== 5 || !/^[a-z0-9-]{1,40}$/.test(row[0]) || row.slice(1).some(n => (typeof n !== 'number' && (typeof n !== 'string' || !/^\d+(\.\d+)?$/.test(n))) || !Number.isFinite(Number(n)) || Number(n) < 0 || Number(n) > Number.MAX_SAFE_INTEGER)) throw new Error('unexpected analytics row');
    games[row[0]] = { views: Math.floor(Number(row[1])), plays: Math.floor(Number(row[2])), likes: Math.floor(Number(row[3])), active_seconds: Math.round(Number(row[4])) };
  }
  return { source: 'posthog', days: 30, updatedAt: new Date().toISOString(), games };
}
async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Use GET.' }); }
  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  const project = process.env.POSTHOG_PROJECT_ID || '500056';
  if (!key || !/^\d+$/.test(project)) return res.status(503).json({ error: 'Analytics are not connected yet.' });
  try {
    if (!cached || Date.now() - cached.at >= TTL) {
      if (!pending) pending = load(key, project).then(data => { cached = { at: Date.now(), data }; }).finally(() => { pending = null; });
      await pending;
    }
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
    return res.status(200).json(cached.data);
  } catch { return res.status(503).json({ error: 'Analytics are temporarily unavailable.' }); }
}
module.exports = handler;
module.exports.QUERY = QUERY;
