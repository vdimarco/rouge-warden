// Public, guest-submitted scores. This function uses the table's anonymous RLS
// permissions, never a service-role key. Bounded submissions are not a replay
// attestation: display names and scores are supplied by the player.
const { randomUUID } = require('node:crypto');

const TABLE = 'river_rush_scores';
const COLUMNS = 'id,name,score,coins,levels_cleared,level_index,distance,created_at';
const ORDER = 'score.desc,levels_cleared.desc,distance.desc,created_at.asc,id.asc';
const MAX_BODY_BYTES = 4096;
const STORAGE_TIMEOUT_MS = 6000;
const NAME = /^[\p{L}\p{N} _.'-]+$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELDS = new Set(['name', 'score', 'coins', 'levelsCleared', 'levelIndex', 'distance', 'runId']);

function validate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !FIELDS.has(key))) return null;
  if (typeof body.name !== 'string') return null;
  const name = body.name.normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (![...name].length || [...name].length > 20 || !NAME.test(name)) return null;
  const limits = { score: [1, 1000000], coins: [0, 5000], levelsCleared: [0, 3], levelIndex: [0, 2], distance: [0, 16200] };
  for (const [key, [min, max]] of Object.entries(limits)) {
    const value = body[key];
    if (!Number.isInteger(value) || value < min || value > max) return null;
  }
  if (body.levelsCleared > body.levelIndex + 1 || (body.runId !== undefined && (typeof body.runId !== 'string' || !UUID.test(body.runId)))) return null;
  return {
    name, score: body.score, coins: body.coins,
    levels_cleared: body.levelsCleared, level_index: body.levelIndex,
    distance: body.distance, run_id: body.runId?.toLowerCase() || randomUUID(),
  };
}

function configuration() {
  const key = process.env.RIVER_RUSH_SUPABASE_KEY;
  let base;
  try { base = new URL(process.env.RIVER_RUSH_SUPABASE_URL); } catch { return null; }
  if (base.protocol !== 'https:' || base.username || base.password || !key) return null;
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('sb_publishable_')) {
    // A modern publishable key is not a JWT; send it as apikey only.
  } else {
    let claims;
    try { claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()); } catch { return null; }
    if (claims.role !== 'anon') return null;
    headers.Authorization = `Bearer ${key}`;
  }
  return { base: `${base.origin}/rest/v1/${TABLE}`, headers, deadline: Date.now() + STORAGE_TIMEOUT_MS };
}

async function storage(config, query, options = {}) {
  const remaining = config.deadline - Date.now();
  if (remaining <= 0) throw new Error('storage deadline exceeded');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), remaining);
  try {
    const response = await fetch(`${config.base}?${new URLSearchParams(query)}`, {
      ...options, headers: { ...config.headers, ...options.headers }, signal: controller.signal,
    });
    if (!response.ok) throw new Error('storage unavailable');
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('unexpected storage response');
    return rows;
  } finally {
    clearTimeout(timer);
  }
}

function entry(row, rank) {
  const submitted = validate({
    name: row?.name, score: row?.score, coins: row?.coins,
    levelsCleared: row?.levels_cleared, levelIndex: row?.level_index,
    distance: row?.distance,
  });
  const date = typeof row?.created_at === 'string' ? Date.parse(row.created_at) : NaN;
  if (!submitted || !Number.isFinite(date)) throw new Error('unexpected score row');
  return {
    ...(rank ? { rank } : {}), name: submitted.name, score: submitted.score, coins: submitted.coins,
    levelsCleared: submitted.levels_cleared, levelIndex: submitted.level_index,
    distance: submitted.distance, createdAt: new Date(date).toISOString(),
  };
}

async function posted(config, row, duplicate = false) {
  const result = { entry: entry(row), submitted: true, ...(duplicate ? { duplicate: true } : {}) };
  // Once the insert is accepted, a failed ranking refresh must still report a
  // saved score. The client can retry reading without accidentally posting twice.
  try {
    const rows = await storage(config, { select: COLUMNS, order: ORDER, limit: '20' });
    if (rows.length > 20) throw new Error('unexpected score count');
    result.entries = rows.map((score, index) => entry(score, index + 1));
    const index = row.id ? rows.findIndex(score => score.id === row.id) : -1;
    if (index >= 0) result.entry.rank = index + 1;
  } catch { /* A successful submission remains successful. */ }
  return result;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    res.status(405).json({ error: 'Use GET to view scores or POST to submit a score.' }); return;
  }

  let submission;
  if (req.method === 'POST') {
    let body = req.body;
    try {
      if (Number(req.headers?.['content-length']) > MAX_BODY_BYTES) throw new Error('oversized');
      if (Buffer.isBuffer(body)) body = body.toString('utf8');
      if (typeof body === 'string') {
        if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw new Error('oversized');
        body = JSON.parse(body);
      } else if (Buffer.byteLength(JSON.stringify(body) || '') > MAX_BODY_BYTES) throw new Error('oversized');
      submission = validate(body);
    } catch { submission = null; }
    if (!submission) {
      res.status(400).json({ error: 'Enter a name of 1–20 letters or numbers and valid completed score statistics.' }); return;
    }
  }

  const config = configuration();
  if (!config) { res.status(503).json({ error: 'The public leaderboard is temporarily unavailable. Please try again.' }); return; }
  try {
    if (req.method === 'GET') {
      const rows = await storage(config, { select: COLUMNS, order: ORDER, limit: '20' });
      if (rows.length > 20) throw new Error('unexpected score count');
      res.status(200).json({ entries: rows.map((row, index) => entry(row, index + 1)) }); return;
    }
    const rows = await storage(config, { on_conflict: 'run_id', select: COLUMNS }, {
      method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify(submission),
    });
    if (rows.length > 1) throw new Error('unexpected score count');
    if (rows.length === 1) { res.status(201).json(await posted(config, rows[0])); return; }
    // A retry cannot edit a previously recorded run. Confirm that it really is
    // the same submission before treating a duplicate UUID as successful.
    const previous = await storage(config, { select: COLUMNS, run_id: `eq.${submission.run_id}`, limit: '1' });
    if (previous.length !== 1) throw new Error('missing duplicate run');
    for (const key of ['name', 'score', 'coins', 'levels_cleared', 'level_index', 'distance']) {
      if (previous[0][key] !== submission[key]) {
        res.status(409).json({ error: 'This run has already been submitted with different score details.' }); return;
      }
    }
    res.status(200).json(await posted(config, previous[0], true));
  } catch {
    res.status(503).json({ error: 'The public leaderboard could not be reached. Please try again.' });
  }
};
