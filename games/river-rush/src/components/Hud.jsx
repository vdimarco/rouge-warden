import React, { useEffect, useState } from 'react';
import { Icon } from './Icons.jsx';
import { GameControls } from './Controls.jsx';
import ScoreCapture from './ScoreCapture.jsx';
import GestureGuide from './GestureGuide.jsx';
import { queueAction, snapshot } from '../game/engine.js';
import { COURSE_ACTS,courseAct } from '../game/course-intensity.js';
import { FINISH_RUNWAY } from '../game/levels.js';
export default function Hud({ game, model, input, canvasRef, disabled }) {
  const [live,setLive]=useState(game);
  useEffect(()=>{
    setLive(model.current?snapshot(model.current):game);
    if(disabled)return;
    const refresh=()=>{if(model.current)setLive(snapshot(model.current));};
    const interval=setInterval(refresh,80);
    window.addEventListener('river-rush-contact',refresh);
    return()=>{clearInterval(interval);window.removeEventListener('river-rush-contact',refresh);};
  },[game,model,disabled]);
  const g=live;
  const score=g.campaign?.score??g.score,coins=g.campaign?.coins??g.coins;
  const act=courseAct(g.distance,g.level.length),finishing=g.level.remaining<=FINISH_RUNWAY;
  return <>
    <div className="runner-top" aria-label="Run score"><div className={`score-stat ${score>=10000?'long-score':''}`}
><span>SCORE</span><b>{score>=1000000?`${(score/1000000).toFixed(2)}M`:score.toLocaleString().padStart(4,'0')}</b></div><div className="coin-stat"><Icon name="coin"/><b key={coins} className="reward-pop">{coins>=1000?`${(coins/1000).toFixed(1)}k`:coins}</b></div><div className="streak-stat"><b key={g.multiplier} className="reward-pop">×{g.multiplier}</b><span>STREAK</span><div className="streak-meter"><i style={{width:`${g.streakTime/2.8*100}%`}}/></div></div></div>
    <div className={`runner-distance act-${act} ${finishing?'finish-approach':''}`}><span>MAP {g.level.index+1} / 3 · {g.level.name}</span><b>{g.level.remaining.toLocaleString()} m to finish</b><div className="map-progress" role="progressbar" aria-label="Map progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(g.level.progress*100)}><i style={{width:`${g.level.progress*100}%`}}/></div><small className="course-stage"><i aria-hidden="true">{COURSE_ACTS.map((_,i)=><em key={i} className={i<=act?'reached':''}/>)}</i>{finishing?'Finish straight':g.terrain?.name??COURSE_ACTS[act].title}</small>{!finishing&&g.terrain&&<small className={`terrain-cue terrain-${g.terrain.type}`}><span>{g.terrain.cue}</span>{g.terrain.type==='wave-train'&&g.terrain.comboAvailable&&g.terrain.phase!=='recovery'&&<em>{g.terrain.comboClaimed?'JUMP CHAIN +350':`${g.terrain.comboProgress??0}/3 perfect jumps · +350`}</em>}</small>}<small className="run-goal">{g.goal.progress}/{g.goal.target} {g.goal.kind==='distance'?'m':g.goal.kind}<em>CHALLENGE +500</em></small></div>
    <div className="power-status">{g.shield&&<span className="power-pill"><Icon name="shield"/>Shield</span>}{g.magnet>0&&<span className="power-pill magnet"><Icon name="coin"/>Gold ×2 · {Math.ceil(g.magnet)}s</span>}</div>
    {g.notice&&<div className={`runner-notice ${g.rush?'rush-notice':''}`} aria-live="polite" key={g.notice}>{g.notice}</div>}
<GestureGuide variant="play" active={!disabled} time={g.time} action={g.hint?.type}/><div className="hud-score-capture"><ScoreCapture game={g} canvasRef={canvasRef} compact/></div>
    <button className={`rush-button ${g.charge>=100?'rush-ready':''} ${g.rush?'rush-active':''}`} disabled={disabled||g.charge<100||g.rush>0} aria-label="Activate Rush" onClick={()=>queueAction(input.current,'rush')}><Icon name="bolt"/><span><b>{g.rush?'RUSH!':g.charge>=100?'RUSH READY':'BUILD YOUR RUSH'}</b><small>{g.rush?`${g.rush.toFixed(1)}s · Invincible`:g.charge>=100?'Tap or Shift · Smash through':`${Math.floor(g.charge)}% · Coins & tricks charge it`}</small><i className="rush-meter"><i style={{width:`${g.rush?g.rush/4*100:g.charge}%`}}/></i></span></button>
    <GameControls input={input} disabled={disabled}/>
  </>;
}
