import React from 'react';
import { Icon } from './Icons.jsx';

export function KeyLegend() {
  return <div className="key-legend"><span><kbd>A</kbd><i>/</i><kbd>D</kbd><b>Steer</b></span><span><kbd>SPACE</kbd><b>Reach</b></span><span><kbd>E</kbd><b>Unlock</b></span></div>;
}

export function GameControls({ input, hasKey, unlocked }) {
  function bind(key) {
    return {
      onPointerDown: e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); input.current[key] = true; },
      onPointerUp: () => { input.current[key] = false; },
      onPointerCancel: () => { input.current[key] = false; },
      onLostPointerCapture: () => { input.current[key] = false; },
      onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.current[key] = true; } },
      onKeyUp: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.current[key] = false; } },
      onBlur: () => { input.current[key] = false; },
    };
  }
  return <div className="game-controls">
    <div className="steer-controls"><button aria-label="Steer left" {...bind('left')}><span className="desktop-key">A</span><Icon name="left" className="touch-icon"/></button><button aria-label="Steer right" {...bind('right')}><span className="desktop-key">D</span><Icon name="right" className="touch-icon"/></button><small>Steer</small></div>
    <div className="action-control"><button aria-label="Hold to reach, release to catch" {...bind('reach')} disabled={hasKey}><span className="desktop-key">SPACE</span><Icon name="key" className="touch-icon"/></button><small>Reach</small></div>
    <div className="action-control"><button aria-label="Hold to unlock the chest" {...bind('unlock')} disabled={!hasKey || unlocked}><span className="desktop-key">E</span><Icon name={unlocked ? 'check' : 'chest'} className="touch-icon"/></button><small>Unlock</small></div>
  </div>;
}
