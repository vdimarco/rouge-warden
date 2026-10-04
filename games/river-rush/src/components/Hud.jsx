import React from 'react';
import { Icon } from './Icons.jsx';
import { GameControls } from './Controls.jsx';
export function formatTime(seconds) { const s = Math.ceil(seconds); return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`; }
export default function Hud({ game, input }) {
  const message = game.falling ? 'Climbing back aboard…' : game.nearKey && game.reaching ? 'Release now to catch the key!' : game.hasKey && !game.unlocked ? 'Hold E to unlock · Keep your balance' : game.unlocked ? game.progress > 0.88 ? 'Escape LEFT between the flags!' : 'Treasure aboard. Pass your rival.' : 'Hold SPACE to reach · Release to catch';
  return <>
    <div className="journey" aria-label="Race objectives"><div className="journey-line"/><div className="journey-fill" style={{ width: `${game.progress * 100}%` }}/>{['KEY', 'CHEST', 'ESCAPE'].map((label, i) => <div key={label} className={`journey-step ${i === 0 || (i === 1 && game.hasKey) || (i === 2 && game.unlocked) ? 'active' : ''}`}><span>{((i === 0 && game.hasKey) || (i === 1 && game.unlocked)) && <Icon name="check"/>}</span><b>{label}</b></div>)}</div>
    <div className="timer" aria-label={`${formatTime(game.remaining)} remaining`}>{formatTime(game.remaining)}</div>
    <div className="race-notice" aria-live="polite">{game.hint}</div>
    <div className="rival-lead"><span>{game.lead >= 0 ? 'YOU LEAD' : 'RIVAL LEADS'}</span><b>{Math.abs(game.lead)} m</b>{game.fast && <em>Fast current</em>}</div>
    <div className={`balance-panel ${game.balance < 35 ? 'danger' : ''}`}><span>BALANCE</span><div className="balance-track"><div style={{ width: `${game.balance}%` }}/></div><small>{game.balance < 35 ? 'Steady the raft!' : 'Stay aboard.'}</small></div>
    <div className={`action-hint ${game.nearKey && game.reaching ? 'catch-ready' : ''}`}><Icon name={game.unlocked ? 'flag' : game.hasKey ? 'chest' : 'key'}/><span>{message}</span>{game.hasKey && !game.unlocked && <div className="unlock-meter" style={{ width: `${game.unlockProgress * 100}%` }}/>}</div>
    <GameControls input={input} hasKey={game.hasKey} unlocked={game.unlocked}/>
  </>;
}
