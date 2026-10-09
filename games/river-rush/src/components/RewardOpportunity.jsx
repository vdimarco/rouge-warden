import React from 'react';
import { Icon } from './Icons.jsx';

function Direction({ direction }) {
  return direction === 'hold' ? <span className="reward-hold" aria-label="Stay in this lane">—</span> : <Icon name={direction}/>;
}

function StashIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m8 3 4 2 4-2-1 5c3 3 5 5 5 9 0 3-3 4-8 4s-8-1-8-4c0-4 2-6 5-9L8 3Zm1 5h6M9 12l3 2 3-2"/></svg>;
}

export default function RewardOpportunity({ choice, compact = false }) {
  const wildlife = choice.family === 'wildlife-bank', detour = choice.family === 'landing-detour';
  const actionIcon = choice.action === 'jump' ? 'jump' : choice.action === 'duck' ? 'duck' : null;
  const directionText = direction => direction === 'hold' ? 'stay in the same lane' : `move ${direction}`;
  const accessible = choice.collected ? `${choice.stashPoints} stash points collected. ${directionText(choice.returnDirection)}${detour ? `, then ${choice.actionLabel.toLowerCase()} the next guard` : ''}.` : wildlife ?
    `${directionText(choice.actionDirection)} and ${choice.actionLabel.toLowerCase()} for up to ${choice.actionPoints} base points if you touch all guarded gold and earn a perfect clear; after the guard, ${directionText(choice.guardExitDirection)}. Or ${directionText(choice.stashDirection)} for a grounded stash worth ${choice.stashPoints} fixed points; after the stash, ${directionText(choice.returnDirection)}.${choice.cleanAtRisk ? ` Bypassing the guard forfeits the ${choice.cleanAtRisk} clean treasure bonus.` : ''}` :
    `${detour ? 'After landing, ' : 'Before the rock, '}${directionText(choice.stashDirection)} for a grounded stash worth ${choice.stashPoints} fixed points. Then ${directionText(choice.returnDirection)}${detour ? ` and ${choice.actionLabel.toLowerCase()} the next guard` : ' into clear water'}.`;
  return <div className={`reward-opportunity ${compact ? 'reward-opportunity-compact' : ''}`} role="group" aria-label={accessible} data-choice-id={choice.id}>
    {wildlife && !choice.collected && (compact ? <div className="reward-compare-line"><span className="reward-action-line"><Direction direction={choice.actionDirection}/><Icon name={actionIcon}/><b>≤{choice.actionPoints}</b><small>base</small></span><small>or</small><span className="reward-stash-line"><Direction direction={choice.stashDirection}/><StashIcon/><b>+{choice.stashPoints}</b></span></div> : <div className="reward-action-line"><Direction direction={choice.actionDirection}/><Icon name={actionIcon}/><span><b>{choice.actionLabel}</b><small>Up to +{choice.actionPoints} base</small></span></div>)}
    {!(wildlife && compact && !choice.collected) && <div className="reward-stash-line">{choice.collected ? <Icon name="check"/> : <Direction direction={choice.stashDirection}/>}<StashIcon/><b>{choice.collected ? `+${choice.stashPoints} collected` : `+${choice.stashPoints} stash`}</b>{wildlife && !choice.collected && <small>or</small>}</div>}
    {wildlife && !choice.collected ? <div className="reward-return-line"><span>After guard</span><Direction direction={choice.guardExitDirection}/><span>· stash</span><Direction direction={choice.returnDirection}/></div> : <div className="reward-return-line"><span>{detour ? 'Return' : 'Cut back'}</span><Direction direction={choice.returnDirection}/>{detour && actionIcon && <><Icon name={actionIcon}/><b>{choice.actionLabel}</b></>}</div>}
    {!choice.collected && wildlife && choice.cleanAtRisk > 0 && <small className="reward-choice-cost">Bypass loses +{choice.cleanAtRisk} clean</small>}
    {!choice.collected && !wildlife && <small className="reward-choice-cost">{detour ? 'Or keep your line' : 'Or stay in clear water'}</small>}
  </div>;
}
