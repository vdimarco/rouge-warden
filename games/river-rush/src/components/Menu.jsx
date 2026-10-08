import React from 'react';
import { KeyLegend } from './Controls.jsx';
import { Icon } from './Icons.jsx';
import LivingScene from './LivingScene.jsx';
import GestureGuide from './GestureGuide.jsx';
export default function Menu({ onStart, onRetry, onHelp, ready, error, best, active, levels, progress, selectedLevel, onSelectLevel, onLeaderboard }) {
  return <main className="menu">
    <LivingScene active={active}/>
    <div className="menu-content"><div className="gold-rule"/><h1><span>River</span><br/><span>Rush.</span></h1><p className="tagline">The river doesn’t wait.</p>
      <p className="menu-description">Three rivers. One adventure.<br/>Dodge. Jump. Duck. Reach the finish.</p>
      <button className="primary start" aria-label={error?'Try loading again':'Start run'} onClick={error?onRetry:onStart} disabled={!ready&&!error}>{error ? 'Try loading again' : ready ? `Ride ${levels[selectedLevel].name}` : 'Preparing the river…'}<Icon name="arrow"/></button>
      <p className="run-description">{levels[selectedLevel].length.toLocaleString()} m · {levels[selectedLevel].difficulty} · Map {selectedLevel+1} of 3</p>
      {error && <p className="load-error" role="alert">The river art couldn’t load. Tap above to retry.</p>}
      <div className="map-picker" role="group" aria-label="Choose a river map">{levels.map(level=>{const locked=level.index>progress.unlocked;return <button key={level.id} className={`map-card map-${level.id} ${selectedLevel===level.index?'selected':''}`} style={{'--card-accent':level.accent}} disabled={locked} aria-pressed={selectedLevel===level.index} onClick={()=>onSelectLevel(level.index)}><span className="map-number">0{level.index+1}</span><span className="map-card-copy"><b>{level.name}</b><small>{locked?`Finish map ${level.index} to unlock`:level.subtitle}</small><em>{locked?'LOCKED':`${level.length.toLocaleString()} M · ${level.difficulty}`}</em></span><Icon name={locked?'key':selectedLevel===level.index?'check':'arrow'}/></button>;})}</div><div className="menu-controls"><GestureGuide variant="menu" active={active}/><KeyLegend/><div className="touch-help">Swipe ← → for lanes · ↑ Jump · ↓ Duck</div></div>
    </div>
    <footer className="menu-footer"><span className="best-run">Adventure best <b>{best ? `${best.score.toLocaleString()} pts` : '—'}</b></span><button className="text-button" onClick={onLeaderboard}>Leaderboard</button><button className="text-button" onClick={onHelp}>How to play</button><button className="text-button" data-switch>Switch game</button><a className="text-button" href="/">Arcade</a><span className="course-name">THREE RIVERS · ONE ADVENTURE</span></footer>
  </main>;
}
