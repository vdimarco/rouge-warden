import React, { useEffect, useRef, useState } from 'react';
import Menu from './components/Menu.jsx';
import Hud, { formatTime } from './components/Hud.jsx';
import Modal from './components/Modal.jsx';
import { Logo, Icon } from './components/Icons.jsx';
import { createGame, emptyInput, snapshot, updateGame } from './game/engine.js';
import { loadArt, renderGame } from './game/render.js';
import { RiverAudio } from './game/audio.js';

const readBest = () => { try { const value = JSON.parse(localStorage.getItem('river-rush-best')); return value && Number.isFinite(value.score) && value.score > 0 ? value : null; } catch { return null; } };

export default function App() {
  const [mode, setMode] = useState('menu');
  const [art, setArt] = useState(null), [error, setError] = useState('');
  const [game, setGame] = useState(null), [best, setBest] = useState(readBest);
  const [sound, setSound] = useState(false);
  const canvasRef = useRef(), model = useRef(), input = useRef(emptyInput());
  const modeRef = useRef(mode), audio = useRef(new RiverAudio());
  const actions = useRef();
  modeRef.current = mode;

  useEffect(() => { let alive = true; loadArt().then(result => { if (alive) setArt(result); }).catch(e => { if (alive) setError(e.message); }); return () => { alive = false; }; }, []);

  function start() {
    if (!art) return;
    input.current = emptyInput(); model.current = createGame();
    setGame(snapshot(model.current)); setMode('playing'); audio.current.setEnabled(sound);
  }
  function pause() { if (modeRef.current === 'playing') { input.current = emptyInput(); setMode('paused'); } }
  function resume() { input.current = emptyInput(); setMode('playing'); }
  function home() { input.current = emptyInput(); setMode('menu'); }
  function switchGames() { home(); requestAnimationFrame(() => window.GameSwitch?.open('river-rush')); }
  function toggleSound() { const enabled = !sound; setSound(enabled); audio.current.setEnabled(enabled); }
  actions.current = { start, pause, ready: !!art };

  useEffect(() => { window.GameSwitch?.wire(); }, [mode]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const validate = value => { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length) throw new Error('Expected an empty object.'); };
    const register = (name, description, readOnly, execute) => {
      try { Promise.resolve(context.registerTool({ name, description, inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: readOnly }, execute: async value => { validate(value); return execute(); } }, { signal: lifecycle.signal })).catch(() => {}); } catch {}
    };
    register('get_run_status', 'Read the current River Rush race status.', true, () => ({ screen: modeRef.current, run: model.current ? snapshot(model.current) : null }));
    register('start_run', 'Start or restart the two-minute River Rush race.', false, async () => { if (!actions.current.ready) throw new Error('River art is still loading.'); actions.current.start(); await new Promise(requestAnimationFrame); return { screen: 'playing' }; });
    register('pause_run', 'Pause an active River Rush race.', false, async () => { if (modeRef.current !== 'playing') throw new Error('No active race to pause.'); actions.current.pause(); await new Promise(requestAnimationFrame); return { screen: 'paused' }; });
    return () => lifecycle.abort();
  }, []);

  useEffect(() => {
    if (!art) return;
    let raf, previous = 0, uiAt = 0;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduceMotion = preference.matches;
    const changed = e => { reduceMotion = e.matches; };
    preference.addEventListener('change', changed);
    function tick(now) {
      const dt = previous ? Math.min(0.05, (now - previous) / 1000) : 0; previous = now;
      if (model.current && modeRef.current !== 'menu' && modeRef.current !== 'help') {
        const g = model.current;
        const before = g.eventId;
        if (modeRef.current === 'playing') updateGame(g, input.current, dt);
        if (g.eventId !== before) audio.current.tone(g.event);
        const canvas = canvasRef.current;
        if (canvas) {
          const width = window.innerWidth, height = window.innerHeight;
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          if (canvas.width !== width * dpr || canvas.height !== height * dpr) { canvas.width = width * dpr; canvas.height = height * dpr; }
          const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          renderGame(ctx, g, art, width, height, reduceMotion);
        }
        if (now - uiAt > 65 || g.phase !== 'playing') { setGame(snapshot(g)); uiAt = now; }
        if (g.phase === 'won' || g.phase === 'lost') {
          if (modeRef.current === 'playing') {
            setMode('result');
            if (g.phase === 'won') setBest(old => {
              const value = !old || g.score > old.score ? { score: g.score, time: g.time } : old;
              try { localStorage.setItem('river-rush-best', JSON.stringify(value)); } catch {}
              return value;
            });
          }
        }
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick); return () => { cancelAnimationFrame(raf); preference.removeEventListener('change', changed); };
  }, [art]);

  useEffect(() => {
    const mapping = { KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'reach', KeyE: 'unlock', ShiftLeft: 'boost', ShiftRight: 'boost' };
    function down(e) {
      if (modeRef.current === 'playing') {
        if (e.code === 'Escape' || e.code === 'KeyP') { e.preventDefault(); pause(); return; }
        if (mapping[e.code]) { e.preventDefault(); input.current[mapping[e.code]] = true; if (mapping[e.code] === 'boost' && !e.repeat) input.current.boostTap = true; }
      }
    }
    function up(e) { if (mapping[e.code]) { input.current[mapping[e.code]] = false; if (modeRef.current === 'playing') e.preventDefault(); } }
    function hidden() { if (document.hidden) pause(); }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    window.addEventListener('blur', pause); document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', hidden); };
  }, []);

  // Pointer movement steers the raft directly on touch devices; action buttons support multitouch.
  function drag(e) {
    if (!model.current || mode !== 'playing' || !e.buttons) return;
    const target = Math.max(245, Math.min(755, e.clientX / window.innerWidth * 1000));
    model.current.x += (target - model.current.x) * (input.current.reach ? 0.08 : 0.28);
  }

  const inGame = !['menu', 'help'].includes(mode);
  return <div className={`app ${inGame ? 'in-game' : ''}`} data-paused={inGame && mode !== 'playing'}>
    {inGame && <canvas ref={canvasRef} className="game-canvas" aria-label="River race play area. Use A and D to steer, Space to reach, E to unlock." onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); drag(e); }} onPointerMove={drag}/>}
    <header className="app-header"><button className="brand" aria-label="River Rush home" onClick={() => { if (inGame) pause(); else home(); }}><Logo/><span>RIVER RUSH</span></button>{inGame && <span className="header-course">THE GOLDEN KEY RUN</span>}<div className="header-actions">{inGame && <button className="circle-button" aria-label="Pause game" onClick={pause}><Icon name="pause"/></button>}<button className="circle-button" aria-label={sound ? 'Mute sound' : 'Enable sound'} aria-pressed={sound} onClick={toggleSound}><Icon name={sound ? 'sound' : 'muted'}/></button></div></header>
    {!inGame && <Menu onStart={start} onHelp={() => setMode('help')} ready={!!art} error={error} best={best} active={mode === 'menu'}/>}
    {inGame && game && <Hud game={game} input={input}/>}
    {mode === 'help' && <Modal label="How to play" onDismiss={home}><button className="modal-close circle-button" aria-label="Close instructions" onClick={home}><Icon name="close"/></button><Icon name="key" className="modal-symbol"/><h2>One key.<br/>One way out.</h2><p>Claim the treasure and escape before your rival.</p><ol className="instructions"><li><b>Steer through the rapids.</b><span>A / D or arrow keys. On touch, drag the raft or use the arrows. The right current is faster. Skim rocks for charge, then press Shift or Surge for a risky speed burst.</span></li><li><b>Catch the golden key.</b><span>Move close, hold Space or Reach, then release when the key reaches your raft. Reaching reduces steering.</span></li><li><b>Unlock the treasure.</b><span>With a key aboard, hold E or Unlock for two seconds. Rocks and waves can knock you off balance.</span></li><li><b>Escape left.</b><span>Beat your rival into the marked left channel. If you fall, the rope brings you back—but costs time.</span></li></ol><button className="primary" disabled={!art} onClick={start}>Let’s ride<Icon name="arrow"/></button></Modal>}
    {mode === 'paused' && <Modal label="Game paused" onDismiss={resume}><Icon name="pause" className="modal-symbol"/><h2>Catch your breath.</h2><p>The river can wait a moment.</p><button className="primary" onClick={resume}>Resume adventure<Icon name="arrow"/></button><div className="modal-secondary"><button onClick={start}>Restart run</button><button onClick={home}>Back to river</button></div><small>A / D to steer · Space to reach · E to unlock</small></Modal>}
    {mode === 'result' && game && <Modal label={game.phase === 'won' ? 'Adventure complete' : 'Run complete'} onDismiss={home}><Icon name={game.phase === 'won' ? 'chest' : 'flag'} className="modal-symbol"/><h2>{game.phase === 'won' ? <>A legendary<br/>escape.</> : <>The river<br/>wins this time.</>}</h2><p>{game.reason}</p><div className="result-stats"><div><b>{game.score.toLocaleString()}</b><span>POINTS</span></div><div><b>{formatTime(game.time)}</b><span>RUN TIME</span></div><div><b>{game.falls}</b><span>WIPEOUTS</span></div></div><button className="primary" onClick={start}>Ride again<Icon name="arrow"/></button><div className="modal-secondary"><button onClick={home}>Back to river</button><button onClick={switchGames}>Switch game</button><a href="/">Arcade</a></div></Modal>}
  </div>;
}
