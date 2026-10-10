import React from 'react';
import { Icon } from './Icons.jsx';
import { adventureRouteCue, streamPreview } from '../game/adventure-cues.js';
import RewardOpportunity from './RewardOpportunity.jsx';

function Route({ route, side, preview = false, heldShield = false }) {
  const { risk, total, clears, base, bonus, eligible, collected, earned } = adventureRouteCue(route);
  return <div className={`adventure-route ${risk ? 'adventure-risk' : 'adventure-safe'} ${preview ? '' : 'adventure-compact'}`} aria-label={`${side < 0 ? 'Left' : 'Right'} stream: ${route.name}. ${collected ? `${earned} treasure points collected.` : `${base} cache points.${risk ? ` Another ${bonus} points requires ${total} clean unprotected clears, ${clears} completed.${eligible ? '' : ' Clean bonus forfeited.'}` : ' Optional shield or point stash. Taking the stash misses the shield.'}`}`}>
    <b><Icon name={side < 0 ? 'left' : 'right'}/><span>{route.name}</span></b>
    {preview ? <><div className="adventure-prize"><Icon name={collected ? 'check' : 'chest'}/><span>{collected ? `+${earned} collected` : `+${risk && eligible ? base + bonus : base} POINTS`}</span></div>
      <span className="adventure-route-terms">{risk ? `${total} clean actions required` : 'Dodge rocks · smaller cache'}</span>
      <small className="adventure-route-option">{risk ? 'Guarded gold OR 8 coins' : heldShield ? 'Shield held OR +120 points' : 'Shield OR +120 points'}</small>
      <small className="adventure-route-cost">{risk ? `Pouch loses clean +${bonus}` : heldShield ? 'Shields do not stack' : 'Shield skips +120 points'}</small></>
      : <div className="adventure-compact-payoff"><span><Icon name={collected ? 'check' : 'chest'}/>+{collected ? earned : base} {collected ? 'earned' : 'cache'}</span>{risk && !collected && <span className={`compact-clean ${eligible ? '' : 'clean-lost'}`} role="progressbar" aria-label={eligible ? `${bonus} clean treasure bonus` : 'Clean treasure bonus forfeited'} aria-valuemin={0} aria-valuemax={total} aria-valuenow={clears}><b>{eligible ? `+${bonus} clean · ${clears}/${total}` : 'Clean bonus lost'}</b><i aria-hidden="true">{Array.from({ length: total }, (_, i) => <em key={i} className={i < clears ? 'cleared' : ''}/>)}</i></span>}</div>}
  </div>;
}

export default function RiverAdventure({ adventure, islandWarning = false, rewardChoice = null, heldShield = false }) {
  const preview = streamPreview(adventure, islandWarning) && !rewardChoice;
  const selected = adventure.selectedSide < 0 ? adventure.left : adventure.right;
  if (adventure.phase === 'rejoin') return <div className="river-adventure adventure-rejoin" role="group" aria-label="The streams are rejoining. Five lanes ahead after the island.">
    <header><Icon name="check"/><b>STREAMS REJOIN</b></header><span>Five lanes ahead</span>
  </div>;
  return <div className={`river-adventure ${preview ? 'adventure-preview' : 'adventure-selected'} ${islandWarning ? 'adventure-island-warning' : ''}`} role="group" aria-label={preview ? `Choose a river stream before the island${islandWarning ? '. Island ahead: move left or right onto water.' : ''}` : 'Your stream and treasure progress'}>
    {preview ? <><header><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 22v-8c0-5-7-4-7-9M12 14c0-5 7-4 7-9M2 8l3-4 3 4m8 0 3-4 3 4"/></svg><b>CHOOSE YOUR STREAM</b><span>Score or survival?</span></header>
      <div className="adventure-route-options"><Route route={adventure.left} side={-1} preview heldShield={heldShield}/><Route route={adventure.right} side={1} preview heldShield={heldShield}/></div>
      <span className="adventure-island-cue">{islandWarning ? 'ISLAND AHEAD · swipe onto water' : 'Swipe left or right before the island'}</span></>
      : <><Route route={selected} side={adventure.selectedSide} heldShield={heldShield}/>{rewardChoice && <RewardOpportunity choice={rewardChoice}/>}</>}
  </div>;
}
