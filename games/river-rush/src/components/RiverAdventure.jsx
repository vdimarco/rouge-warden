import React from 'react';
import { Icon } from './Icons.jsx';
import { adventureRouteCue, streamPreview } from '../game/adventure-cues.js';
import RewardOpportunity from './RewardOpportunity.jsx';

function Route({ route, side, selected, preview, compact = false }) {
  const { risk, total, clears, base, bonus, eligible, collected, earned } = adventureRouteCue(route);
  if (compact) return <div className={`adventure-route adventure-compact ${risk ? 'adventure-risk' : 'adventure-safe'}`} aria-label={`${route.name}. ${collected ? `${earned} treasure points collected.` : `${base} cache points.${risk ? ` ${clears} of ${total} clean clears; ${eligible ? `${bonus} bonus still available.` : 'clean bonus forfeited.'}` : ''}`}`}>
    <b><Icon name={side < 0 ? 'left' : 'right'}/><span>{route.name}</span></b>
    <div className="adventure-compact-payoff"><span><Icon name={collected ? 'check' : 'chest'}/>+{collected ? earned : base}</span>{risk && !collected && <span className={`compact-clean ${eligible ? '' : 'clean-lost'}`} role="progressbar" aria-label={eligible ? `${bonus} clean treasure bonus` : 'Clean treasure bonus forfeited'} aria-valuemin={0} aria-valuemax={total} aria-valuenow={clears}><b>{eligible ? `+${bonus} clean` : 'Clean lost'}</b><i aria-hidden="true">{Array.from({ length: total }, (_, i) => <em key={i} className={i < clears ? 'cleared' : ''}/>)}</i></span>}</div>
  </div>;
  return <div className={`adventure-route ${risk ? 'adventure-risk' : 'adventure-safe'} ${selected ? 'route-selected' : ''}`} aria-label={`${side < 0 ? 'Left' : 'Right'} stream: ${route.name}. ${collected ? `Treasure collected, ${earned} points.` : `${base} cache points.${risk ? ` Another ${bonus} points requires ${total} clean, unprotected clears; ${clears} completed.${eligible ? '' : ' The clean bonus is no longer available.'}` : ''}`}`}>
    <b><Icon name={side < 0 ? 'left' : 'right'}/><span>{route.name}</span></b>
    <div className="adventure-prize"><Icon name={collected ? 'check' : 'chest'}/><span>{collected ? `+${earned} collected` : `+${base} cache`}</span></div>
    {risk && !collected && <small className={eligible ? '' : 'adventure-base-only'}>{eligible ? `+${bonus} · ${total} clean clears` : 'Base treasure still yours'}</small>}
    {risk && !preview && !collected && <div className="adventure-clear-progress" role="progressbar" aria-label="Clean route clears" aria-valuemin={0} aria-valuemax={total} aria-valuenow={clears}>
      <span aria-hidden="true">{Array.from({ length: total }, (_, i) => <i key={i} className={i < clears ? 'cleared' : ''}/>)}</span><small>{clears}/{total} clean</small>
    </div>}
  </div>;
}

export default function RiverAdventure({ adventure, islandWarning = false, rewardChoice = null }) {
  const preview = streamPreview(adventure, islandWarning);
  const selected = adventure.selectedSide < 0 ? adventure.left : adventure.right;
  if (adventure.phase === 'rejoin') return <div className="river-adventure adventure-rejoin" role="group" aria-label="The streams are rejoining. Five lanes ahead after the island.">
    <header><Icon name="check"/><b>STREAMS REJOIN</b></header><span>Five lanes ahead</span>
  </div>;
  return <div className={`river-adventure ${preview ? 'adventure-preview' : 'adventure-selected'} ${islandWarning ? 'adventure-island-warning' : ''}`} role="group" aria-label={preview ? `Choose a river stream before the island${islandWarning ? '. Island ahead: move left or right onto water.' : ''}` : 'Your stream and treasure progress'}>
    {preview && <header><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 22v-8c0-5-7-4-7-9M12 14c0-5 7-4 7-9M2 8l3-4 3 4m8 0 3-4 3 4"/></svg><b>CHOOSE YOUR STREAM</b></header>}
    {preview ? <><Route route={adventure.left} side={-1} preview compact={!!rewardChoice}/><Route route={adventure.right} side={1} preview compact={!!rewardChoice}/>{rewardChoice ? <RewardOpportunity choice={rewardChoice} compact/> : <span className="adventure-island-cue">{islandWarning ? 'Island ahead · move left or right' : 'Steer around the island'}</span>}</> : <><Route route={selected} side={adventure.selectedSide} selected compact/>{rewardChoice && <RewardOpportunity choice={rewardChoice}/>}</>}
  </div>;
}
