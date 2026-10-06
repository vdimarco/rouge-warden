import React, { useEffect, useRef, useState } from 'react';
import Menu from './components/Menu.jsx';
import Hud from './components/Hud.jsx';
import Modal from './components/Modal.jsx';
import { Logo, Icon } from './components/Icons.jsx';
import { createGame, emptyInput, queueAction, snapshot, updateGame, validBest } from './game/engine.js';
import { loadArt, renderGame } from './game/render.js';
import { RiverAudio } from './game/audio.js';
import { pauseWater } from './game/water.js';
import { renderDpr } from './game/quality.js';
import { readSwipe } from './game/input.js';
const readBest=()=>{try{return validBest(JSON.parse(localStorage.getItem('river-rush-best')));}catch{return null;}};
export default function App() {
  const [mode,setMode]=useState('menu'),[art,setArt]=useState(null),[error,setError]=useState('');
  const [game,setGame]=useState(null),[best,setBest]=useState(readBest),[sound,setSound]=useState(false);
  const canvasRef=useRef(),model=useRef(),input=useRef(emptyInput()),pointer=useRef(null);
  const modeRef=useRef(mode),audio=useRef(new RiverAudio()),actions=useRef();modeRef.current=mode;
  useEffect(()=>{let alive=true;loadArt().then(a=>{if(alive)setArt(a);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[]);
  function start(){if(!art)return;pointer.current=null;input.current=emptyInput();model.current=createGame();setGame(snapshot(model.current));modeRef.current='playing';setMode('playing');audio.current.setEnabled(sound);}
  function pause(){if(modeRef.current==='playing'){input.current=emptyInput();pointer.current=null;modeRef.current='paused';setMode('paused');}}
  function resume(){input.current=emptyInput();modeRef.current='playing';setMode('playing');}
  function home(){input.current=emptyInput();modeRef.current='menu';setMode('menu');}
  function switchGames(){home();requestAnimationFrame(()=>window.GameSwitch?.open('river-rush'));}
  function toggleSound(){const enabled=!sound;setSound(enabled);audio.current.setEnabled(enabled);}
  actions.current={start,pause,resume,ready:!!art};
  useEffect(()=>{window.GameSwitch?.wire();if(art&&mode!=='playing')pauseWater(art);},[mode,art]);
  useEffect(()=>{
    if(!art)return;
    const measure=()=>{const r=document.querySelector('.coin-stat svg')?.getBoundingClientRect();if(r)art.coinTarget={x:r.left+r.width/2,y:r.top+r.height/2};};
    measure();window.addEventListener('resize',measure);return()=>window.removeEventListener('resize',measure);
  },[art,mode]);
  useEffect(()=>{
    const context=document.modelContext;if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    function register(name,description,readOnly,execute){try{Promise.resolve(context.registerTool({name,description,inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:readOnly},execute:async value=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length)throw new Error('Expected an empty object.');return execute();}},{signal:lifecycle.signal})).catch(()=>{});}catch{}}
    register('get_run_status','Read the River Rush endless runner status.',true,()=>({screen:modeRef.current,run:model.current?snapshot(model.current):null}));
    register('start_run','Start or immediately restart the endless river runner.',false,async()=>{if(!actions.current.ready)throw new Error('Art is loading.');actions.current.start();await new Promise(requestAnimationFrame);return{screen:'playing'};});
    register('pause_run','Pause the active river runner.',false,async()=>{if(modeRef.current!=='playing')throw new Error('No active run.');actions.current.pause();return{screen:'paused'};});
    return()=>lifecycle.abort();
  },[]);
  useEffect(()=>{
    if(!art)return;let raf,previous=0,lastTime=-1,lastWidth=0,lastHeight=0,lastReduce=null,lastRun=null;
    const pref=window.matchMedia('(prefers-reduced-motion: reduce)');let reduce=pref.matches;const changed=e=>{reduce=e.matches;};pref.addEventListener('change',changed);
    function tick(now){const dt=previous?Math.min(.05,(now-previous)/1000):0;previous=now;
      if(model.current&&!['menu','help'].includes(modeRef.current)){
        const g=model.current,before=g.eventId;
        if(modeRef.current==='playing')updateGame(g,input.current,dt);
        if(g.eventId!==before)audio.current.tone(g.event);
        const canvas=canvasRef.current,w=window.innerWidth,h=window.innerHeight;
        const dirty=g!==lastRun||g.time!==lastTime||w!==lastWidth||h!==lastHeight||reduce!==lastReduce;
        if(canvas&&dirty){
          const dpr=renderDpr(w,h,window.devicePixelRatio||1),bw=Math.floor(w*dpr),bh=Math.floor(h*dpr);
          if(canvas.width!==bw||canvas.height!==bh){canvas.width=bw;canvas.height=bh;}
          const ctx=canvas.getContext('2d',{alpha:true});ctx.setTransform(bw/w,0,0,bh/h,0,0);
          renderGame(ctx,g,art,w,h,reduce,modeRef.current==='playing');
          lastRun=g;lastTime=g.time;lastWidth=w;lastHeight=h;lastReduce=reduce;
        }
        if(g.phase==='lost'&&modeRef.current==='playing'){
          setGame(snapshot(g));
          modeRef.current='result';setMode('result');
          setBest(old=>{const value=!old||g.score>old.score?{version:2,score:g.score,distance:Math.floor(g.distance),coins:g.coins}:old;try{localStorage.setItem('river-rush-best',JSON.stringify(value));}catch{}return value;});
        }
      }
      raf=requestAnimationFrame(tick);
    }
    raf=requestAnimationFrame(tick);return()=>{cancelAnimationFrame(raf);pref.removeEventListener('change',changed);};
  },[art]);
  useEffect(()=>{
    const mapping={KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',KeyW:'jump',ArrowUp:'jump',Space:'jump',KeyS:'duck',ArrowDown:'duck',ShiftLeft:'rush',ShiftRight:'rush'};
    function down(e){if(modeRef.current==='playing'){if(e.code==='Escape'||e.code==='KeyP'){e.preventDefault();actions.current.pause();return;}if(mapping[e.code]){e.preventDefault();if(!e.repeat)queueAction(input.current,mapping[e.code]);}}else if(modeRef.current==='result'&&(e.code==='Enter'||e.code==='KeyR')){e.preventDefault();actions.current.start();}else if(modeRef.current==='paused'&&e.code==='Enter'){e.preventDefault();actions.current.resume();}}
    function hidden(){if(document.hidden)actions.current.pause();}
    const blur=()=>actions.current.pause();window.addEventListener('keydown',down);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',hidden);
    return()=>{window.removeEventListener('keydown',down);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',hidden);};
  },[]);
  function swipe(e){if(modeRef.current!=='playing')return;const swipe=readSwipe(pointer.current,e.clientX,e.clientY);if(!swipe)return;queueAction(input.current,swipe.action);pointer.current=swipe.next;}
  const inGame=!['menu','help'].includes(mode);
  return <div className={`app ${inGame?'in-game':''}`} data-paused={inGame&&mode!=='playing'}>
    {inGame&&<canvas ref={canvasRef} className="game-canvas" aria-label="Three-lane river runner. Left and right change lanes, Up or Space jumps, Down ducks, Shift activates Rush." onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);pointer.current={x:e.clientX,y:e.clientY};}} onPointerMove={swipe} onPointerUp={e=>{swipe(e);pointer.current=null;}} onPointerCancel={()=>{pointer.current=null;}}/>}
    <header className="app-header"><button className="brand" aria-label="River Rush home" onClick={()=>inGame?pause():home()}><Logo/><span>RIVER RUSH</span></button><div className="header-actions">{inGame&&<button className="circle-button" aria-label="Pause game" onClick={pause}><Icon name="pause"/></button>}<button className="circle-button" aria-label={sound?'Mute sound':'Enable sound'} aria-pressed={sound} onClick={toggleSound}><Icon name={sound?'sound':'muted'}/></button></div></header>
    {!inGame&&<Menu onStart={start} onHelp={()=>setMode('help')} ready={!!art} error={error} best={best} active={mode==='menu'}/>}
    {inGame&&game&&<Hud game={game} model={model} input={input} disabled={mode!=='playing'}/>}
    {mode==='help'&&<Modal label="How to play" onDismiss={home}><button className="modal-close circle-button" aria-label="Close instructions" onClick={home}><Icon name="close"/></button><Icon name="bolt" className="modal-symbol"/><h2>Find your flow.</h2><p>Three lanes. No finish line. How far can you ride?</p><ol className="instructions"><li><b>Dodge · Jump · Duck</b><span>← / → or A / D switch lanes. ↑, W or Space jumps logs. ↓ or S ducks branches. On phones, swipe in any direction or use the buttons.</span></li><li><b>Chase the streak</b><span>Collect eight coins to raise your multiplier, up to ×5. Keep collecting before the streak runs out. Perfect jumps and ducks earn bonus points.</span></li><li><b>Make it a Rush</b><span>Coins and tricks fill your Rush. Press Shift or tap the meter when full: four seconds of speed and invincibility! Magnets pull coins from every lane.</span></li><li><b>Risk. Wipe out. Ride again.</b><span>Your shield absorbs one hit. After that, a collision ends the run. Grab another shield, beat your best, and retry instantly.</span></li></ol><button className="primary" disabled={!art} onClick={start}>Let’s ride<Icon name="arrow"/></button></Modal>}
    {mode==='paused'&&<Modal label="Game paused" onDismiss={resume}><Icon name="pause" className="modal-symbol"/><h2>Catch your breath.</h2><p>Your streak will be here.</p><button className="primary" onClick={resume}>Resume run<Icon name="arrow"/></button><div className="modal-secondary"><button onClick={start}>Restart run</button><button onClick={home}>Back to river</button></div><small>← → Lanes · ↑ Jump · ↓ Duck · Shift Rush</small></Modal>}
    {mode==='result'&&game&&<Modal label="Run complete" onDismiss={home}><div className="result-kicker">{best&&game.score>=best.score?'NEW PERSONAL BEST':'ONE MORE RUN?'}</div><h2>What a ride.</h2><p>{game.reason}</p><div className="result-stats"><div><b>{game.score.toLocaleString()}</b><span>POINTS</span></div><div><b>{game.distance.toLocaleString()}m</b><span>DISTANCE</span></div><div><b>{game.coins}</b><span>COINS</span></div></div><p className="result-tricks">{game.jumps} perfect jumps · {game.ducks} perfect ducks</p><button className="primary" onClick={start}>Ride again<Icon name="arrow"/></button><small className="retry-hint">Enter to retry · Best {best?.score.toLocaleString()??'—'}</small><div className="modal-secondary"><button onClick={home}>Back to river</button><button onClick={switchGames}>Switch game</button><a href="/">Arcade</a></div></Modal>}
  </div>;
}
