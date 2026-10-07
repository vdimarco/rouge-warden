import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { scoreCardData } from './ScoreCapture.jsx';
import './adventure-extras.css';

const API = '/api/river-rush-leaderboard';
const NAME = /^[\p{L}\p{N} _.'-]{1,20}$/u;
const normalizeName = value => value.normalize('NFC').trim().replace(/\s+/g, ' ');
const runIds = new WeakMap();
function runIdFor(game) {
  if (!game || typeof game !== 'object') return undefined;
  if (!runIds.has(game)) runIds.set(game, crypto.randomUUID());
  return runIds.get(game);
}

async function requestBoard(options = {}) {
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(API, { ...options, cache: 'no-store', signal: controller.signal });
    let data; try { data = await response.json(); } catch { throw new Error('Leaderboard temporarily unavailable.'); }
    if (!response.ok) throw new Error(response.status === 429 ? 'Too many scores at once. Please wait a minute and try again.' : data.error || 'Leaderboard temporarily unavailable.');
    if (!Array.isArray(data.entries) && !data.entry) throw new Error('Leaderboard temporarily unavailable.');
    return data;
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('Leaderboard temporarily unavailable.');
    throw error;
  } finally { clearTimeout(timeout); }
}

export default function Leaderboard({ game = null, canSubmit = false, compact = false, onClose }) {
  const [entries, setEntries] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [name, setName] = useState(''), [submitting, setSubmitting] = useState(false), [submitted, setSubmitted] = useState(false), [success, setSuccess] = useState('');
  const inputId = useId(), alive = useRef(true), loadId = useRef(0), score = scoreCardData(game ?? {});
  const load = useCallback(async () => {
    const id = ++loadId.current; setLoading(true); setError('');
    try {
      const board = await requestBoard();
      if (alive.current && id === loadId.current) setEntries(board.entries.slice(0, 10));
    } catch (cause) { if (alive.current && id === loadId.current) setError(cause.message); }
    finally { if (alive.current && id === loadId.current) setLoading(false); }
  }, []);
  useEffect(() => { alive.current = true; load(); return () => { alive.current = false; loadId.current++; }; }, [load]);
  useEffect(() => { setSubmitted(false); setSuccess(''); }, [game?.campaign?.score, game?.score, game?.phase, game?.level?.index]);
  const finished = !!game && (game.phase === 'won' || game.phase === 'lost');
  async function submit(event) {
    event.preventDefault(); if (submitting || submitted || !canSubmit || !finished || !score.score) return;
    const publicName = normalizeName(name);
    if (!NAME.test(publicName)) { setError('Use 1–20 letters or numbers. Spaces, underscores, periods, apostrophes and hyphens are welcome.'); return; }
    loadId.current++; setLoading(false); setSubmitting(true); setError('');
    // Names are sent only after the player chooses to publish this result.
    try {
      const board = await requestBoard({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: publicName, score: score.score, coins: score.coins, levelsCleared: score.levelsCleared, levelIndex: score.levelIndex, distance: score.distance, runId: runIdFor(game) }) });
      if (alive.current) {
        if (Array.isArray(board.entries)) setEntries(board.entries.slice(0, 10));
        setSubmitted(true); setLoading(false);
        const rank = board.entry?.rank ?? board.submitted?.rank;
        setSuccess(`Score posted for ${publicName}. ${rank ? `Rank #${rank}.` : 'Your adventure score is saved.'}`);
        if (!Array.isArray(board.entries)) load();
      }
    } catch (cause) { if (alive.current) setError(cause.message); }
    finally { if (alive.current) setSubmitting(false); }
  }
  return <section className={`river-leaderboard ${compact ? 'river-leaderboard-compact' : ''}`} aria-label="Public high score leaderboard">
    <header className="leaderboard-heading"><div><span className="leaderboard-kicker">RIVER LEGENDS</span><h2>High scores.</h2></div>{onClose && <button type="button" className="adventure-extra-button leaderboard-close" onClick={onClose} aria-label="Close leaderboard">×</button>}</header>
    <p className="leaderboard-intro">Three rivers. One public board. Everyone can join.</p>
    <div className="leaderboard-table-wrap" aria-busy={loading}>
      {loading && !entries.length ? <p className="leaderboard-empty" role="status">Finding the river legends…</p> : entries.length ? <table className="leaderboard-table"><caption className="adventure-sr-only">Top ten public River Rush adventure scores</caption><thead><tr><th scope="col">Rank</th><th scope="col">Rafter</th><th scope="col">Maps</th><th scope="col">Score</th></tr></thead><tbody>{entries.map((entry, index) => <tr key={entry.id ?? `${entry.name}-${entry.createdAt}-${index}`} className={index === 0 ? 'leaderboard-first' : ''}><td><span className="leaderboard-rank">{index + 1}</span></td><th scope="row">{entry.name}</th><td>{entry.levelsCleared ?? 0}<span className="leaderboard-out-of">/3</span></td><td>{Math.max(0, Number(entry.score) || 0).toLocaleString()}</td></tr>)}</tbody></table> : !error && <p className="leaderboard-empty">The river is waiting for its first legend.<br/>Finish a run and post your score.</p>}
    </div>
    {canSubmit && finished && <form className="leaderboard-submit" onSubmit={submit}>
      <div className="leaderboard-your-score"><span>YOUR ADVENTURE SCORE</span><b>{score.score.toLocaleString()}</b><small>{score.levelsCleared}/3 maps cleared · {score.coins} coins</small></div>
      {!submitted && <><label htmlFor={inputId}>Name on the public board</label><div className="leaderboard-entry"><input id={inputId} type="text" value={name} onChange={event => setName(event.target.value)} maxLength={20} minLength={1} required placeholder="Your river name" autoComplete="off" autoCapitalize="words" spellCheck="false" disabled={submitting}/><button type="submit" className="adventure-extra-button leaderboard-post" disabled={submitting || !score.score}>{submitting ? 'Posting…' : 'Post score'}</button></div><small className="leaderboard-public-note">{score.score ? 'Your name and score will be public. No account needed.' : 'Earn a score on your next run to join the board.'}</small></>}
    </form>}
    {success && <p className="leaderboard-success" role="status">{success}</p>}
    {error && <p className="leaderboard-error" role="alert">{error}</p>}
    <div className="leaderboard-bottom"><button type="button" className="leaderboard-refresh" disabled={loading || submitting} onClick={load}>{loading ? 'Refreshing…' : error ? 'Try again' : 'Refresh scores'}</button><span>Adventure totals · Top 10</span></div>
  </section>;
}
