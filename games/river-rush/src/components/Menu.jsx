import React from 'react';
import { KeyLegend } from './Controls.jsx';
import { Icon } from './Icons.jsx';
import LivingScene from './LivingScene.jsx';
export default function Menu({ onStart, onHelp, ready, error, best, active }) {
  return <main className="menu">
    <LivingScene active={active}/>
    <div className="menu-content"><div className="gold-rule"/><h1><span>River</span><br/><span>Rush.</span></h1><p className="tagline">The river doesn’t wait.</p>
      <p className="menu-description">Dodge. Jump. Duck.<br/>Chase the coin streak.</p>
      <button className="primary start" onClick={onStart} disabled={!ready}>{error ? 'Try loading again' : ready ? 'Start run' : 'Preparing the river…'}<Icon name="arrow"/></button>
      <p className="run-description">One more run. One bigger score.</p>
      {error && <p className="load-error" role="alert">The river art couldn’t load. Refresh to try again.</p>}
      <div className="menu-controls"><KeyLegend/><div className="touch-help">Swipe ← → for lanes · ↑ Jump · ↓ Duck</div></div>
    </div>
    <footer className="menu-footer"><span className="best-run">Best run <b>{best ? `${best.score.toLocaleString()} pts` : '—'}</b></span><button className="text-button" onClick={onHelp}>How to play</button><button className="text-button" data-switch>Switch game</button><a className="text-button" href="/">Arcade</a><span className="course-name">THE ENDLESS RIVER</span></footer>
  </main>;
}
