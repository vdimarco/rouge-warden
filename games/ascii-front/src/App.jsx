import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createGame, startGame, togglePause, activateEmp, chooseUpgrade } from './engine.js';
import GameCanvas from './GameCanvas.jsx';

const tankArt = '  ↑  \n[┌┴┐]\n[└─┘]';
const names = ['THE OUTSKIRTS', 'CROSS FIRE', 'IRON GARDEN', 'DEAD FREQUENCY', 'THE LAST SIGNAL'];
const pad = (value, length = 2) => String(value).padStart(length, '0');
function Glyph({ type, size = 19 }) {
  const paths = { book: 'M12 5C8 2 4 3 2 4v15c4-2 7-1 10 1m0-15c4-3 8-2 10-1v15c-4-2-7-1-10 1V5', sound: 'M11 4 5 9H2v6h3l6 5V4m5 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14', muted: 'M11 4 5 9H2v6h3l6 5V4m5 5 6 6m0-6-6 6', arrow: 'M4 12h16m-6-6 6 6-6 6', close: 'm6 6 12 12m0-12L6 18' };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" aria-hidden="true"><path d={paths[type]} /></svg>;
}
function Key({ children }) { return <kbd>{children}</kbd>; }

function Help({ onClose }) {
  const ref = useRef(null);
  useEffect(() => { ref.current.showModal(); }, []);
  return <dialog ref={ref} className="help-dialog" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }} aria-labelledby="help-title">
    <button className="close-button" onClick={onClose} aria-label="Close how to play"><Glyph type="close" /></button>
    <span className="crosshair" aria-hidden="true">┼</span>
    <h2 id="help-title">HOLD THE LINE.</h2>
    <p>Keep your tank alive. Keep the signal online.</p>
    <div className="help-row"><Key>W A S D</Key><span>Move freely, diagonals included. Arrow keys work too.</span></div>
    <div className="help-row"><Key>SPACE</Key><span>Aim with the mouse. Hold left click or Space to fire.</span></div>
    <div className="help-row"><Key>SHIFT</Key><span>Dash through danger. Movement sets your dash direction.</span></div>
    <div className="help-row"><Key>E</Key><span>EMP damages and stuns nearby enemies. Charges are limited.</span></div>
    <div className="help-row"><Key>ESC</Key><span>Pause and take a breath. R starts a fresh run.</span></div>
    <p className="help-tip">Scouts hunt you. Strikers attack the base. Heavies take a beating. Brush hides your tank from enemies at a distance. Collect supplies and choose a permanent upgrade after each wave.</p>
    <button className="primary" onClick={onClose}>GOT IT. <Glyph type="arrow" /></button>
  </dialog>;
}

function Overlay({ game, onCommand, onUpgrade }) {
  if (game.status === 'playing') return null;
  if (game.status === 'upgrade') return <div className="game-overlay"><section className="deploy upgrade" aria-label="Choose an upgrade">
    <span className="crosshair">✦</span><h2>WAVE CLEARED.</h2><p>Your tank. A little more trouble.</p>
    <div className="upgrade-options">{game.upgradeChoices.map(choice => <button key={choice.id} onClick={() => onUpgrade(choice.id)}><span className="upgrade-symbol">{choice.icon}</span><strong>{choice.name}</strong><span>{choice.description}</span><span className="upgrade-select">INSTALL →</span></button>)}</div>
    <span className="enter-hint">Choose an upgrade to deploy the next wave.</span>
  </section></div>;
  const paused = game.status === 'paused', ended = ['gameover', 'victory'].includes(game.status);
  return <div className="game-overlay"><section className={'deploy' + (ended ? ' end-screen' : '')} aria-label={paused ? 'Game paused' : 'Deployment'}>
    <span className="crosshair" aria-hidden="true">{game.status === 'victory' ? '✦' : '┼'}</span>
    <h2>{paused ? 'CATCH YOUR BREATH.' : game.status === 'victory' ? 'SIGNAL SECURED.' : game.status === 'gameover' ? 'SIGNAL LOST.' : 'HOLD THE LINE.'}</h2>
    <p>{paused ? 'The battlefield can wait.' : game.status === 'victory' ? 'Five waves down. The line held.' : game.status === 'gameover' ? (game.base.hp <= 0 ? 'Your base went dark. Come back stronger.' : 'Your tank is down. The fight isn’t over.') : 'Protect your base. Make every shot count.'}</p>
    {ended && <div className="end-stats"><span>SCORE <strong>{pad(game.score, 6)}</strong></span><span>KILLS <strong>{game.kills}</strong></span></div>}
    <button className="primary" onClick={() => onCommand(ended ? 'restart-and-start' : 'start')}>{paused ? 'BACK TO BATTLE' : ended ? 'DEPLOY AGAIN' : 'DEPLOY TANK'}<Glyph type="arrow" /></button>
    <span className="enter-hint">or press ENTER</span>
  </section></div>;
}

function MissionPanel({ game, onCommand }) {
  return <aside className="mission-panel">
    <section className="mission-brief"><h3>MISSION BRIEF</h3><h2>Defend the signal.</h2><p>{game.mode === 'campaign' ? 'Five waves. One base. No second chances.' : 'Endless waves. One base. How long can you hold?'}</p>
      {game.status !== 'ready' && <div className="wave-progress"><span>HOSTILES CLEARED</span><strong>{pad(game.waveKills)} <span>/ {pad(game.waveTotal)}</span></strong><div className="thin-progress"><i style={{ width: `${game.waveKills / game.waveTotal * 100}%` }} /></div></div>}
    </section>
    <section className="tank-section"><h3>YOUR TANK</h3><div className="tank-health"><pre aria-hidden="true">{tankArt}</pre><span>HP</span><div className="hp-pips" aria-label={`Tank health: ${game.player.hp} of ${game.player.maxHp}`}>{Array.from({ length: game.player.maxHp }, (_, i) => <i className={i < game.player.hp ? 'full' : ''} key={i} />)}</div></div>
      {game.upgrades.length > 0 && <p className="installed">{game.upgrades.length} UPGRADE{game.upgrades.length > 1 ? 'S' : ''} INSTALLED</p>}
    </section>
    <section className="loadout"><h3>LOADOUT</h3><div className="loadout-row"><Key>SPACE</Key><div>Cannon<span>Hold space or click</span></div></div><div className="loadout-row"><Key>SHIFT</Key><div>Dash<span>{game.player.dashCooldown > 0 ? `Ready in ${game.player.dashCooldown.toFixed(1)}s` : 'Break through danger'}</span></div></div><div className="loadout-row"><button className="key-button" onClick={() => onCommand('emp')} disabled={game.status !== 'playing' || game.empCharges < 1} aria-label={`Activate EMP blast, ${game.empCharges} charge${game.empCharges === 1 ? '' : 's'}`}>E</button><div>EMP blast<span>{game.status === 'ready' ? 'Clear your perimeter' : `${game.empCharges} charge${game.empCharges === 1 ? '' : 's'} remaining`}</span></div></div></section>
    <section className="field-guide"><h3>FIELD GUIDE</h3><div><span className="brick">###</span><span>Brick · Destructible</span></div><div><span className="steel">╳╳╳</span><span>Steel · Unbreakable</span></div><div><span className="water">~~~</span><span>Water · Impassable</span></div><div><span className="brush">%:%</span><span>Brush · Concealment</span></div></section>
  </aside>;
}

function TouchControls({ inputRef, onCommand, active }) {
  const hold = key => ({ onPointerDown: e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); inputRef.current[key] = true; }, onPointerUp: () => { inputRef.current[key] = false; }, onPointerCancel: () => { inputRef.current[key] = false; }, onLostPointerCapture: () => { inputRef.current[key] = false; } });
  return <div className="touch-controls" aria-label="Touch game controls"><div className="dpad"><button {...hold('up')} aria-label="Move up">↑</button><button {...hold('left')} aria-label="Move left">←</button><button {...hold('down')} aria-label="Move down">↓</button><button {...hold('right')} aria-label="Move right">→</button></div><div className="touch-actions"><button {...hold('fire')} disabled={!active}>FIRE</button><button {...hold('dash')} disabled={!active}>DASH</button><button onClick={() => onCommand('emp')} disabled={!active}>EMP</button></div></div>;
}

export default function App() {
  const gameRef = useRef(null), inputRef = useRef({});
  if (!gameRef.current) gameRef.current = createGame();
  const [, refresh] = useState(0), [sound, setSound] = useState(true), [help, setHelp] = useState(false);
  const onUpdate = useCallback(() => refresh(value => value + 1), []);
  const onCommand = useCallback(command => {
    const game = gameRef.current;
    if (command === 'start') {
      if (game.status === 'paused') togglePause(game);
      else if (game.status === 'ready') startGame(game);
      else if (['gameover', 'victory'].includes(game.status)) { gameRef.current = createGame({ mode: game.mode, seed: Date.now() }); startGame(gameRef.current); }
    } else if (command === 'pause') togglePause(game);
    else if (command === 'emp') activateEmp(game);
    else if (command === 'restart' || command === 'restart-and-start') {
      gameRef.current = createGame({ mode: game.mode, seed: Date.now() });
      inputRef.current = {};
      if (command === 'restart-and-start') startGame(gameRef.current);
    }
    onUpdate();
    if (['start', 'restart-and-start'].includes(command)) document.querySelector('canvas')?.focus({ preventScroll: true });
  }, [onUpdate]);
  const game = gameRef.current;
  const inArcade = /^\/ascii-front(?:\/|$)/.test(window.location.pathname);
  useEffect(() => { window.GameSwitch?.wire(); }, []);
  const switchMode = mode => { if (game.mode !== mode) { gameRef.current = createGame({ mode, seed: Date.now() }); inputRef.current = {}; onUpdate(); } };
  const showHelp = () => { if (game.status === 'playing') togglePause(game); setHelp(true); };
  const statusLabel = { ready: 'SYSTEM READY', playing: 'SIGNAL LIVE', paused: 'SYSTEM PAUSED', upgrade: 'WAVE CLEARED', gameover: 'SIGNAL LOST', victory: 'SIGNAL SECURED' }[game.status];
  const basePercent = Math.max(0, Math.round(game.base.hp / game.base.maxHp * 100));
  const time = `${pad(Math.floor(game.time / 60))}:${pad(Math.floor(game.time % 60))}`;
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="./" aria-label="ASCII Front home"><pre aria-hidden="true">{'  ┃    \n[╭╨╮]━━\n[╰─╯]  '}</pre><span><b>ASCII</b> FRONT</span></a><div className="header-actions">{inArcade && <a href="/" data-switch className="arcade-menu" aria-label="Open Warden Arcade menu" onClickCapture={() => { if (game.status === 'playing') onCommand('pause'); }}><span aria-hidden="true">▦</span><span className="arcade-label">ARCADE</span></a>}<button onClick={showHelp}><Glyph type="book" /><span>HOW TO PLAY</span></button><button onClick={() => setSound(value => !value)} aria-pressed={sound}><Glyph type={sound ? 'sound' : 'muted'} /><span>SOUND {sound ? 'ON' : 'OFF'}</span></button></div></header>
    <main>
      <div className="intro"><div><h1>Small tanks. Big trouble.</h1><p>An ASCII battlefield. An arcade soul.</p></div><span className="tagline">BUILT TO PLAY. NOT TO WATCH.</span></div>
      <nav className="modebar" aria-label="Game mode"><div className="mode-tabs"><button className={game.mode === 'campaign' ? 'selected' : ''} aria-pressed={game.mode === 'campaign'} onClick={() => switchMode('campaign')}><span>01</span> CAMPAIGN</button><button className={game.mode === 'endless' ? 'selected' : ''} aria-pressed={game.mode === 'endless'} onClick={() => switchMode('endless')}><span>02</span> ENDLESS</button></div><div className="run-controls"><button onClick={() => onCommand('restart')} aria-label="Restart run"><Key>R</Key><span>RESTART</span></button><button onClick={() => onCommand('pause')} aria-label={game.status === 'paused' ? 'Resume game' : 'Pause game'} disabled={!['playing', 'paused'].includes(game.status)}><Key>ESC</Key><span>{game.status === 'paused' ? 'RESUME' : 'PAUSE'}</span></button></div></nav>
      <div className="game-layout"><div className="battle-column"><section className="battlefield" aria-label="Game arena"><div className="arena-toolbar"><span>SECTOR {pad(game.wave)} / {names[(game.wave - 1) % names.length]}</span><span className={`system-status ${game.status === 'gameover' ? 'danger' : ''}`}><i />{statusLabel}</span></div><div className="canvas-wrap"><GameCanvas gameRef={gameRef} inputRef={inputRef} sound={sound} onUpdate={onUpdate} onCommand={onCommand} /><Overlay game={game} onCommand={onCommand} onUpgrade={id => { chooseUpgrade(gameRef.current, id); onUpdate(); document.querySelector('canvas')?.focus({ preventScroll: true }); }} /></div></section>
        <div className="statusbar" role="status" aria-live="off"><div><span>WAVE</span><strong>{pad(game.wave)} <small>/ {game.mode === 'campaign' ? '05' : '∞'}</small></strong></div><div><span>SCORE</span><strong>{pad(game.score, 6)}</strong>{game.combo > 1 && <em>×{game.combo}</em>}</div><div className="base-status"><span>BASE INTEGRITY</span><div className="base-meter" role="meter" aria-label="Base integrity" aria-valuenow={basePercent} aria-valuemin={0} aria-valuemax={100}>{Array.from({ length: 20 }, (_, i) => <i key={i} className={i < Math.ceil(basePercent / 5) ? 'full' : ''} />)}</div><strong className={basePercent <= 30 ? 'danger' : 'lime'}>{basePercent}%</strong></div><div className="uptime"><span>UPTIME</span><strong>{time}</strong></div></div>
        <TouchControls inputRef={inputRef} onCommand={onCommand} active={game.status === 'playing'} />
      </div><MissionPanel game={game} onCommand={onCommand} /></div>
    </main>
    <footer><div className="keyboard-legend"><span>W A S D / ↑ ↓ ← → <b>MOVE</b></span><span>MOUSE <b>AIM</b></span><span>SPACE / CLICK <b>FIRE</b></span><span>SHIFT <b>DASH</b></span><span>E <b>EMP</b></span></div><span>Inspired by the classics. Rendered in characters.<a href="https://github.com/bas3line/ascii" target="_blank" rel="noreferrer" aria-label="ASCII aesthetic reference by bas3line">↗</a></span></footer>
    {help && <Help onClose={() => setHelp(false)} />}
  </div>;
}
