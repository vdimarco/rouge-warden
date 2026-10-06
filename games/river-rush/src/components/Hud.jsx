import React, { useEffect, useState } from 'react';
import { Icon } from './Icons.jsx';
import { GameControls } from './Controls.jsx';
import { queueAction, snapshot } from '../game/engine.js';
import { districtAt } from '../game/districts.js';
export default function Hud({ game, model, input, disabled }) {
  const [live,setLive]=useState(game);
  useEffect(()=>{
    setLive(model.current?snapshot(model.current):game);
    if(disabled)return;
    const interval=setInterval(()=>{if(model.current)setLive(snapshot(model.current));},80);
    return()=>clearInterval(interval);
  },[game,model,disabled]);
  const g=live;
  return <>
    <div className="runner-top" aria-label="Run score"><div className={`score-stat ${g.score>=10000?'long-score':''}`}
><span>SCORE</span><b>{g.score>=1000000?`${(g.score/1000000).toFixed(2)}M`:g.score.toLocaleString().padStart(4,'0')}</b></div><div className="coin-stat"><Icon name="coin"/><b key={g.coins} className="reward-pop">{g.coins>=1000?`${(g.coins/1000).toFixed(1)}k`:g.coins}</b></div><div className="streak-stat"><b key={g.multiplier} className="reward-pop">×{g.multiplier}</b><span>STREAK</span><div className="streak-meter"><i style={{width:`${g.streakTime/2.8*100}%`}}/></div></div></div>
    <div className="runner-distance"><b>{g.distance.toLocaleString()} m</b><span>{districtAt(g.distance).name}</span><small className="run-goal">{g.goal.progress}/{g.goal.target} {g.goal.kind==='distance'?'m':g.goal.kind}<em>CHALLENGE +500</em></small></div>
    <div className="power-status">{g.shield&&<span className="power-pill"><Icon name="shield"/>Shield</span>}{g.magnet>0&&<span className="power-pill magnet"><Icon name="magnet"/>Magnet {Math.ceil(g.magnet)}s</span>}</div>
    {g.notice&&<div className={`runner-notice ${g.rush?'rush-notice':''}`} aria-live="polite" key={g.notice}>{g.notice}</div>}
    {g.time<9&&<div className="opening-tip">{g.time<3?'Swipe or tap to move':g.time<6?'Jump logs. Duck branches.':'Chase the coins. Build your Rush.'}</div>}
    <button className={`rush-button ${g.charge>=100?'rush-ready':''} ${g.rush?'rush-active':''}`} disabled={disabled||g.charge<100||g.rush>0} aria-label="Activate Rush" onClick={()=>queueAction(input.current,'rush')}><Icon name="bolt"/><span><b>{g.rush?'RUSH!':g.charge>=100?'RUSH READY':'BUILD YOUR RUSH'}</b><small>{g.rush?`${g.rush.toFixed(1)}s · Invincible`:g.charge>=100?'Tap or Shift · Smash through':`${Math.floor(g.charge)}% · Coins & tricks charge it`}</small><i className="rush-meter"><i style={{width:`${g.rush?g.rush/4*100:g.charge}%`}}/></i></span></button>
    <GameControls input={input} disabled={disabled}/>
  </>;
}
