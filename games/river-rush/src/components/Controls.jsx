import React from 'react';
import { Icon } from './Icons.jsx';
import { queueAction } from '../game/engine.js';
export function KeyLegend() { return <div className="key-legend"><span><kbd>←</kbd><kbd>→</kbd><b>Lanes</b></span><span><kbd>↑</kbd><b>Jump</b></span><span><kbd>↓</kbd><b>Duck</b></span></div>; }
export function GameControls({ input, disabled }) {
  return <div className="runner-controls" aria-label="Runner controls">{[['left','Left lane','←'],['right','Right lane','→'],['jump','Jump','↑'],['duck','Duck','↓']].map(([action,label,key]) => <button key={action} aria-label={label} disabled={disabled} onPointerDown={e=>{e.preventDefault();if(!disabled)queueAction(input.current,action);}} onClick={e=>{if(e.detail===0)queueAction(input.current,action);}}><Icon name={action}/><span>{action==='jump'||action==='duck'?label:key}</span><kbd>{key}</kbd></button>)}</div>;
}
