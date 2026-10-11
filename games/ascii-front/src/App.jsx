import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createGame, startGame, togglePause, activateEmp, chooseUpgrade, continueStage } from './engine.js';
import { MAPS, validateMap } from './maps.js';
import GameCanvas from './GameCanvas.jsx';

const TIERS = ['SCOUT', 'GUNNER', 'TWIN', 'SIEGE'];
const TIER_BENEFITS = ['ONE SHELL', 'FASTER SHELLS', 'TWO ACTIVE SHELLS', 'BREAKS STEEL'];
const TANK_ART = ['  ║  \n▌┌─┐▐\n▌└─┘▐', '  ║  \n▌╔═╗▐\n▌╚★╝▐', ' ║ ║ \n▌╔═╗▐\n▌╚═╝▐', ' ║█║ \n▐╔▓╗▌\n▐╚═╝▌'];
const BRUSHES = [['.', '·', 'Erase'], ['#', '#', 'Brick'], ['S', 'X', 'Steel'], ['~', '≈', 'Water'], ['%', '%', 'Brush'], ['I', '░', 'Ice']];
const SUPPLIES = [['★', 'Star', 'Upgrade your tank, up to Siege tier.'], ['◈', 'Helmet', 'Temporary invulnerability.'], ['✹', 'Grenade', 'Destroy every enemy on the field.'], ['◷', 'Timer', 'Freeze enemy tanks.'], ['♜', 'Shovel', 'Fortify the HQ perimeter.'], ['♟', 'Tank', 'Gain an extra life.']];
const pad = (value, length = 2) => String(value).padStart(length, '0');
const runOptions = game => ({ mode: game.mode, seed: Date.now(), stage: game.wave, coop: game.coop, customMap: game.mode === 'custom' ? game.customMap || game.terrain : null });
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
    <span className="crosshair" aria-hidden="true">┼</span><h2 id="help-title">HOLD THE LINE.</h2><p>35 battlefields. Three lives. One signal to protect.</p>
    <div className="help-row"><Key>W A S D</Key><span>P1: move up, down, left or right. Arrow keys work too.</span></div>
    <div className="help-row"><Key>SPACE</Key><span>Fire where your tank faces. Optional: hold left click to aim and fire. Shift dashes; E fires EMP.</span></div>
    <div className="help-row"><Key>I J K L</Key><span>P2: move and aim. Hold U to fire, O to dash. Enable 2 PLAYERS before deploying.</span></div>
    <div className="help-row"><Key>ESC / R</Key><span>Pause / restart. Sound controls original music and effects; music starts after interaction.</span></div>
    <p className="help-tip">Clear 20 enemies to secure a stage. HQ falls to one hit. Tanks have armor and three lives, with a shield after respawning. Bullets cancel opposing bullets. Ice makes you slide; foliage hides tanks. Flashing supply carriers drop a pickup when hit.</p>
    <div className="help-supplies">{SUPPLIES.map(([symbol, name, description]) => <div key={name}><b>{symbol} {name}</b><span>{description}</span></div>)}</div>
    <p className="help-tip">Follow the golden stars: Scout → Gunner (faster shells) → Twin (two active shells) → Siege (break steel). Each rank-up gives a brief shield. Campaign stages repair your armor and carry stars and lives forward. Endless adds a permanent upgrade choice. Construction lets you paint, save locally and test your own map.</p>
    <button className="primary" onClick={onClose}>GOT IT. <Glyph type="arrow" /></button>
  </dialog>;
}

function StageBrowser({ current, onSelect, onClose }) {
  const ref = useRef(null);
  useEffect(() => { ref.current.showModal(); }, []);
  return <dialog ref={ref} className="help-dialog stage-dialog" onCancel={onClose} aria-labelledby="stage-title" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <button className="close-button" onClick={onClose} aria-label="Close stage browser"><Glyph type="close" /></button>
    <span className="eyebrow">CAMPAIGN / 35 ORIGINAL BATTLEFIELDS</span><h2 id="stage-title">CHOOSE YOUR FRONT.</h2><p>Every sector has its own route through the chaos.</p>
    <div className="stage-list">{MAPS.map(map => <button key={map.id} className={'stage-card' + (Number(map.id) === current ? ' selected' : '')} onClick={() => onSelect(Number(map.id))} aria-label={`Stage ${map.id}: ${map.name}`} aria-pressed={Number(map.id) === current}>
      <span><b>{pad(map.id)}</b><strong>{map.name}</strong></span><pre aria-hidden="true">{map.terrain.filter((_, row) => row % 4 === 1).map(row => Array.from(row).filter((_, col) => col % 2 === 0).map(tile => ({ '.': '·', S: 'X', I: '░' }[tile] || tile)).join('')).join('\n')}</pre>
    </button>)}</div>
  </dialog>;
}

function SquadStats({ game }) {
  if (!game.coop) return null;
  return <div className="squad-stats">{game.players.map((player, index) => <div key={player.id} className={index === 1 ? 'player-two' : ''}><b>P{index + 1}</b><span>{player.stageKills || 0} STAGE KILLS</span><strong>{pad(player.score || 0, 6)}</strong>{game.stageBonus?.[player.id] > 0 && <em>+{game.stageBonus[player.id]} BONUS</em>}</div>)}</div>;
}

function Overlay({ game, onCommand, onUpgrade }) {
  if (['playing', 'editor'].includes(game.status)) return null;
  if (game.status === 'upgrade' && game.mode === 'campaign') return <div className="game-overlay"><section className="deploy stage-clear" aria-label="Stage cleared">
    <span className="crosshair">★</span><h2>STAGE {pad(game.wave)} CLEARED.</h2><p>Armor repairs on the next front.<br />Your stars and lives carry forward.</p>
    <div className="carry-over">{game.players.map((player, index) => <div key={player.id} className={index === 1 ? 'player-two' : ''}><pre aria-hidden="true">{TANK_ART[player.level || 0]}</pre><strong>P{index + 1} / {TIERS[player.level || 0]}</strong><span>{'★'.repeat(player.level || 0) || '·'} · {player.lives} LIVES</span></div>)}</div><SquadStats game={game} />
    <button className="primary" onClick={() => onCommand('next-stage')}>NEXT STAGE <Glyph type="arrow" /></button><span className="enter-hint">or press ENTER</span>
  </section></div>;
  if (game.status === 'upgrade') return <div className="game-overlay"><section className="deploy upgrade" aria-label="Choose an upgrade">
    <span className="crosshair">✦</span><h2>STAGE CLEARED.</h2><p>Your tank. A little more trouble.</p><SquadStats game={game} />
    <div className="upgrade-options">{game.upgradeChoices.map(choice => <button key={choice.id} onClick={() => onUpgrade(choice.id)}><span className="upgrade-symbol">{choice.icon}</span><strong>{choice.name}</strong><span>{choice.description}</span><span className="upgrade-select">INSTALL →</span></button>)}</div><span className="enter-hint">Choose an upgrade to deploy the next stage.</span>
  </section></div>;
  const paused = game.status === 'paused', ended = ['gameover', 'victory'].includes(game.status);
  return <div className="game-overlay"><section className={'deploy' + (ended ? ' end-screen' : '')} aria-label={paused ? 'Game paused' : 'Deployment'}>
    <span className="crosshair" aria-hidden="true">{game.status === 'victory' ? '✦' : '┼'}</span>
    <h2>{paused ? 'CATCH YOUR BREATH.' : game.status === 'victory' ? 'SIGNAL SECURED.' : game.status === 'gameover' ? 'SIGNAL LOST.' : 'HOLD THE LINE.'}</h2>
    <p>{paused ? 'The battlefield can wait.' : game.status === 'victory' ? (game.mode === 'custom' ? 'Your battlefield. Your victory.' : 'All 35 fronts secured. The line held.') : game.status === 'gameover' ? (game.base.hp <= 0 ? 'Your base went dark. Come back stronger.' : 'Out of lives. Come back stronger.') : `${game.coop ? 'Two tanks. ' : ''}Protect your base. Make every shot count.`}</p>
    {ended && <><div className="end-stats"><span>SCORE <strong>{pad(game.score, 6)}</strong></span><span>KILLS <strong>{game.kills}</strong></span></div><SquadStats game={game} /></>}
    <button className="primary" onClick={() => onCommand(ended ? 'restart-and-start' : 'start')}>{paused ? 'BACK TO BATTLE' : ended ? 'DEPLOY AGAIN' : game.coop ? 'DEPLOY TANKS' : 'DEPLOY TANK'}<Glyph type="arrow" /></button><span className="enter-hint">or press ENTER</span>
  </section></div>;
}

function MissionPanel({ game, onCommand }) {
  const players = game.players || [game.player];
  return <aside className="mission-panel">
    <section className="mission-brief"><h3>{game.status === 'editor' ? 'CONSTRUCTION' : 'MISSION BRIEF'}</h3><h2>{game.status === 'editor' ? 'Build your battlefield.' : 'Defend the signal.'}</h2><p>{game.status === 'editor' ? 'Paint terrain. Keep the HQ and spawn lanes clear. Test, refine, repeat.' : game.mode === 'campaign' ? '35 stages. Collect stars. Keep HQ safe.' : game.mode === 'custom' ? 'Your map. 20 hostiles. Hold the line.' : 'Endless fronts. One base. How long can you hold?'}</p>
      {!['ready', 'editor'].includes(game.status) && <div className="wave-progress"><span>HOSTILES CLEARED</span><strong>{pad(game.waveKills)} <span>/ {pad(game.waveTotal)}</span></strong><div className="thin-progress"><i style={{ width: `${game.waveKills / game.waveTotal * 100}%` }} /></div></div>}
    </section>
    <section className="tank-section"><h3>{game.coop ? 'YOUR SQUAD' : 'YOUR TANK'}</h3>{players.map((player, index) => <div className={'player-card' + (index === 1 ? ' player-two' : '') + (player.rankFx > 0 ? ' rank-up' : '')} key={player.id || index}>
      <div className="tank-tier"><strong>P{index + 1} / {TIERS[player.level || 0]}</strong><span aria-label={`Tank level ${(player.level || 0) + 1} of 4`}>{'★'.repeat(player.level || 0)}{'·'.repeat(3 - (player.level || 0))}</span></div>
      <div className="tank-health"><pre aria-hidden="true">{TANK_ART[player.level || 0]}</pre><span>HP</span><div className="hp-pips" aria-label={`P${index + 1} health: ${player.hp} of ${player.maxHp}`}>{Array.from({ length: player.maxHp }, (_, i) => <i className={i < player.hp ? 'full' : ''} key={i} />)}</div></div>
      <div className="life-row"><span>LIVES <b>{player.lives ?? 3}</b></span><span>{player.respawnTimer > 0 ? `RESPAWN ${player.respawnTimer.toFixed(1)}s` : player.dead ? 'OUT OF ACTION' : player.invulnerable > 0 ? `SHIELD ${Math.ceil(player.invulnerable)}s` : player.level === 3 ? 'STEEL BREAKER' : player.level === 2 ? 'DUAL SHELLS' : player.level === 1 ? 'HIGH VELOCITY' : 'READY FOR A STAR'}</span></div>
      {player.rankFx > 0 ? <div className="rank-notice" role="status"><strong>★ {TIERS[player.level || 0]} UNLOCKED</strong><span>{TIER_BENEFITS[player.level || 0]}</span></div> : <div className="next-star"><span>{player.level >= 3 ? '★★★ MAX RANK' : `NEXT ★ ${TIERS[(player.level || 0) + 1]}`}</span><strong>{TIER_BENEFITS[Math.min(3, (player.level || 0) + 1)]}</strong></div>}
    </div>)}{game.upgrades.length > 0 && <p className="installed">{game.upgrades.length} PERMANENT UPGRADE{game.upgrades.length > 1 ? 'S' : ''}</p>}</section>
    <section className="loadout"><h3>LOADOUT</h3><div className="loadout-row"><Key>SPACE</Key><div>Cannon<span>Fire where you face</span></div></div><div className="loadout-row"><Key>SHIFT</Key><div>Dash<span>{game.player.dashCooldown > 0 ? `Ready in ${game.player.dashCooldown.toFixed(1)}s` : 'Break through danger'}</span></div></div><div className="loadout-row"><button className="key-button" onClick={() => onCommand('emp')} disabled={game.status !== 'playing' || game.empCharges < 1} aria-label={`Activate EMP blast, ${game.empCharges} charges`}>E</button><div>EMP blast<span>{game.empCharges} charges remaining</span></div></div>
      {game.freezeTimer > 0 && <p className="power-status">◷ TIME STOP <b>{Math.ceil(game.freezeTimer)}s</b></p>}{game.fortifyTimer > 0 && <p className="power-status">♜ HQ FORTIFIED <b>{Math.ceil(game.fortifyTimer)}s</b></p>}
    </section>
    <section className="field-guide"><h3>FIELD GUIDE</h3><div><span className="brick">###</span><span>Brick · Destructible</span></div><div><span className="steel">XXX</span><span>Steel · Siege breaks it</span></div><div><span className="water">~~~</span><span>Water · Impassable</span></div><div><span className="brush">%:%</span><span>Brush · Concealment</span></div><div><span className="ice">░░░</span><span>Ice · Slippery</span></div><div className="supply-guide">{SUPPLIES.map(([symbol, name, description]) => <span key={name} title={description}><b>{symbol}</b>{name}</span>)}</div></section>
  </aside>;
}

function TouchControls({ inputRef, onCommand, active }) {
  const hold = key => ({ onPointerDown: e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); inputRef.current[key] = true; (inputRef.current.pulses ??= {})[key] = true; }, onPointerUp: () => { inputRef.current[key] = false; }, onPointerCancel: () => { inputRef.current[key] = false; }, onLostPointerCapture: () => { inputRef.current[key] = false; } });
  return <div className="touch-controls" aria-label="Touch game controls"><div className="dpad"><button {...hold('up')} aria-label="Move up">↑</button><button {...hold('left')} aria-label="Move left">←</button><button {...hold('down')} aria-label="Move down">↓</button><button {...hold('right')} aria-label="Move right">→</button></div><div className="touch-actions"><button {...hold('fire')} disabled={!active}>FIRE</button><button {...hold('dash')} disabled={!active}>DASH</button><button onClick={() => onCommand('emp')} disabled={!active}>EMP</button></div></div>;
}

export default function App() {
  const gameRef = useRef(null), inputRef = useRef({});
  if (!gameRef.current) gameRef.current = createGame();
  const [, refresh] = useState(0), [sound, setSound] = useState(true), [help, setHelp] = useState(false), [stages, setStages] = useState(false), [editorMessage, setEditorMessage] = useState('');
  const onUpdate = useCallback(() => refresh(value => value + 1), []);
  const onCommand = useCallback(command => {
    const game = gameRef.current;
    if (command === 'start') {
      if (game.status === 'paused') togglePause(game);
      else if (game.status === 'ready') startGame(game);
      else if (game.status === 'upgrade' && game.mode === 'campaign') continueStage(game);
      else if (['gameover', 'victory'].includes(game.status)) { gameRef.current = createGame(runOptions(game)); startGame(gameRef.current); }
    } else if (command === 'next-stage') continueStage(game);
    else if (command === 'pause') togglePause(game);
    else if (command === 'emp') activateEmp(game);
    else if (command === 'restart' || command === 'restart-and-start') {
      const editing = game.status === 'editor';
      gameRef.current = createGame({ ...runOptions(game), customMap: editing ? game.terrain : game.customMap });
      if (editing) { gameRef.current.status = 'editor'; gameRef.current.editorBrush = game.editorBrush || '#'; }
      inputRef.current = {};
      if (command === 'restart-and-start') startGame(gameRef.current);
    }
    onUpdate();
    if (['start', 'restart-and-start', 'next-stage'].includes(command)) document.querySelector('canvas')?.focus({ preventScroll: true });
  }, [onUpdate]);
  const game = gameRef.current;
  const inArcade = /^\/ascii-front(?:\/|$)/.test(window.location.pathname);
  useEffect(() => { window.GameSwitch?.wire(); }, []);
  const setRun = (options, editing = false) => {
    gameRef.current = createGame(options);
    if (editing) { gameRef.current.status = 'editor'; gameRef.current.editorBrush = game.editorBrush || '#'; }
    inputRef.current = {}; setEditorMessage(''); onUpdate();
  };
  const switchMode = mode => {
    if (game.mode === mode && (mode !== 'custom' || game.status === 'editor')) return;
    setRun({ mode, seed: Date.now(), stage: game.wave, coop: game.coop, customMap: mode === 'custom' ? game.customMap || game.terrain : null }, mode === 'custom');
  };
  const changeCoop = coop => setRun({ ...runOptions(game), coop, customMap: game.status === 'editor' ? game.terrain : game.customMap }, game.status === 'editor');
  const testMap = () => {
    if (!validateMap(game.terrain)) { setEditorMessage('Map invalid: keep the boundary, HQ and spawn lanes clear.'); return; }
    setRun({ mode: 'custom', seed: Date.now(), coop: game.coop, customMap: game.terrain });
    startGame(gameRef.current); onUpdate(); document.querySelector('canvas')?.focus({ preventScroll: true });
  };
  const saveMap = () => {
    if (!validateMap(game.terrain)) { setEditorMessage('Map invalid: keep the boundary, HQ and spawn lanes clear.'); return; }
    try { localStorage.setItem('ascii-front-map', JSON.stringify(game.terrain)); setEditorMessage('Map saved on this device.'); } catch { setEditorMessage('This browser could not save the map.'); }
  };
  const loadMap = () => {
    try {
      const saved = localStorage.getItem('ascii-front-map');
      if (!saved) { setEditorMessage('No saved map on this device yet.'); return; }
      const terrain = JSON.parse(saved);
      if (!validateMap(terrain)) { setEditorMessage('Saved map is invalid and was not loaded.'); return; }
      setRun({ mode: 'custom', seed: Date.now(), coop: game.coop, customMap: terrain }, true); setEditorMessage('Saved map loaded.');
    } catch { setEditorMessage('This browser could not load the saved map.'); }
  };
  const showHelp = () => { if (game.status === 'playing') togglePause(game); setHelp(true); };
  const statusLabel = { ready: 'SYSTEM READY', playing: 'SIGNAL LIVE', paused: 'SYSTEM PAUSED', upgrade: 'STAGE CLEARED', gameover: 'SIGNAL LOST', victory: 'SIGNAL SECURED', editor: 'CONSTRUCTION' }[game.status];
  const basePercent = Math.max(0, Math.round(game.base.hp / game.base.maxHp * 100));
  const time = `${pad(Math.floor(game.time / 60))}:${pad(Math.floor(game.time % 60))}`;
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="./" aria-label="ASCII Front home"><pre aria-hidden="true">{'  ┃    \n[╭╨╮]━━\n[╰─╯]  '}</pre><span><b>ASCII</b> FRONT</span></a><div className="header-actions">{inArcade && <a href="/" data-switch className="arcade-menu" aria-label="Open Warden Arcade menu" onClickCapture={() => { if (game.status === 'playing') onCommand('pause'); }}><span aria-hidden="true">▦</span><span className="arcade-label">ARCADE</span></a>}<button onClick={showHelp}><Glyph type="book" /><span>HOW TO PLAY</span></button><button onClick={() => setSound(value => !value)} aria-pressed={sound} aria-label={`Music and sound effects ${sound ? 'on' : 'off'}`}><Glyph type={sound ? 'sound' : 'muted'} /><span>SOUND {sound ? 'ON' : 'OFF'}</span></button></div></header>
    <main>
      <div className="intro"><div><h1>Small tanks. Big trouble.</h1><p>An ASCII battlefield. An arcade soul.</p></div><span className="tagline">35 FRONTS. ONE SIGNAL.</span></div>
      <nav className="modebar" aria-label="Game mode"><div className="mode-tabs">{[['campaign', 'CAMPAIGN'], ['endless', 'ENDLESS'], ['custom', 'CONSTRUCTION']].map(([mode, label], index) => <button key={mode} className={game.mode === mode ? 'selected' : ''} aria-pressed={game.mode === mode} onClick={() => switchMode(mode)}><span>{pad(index + 1)}</span> {label}</button>)}</div><div className="run-controls"><button onClick={() => onCommand('restart')} aria-label="Restart run"><Key>R</Key><span>RESTART</span></button><button onClick={() => onCommand('pause')} aria-label={game.status === 'paused' ? 'Resume game' : 'Pause game'} disabled={!['playing', 'paused'].includes(game.status)}><Key>ESC</Key><span>{game.status === 'paused' ? 'RESUME' : 'PAUSE'}</span></button></div></nav>
      <div className="deployment-options"><button className="stage-picker" onClick={() => setStages(true)} disabled={game.status !== 'ready' || game.mode === 'custom'}>▦ STAGE {pad(game.wave)} <span>{game.stageName || 'CHOOSE A FRONT'}</span> <b>⌄</b></button><label className="coop-option"><input type="checkbox" checked={!!game.coop} disabled={!['ready', 'editor'].includes(game.status)} onChange={event => changeCoop(event.target.checked)} />2 PLAYERS <span>LOCAL CO-OP</span></label>{game.mode === 'custom' && game.status !== 'editor' && <button className="edit-map-button" onClick={() => switchMode('custom')}>EDIT MAP ↗</button>}</div>
      <div className="game-layout"><div className="battle-column"><section className="battlefield" aria-label="Game arena"><div className="arena-toolbar"><span>{game.status === 'editor' ? 'CONSTRUCTION / YOUR BATTLEFIELD' : `SECTOR ${pad(game.wave)} / ${game.stageName || ''}`}</span><span className={`system-status ${game.status === 'gameover' ? 'danger' : ''}`}><i />{statusLabel}</span></div>
        {game.status === 'editor' && <div className="editor-tools"><span>BRUSH</span>{BRUSHES.map(([brush, symbol, label]) => <button key={brush} className={game.editorBrush === brush ? 'selected' : ''} aria-pressed={game.editorBrush === brush} aria-label={`Paint ${label.toLowerCase()}`} onClick={() => { game.editorBrush = brush; onUpdate(); }}><b>{symbol}</b><small>{label}</small></button>)}<div className="editor-actions"><button onClick={saveMap}>SAVE</button><button onClick={loadMap}>LOAD</button><button className="test-map" onClick={testMap}>TEST MAP →</button></div></div>}
        <div className="canvas-wrap"><GameCanvas gameRef={gameRef} inputRef={inputRef} sound={sound} onUpdate={onUpdate} onCommand={onCommand} /><Overlay game={game} onCommand={onCommand} onUpgrade={id => { chooseUpgrade(gameRef.current, id); onUpdate(); document.querySelector('canvas')?.focus({ preventScroll: true }); }} /></div></section>
        {game.status === 'editor' && <p className="editor-message" role="status">{editorMessage || 'Drag to paint. Entry roads, HQ and map boundaries stay clear.'}</p>}
        <div className="statusbar" role="status" aria-live="off"><div><span>STAGE</span><strong>{game.mode === 'custom' ? '01' : pad(game.wave)} <small>/ {game.mode === 'campaign' ? '35' : game.mode === 'custom' ? '01' : '∞'}</small></strong></div><div><span>SCORE</span><strong>{pad(game.score, 6)}</strong>{game.combo > 1 && <em>CHAIN {game.combo}</em>}</div><div className="base-status"><span>HQ SIGNAL</span><div className="base-meter" role="meter" aria-label="Base integrity" aria-valuenow={basePercent} aria-valuemin={0} aria-valuemax={100}>{Array.from({ length: 20 }, (_, i) => <i key={i} className={i < Math.ceil(basePercent / 5) ? 'full' : ''} />)}</div><strong className={basePercent <= 30 ? 'danger' : 'lime'}>{basePercent}%</strong></div><div className="uptime"><span>UPTIME</span><strong>{time}</strong></div></div>
        <TouchControls inputRef={inputRef} onCommand={onCommand} active={game.status === 'playing'} />
      </div><MissionPanel game={game} onCommand={onCommand} /></div>
    </main>
    <footer><div className="keyboard-legend"><span>W A S D / ARROWS <b>P1 MOVE</b></span><span>SPACE <b>FIRE</b></span><span>CLICK <b>AIM + FIRE</b></span><span>SHIFT <b>DASH</b></span><span>E <b>EMP</b></span>{game.coop && <span>I J K L · U · O <b>P2</b></span>}</div><span>Inspired by the classics. Rendered in characters.<a href="https://github.com/bas3line/ascii" target="_blank" rel="noreferrer" aria-label="ASCII aesthetic reference by bas3line">↗</a></span></footer>
    {help && <Help onClose={() => setHelp(false)} />}{stages && <StageBrowser current={game.wave} onClose={() => setStages(false)} onSelect={stage => { setRun({ ...runOptions(game), stage }); setStages(false); }} />}
  </div>;
}
