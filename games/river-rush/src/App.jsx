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
import { createScene } from './game/scene3d.js';
const readBest=()=>{try{return validBest(JSON.parse(localStorage.getItem('river-rush-best')));}catch{return null;}};
export default function App() {
  const [mode,setMode]=useState('menu'),[art,setArt]=useState(null),[error,setError]=useState('');
  const [game,setGame]=useState(null),[best,setBest]=useState(readBest),[sound,setSound]=useState(false);
  const [fallback,setFallback]=useState(false),[graphicsReady,setGraphicsReady]=useState(false);
  const [artAttempt,setArtAttempt]=useState(0);
  const fallbackRef=useRef(false),sceneRef=useRef(null);
  const appRef=useRef(),canvasRef=useRef(),model=useRef(),input=useRef(emptyInput()),pointer=useRef(null),blockedClick=useRef(null),ignoredClicks=useRef(new Set()),resetFrame=useRef(true);
  const modeRef=useRef(mode),audio=useRef(new RiverAudio()),actions=useRef();modeRef.current=mode;
  useEffect(()=>{let alive=true;loadArt().then(a=>{if(alive)setArt(a);}).catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[artAttempt]);
  function retryArt(){setError('');setArtAttempt(value=>value+1);}
  function disableSound(){audio.current.enabled=false;try{audio.current.setEnabled(false);}catch{}setSound(false);}
  function setAudioEnabled(enabled){try{audio.current.setEnabled(enabled);}catch{disableSound();}}
  function cancelGesture(){const gesture=pointer.current;pointer.current=null;if(!gesture)return;blockedClick.current=gesture.id;gesture.button?.blur();try{if(gesture.capture?.hasPointerCapture(gesture.id))gesture.capture.releasePointerCapture(gesture.id);}catch{}}
  function start(){if(!art||!graphicsReady)return;resetFrame.current=true;cancelGesture();input.current=emptyInput();model.current=createGame();setGame(snapshot(model.current));modeRef.current='playing';setMode('playing');setAudioEnabled(sound);}
  function pause(){if(modeRef.current==='playing'){resetFrame.current=true;input.current=emptyInput();cancelGesture();modeRef.current='paused';setMode('paused');}}
  function resume(){resetFrame.current=true;cancelGesture();input.current=emptyInput();modeRef.current='playing';setMode('playing');}
  function home(){resetFrame.current=true;cancelGesture();input.current=emptyInput();modeRef.current='menu';setMode('menu');}
  function switchGames(){home();requestAnimationFrame(()=>window.GameSwitch?.open('river-rush'));}
  function toggleSound(){const enabled=!sound;setSound(enabled);setAudioEnabled(enabled);}
  actions.current={start,pause,resume,ready:!!art&&graphicsReady};
  useEffect(()=>{window.GameSwitch?.wire();if(art&&mode!=='playing')pauseWater(art);if(['menu','help'].includes(mode))document.querySelectorAll('.game-river-video').forEach(clip=>{clip.style.display='none';});},[mode,art]);
  useEffect(()=>{
    if(!art)return;
    const measure=()=>{const r=document.querySelector('.coin-stat svg')?.getBoundingClientRect();if(r)art.coinTarget={x:r.left+r.width/2,y:r.top+r.height/2};};
    measure();window.addEventListener('resize',measure);return()=>window.removeEventListener('resize',measure);
  },[art,mode]);
  useEffect(()=>{
    const context=document.modelContext;if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    function register(name,description,readOnly,execute){try{Promise.resolve(context.registerTool({name,description,inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:readOnly},execute:async value=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length)throw new Error('Expected an empty object.');return execute();}},{signal:lifecycle.signal})).catch(()=>{});}catch{}}
    register('get_run_status','Read the River Rush endless runner status.',true,()=>({screen:modeRef.current,run:model.current?snapshot(model.current):null,renderer:sceneRef.current?.status??{kind:'2d'}}));
    register('start_run','Start or immediately restart the endless river runner.',false,async()=>{if(!actions.current.ready)throw new Error('The river is preparing.');actions.current.start();await new Promise(requestAnimationFrame);return{screen:'playing'};});
    register('pause_run','Pause the active river runner.',false,async()=>{if(modeRef.current!=='playing')throw new Error('No active run.');actions.current.pause();return{screen:'paused'};});
    return()=>lifecycle.abort();
  },[]);
  useEffect(()=>{
    if(!art)return;let alive=true,raf,previous=0,lastTime=-1,lastWidth=0,lastHeight=0,lastReduce=null,lastRun=null,lastCanvas=null,ctx=null,renderFailures=0;
    const pref=window.matchMedia('(prefers-reduced-motion: reduce)');let reduce=pref.matches;const changed=e=>{reduce=e.matches;};pref.addEventListener('change',changed);
    function useFallback(){if(!alive)return;actions.current.pause();fallbackRef.current=true;setFallback(true);setGraphicsReady(true);}
    function tick(now){
      // Keep scheduling independent of graphics and sound: a failed browser
      // resource operation must never leave a playing run without a frame loop.
      raf=requestAnimationFrame(tick);
      const frameMs=previous&&!resetFrame.current?now-previous:0,dt=Math.min(.05,frameMs/1000);previous=now;resetFrame.current=false;
      const canvas=canvasRef.current,w=window.innerWidth,h=window.innerHeight;
      if(canvas!==lastCanvas){
        sceneRef.current?.dispose();sceneRef.current=null;lastCanvas=canvas;lastRun=null;ctx=null;renderFailures=0;
        if(canvas&&!fallbackRef.current){
          setGraphicsReady(false);
          try{
            const scene=createScene(canvas,art,useFallback);sceneRef.current=scene;
            Promise.resolve(scene.prepare?.(w,h,reduce)).then(()=>{
              if(alive&&sceneRef.current===scene&&!fallbackRef.current)setGraphicsReady(true);
            }).catch(()=>{if(alive&&sceneRef.current===scene)useFallback();});
          }catch{useFallback();}
        }else if(canvas)setGraphicsReady(true);
      }
      if(model.current&&!['menu','help'].includes(modeRef.current)){
        const g=model.current,before=g.eventId;
        if(modeRef.current==='playing')updateGame(g,input.current,dt);
        if(g.eventId!==before){try{audio.current.tone(g.event);}catch{disableSound();}}
        const dirty=g!==lastRun||g.time!==lastTime||w!==lastWidth||h!==lastHeight||reduce!==lastReduce;
        if(canvas&&dirty){
          let drawn=false;
          if(sceneRef.current){
            try{sceneRef.current.render(g,w,h,reduce,modeRef.current==='playing'?frameMs:0);renderFailures=0;drawn=true;}
            catch{
              if(++renderFailures===1&&!sceneRef.current.status.contextLost){try{sceneRef.current.recover?.();}catch{useFallback();}}
              else useFallback();
            }
          }
          else if(fallbackRef.current&&fallback){
            const dpr=renderDpr(w,h,window.devicePixelRatio||1),bw=Math.floor(w*dpr),bh=Math.floor(h*dpr);
            if(canvas.width!==bw||canvas.height!==bh){canvas.width=bw;canvas.height=bh;}
            ctx??=canvas.getContext('2d',{alpha:true});
            if(ctx){ctx.setTransform(bw/w,0,0,bh/h,0,0);renderGame(ctx,g,art,w,h,reduce,modeRef.current==='playing');drawn=true;}
          }
          // Retry a failed draw even if the run was paused or its clock did not
          // advance; only a completed frame can satisfy the dirty check.
          if(drawn){lastRun=g;lastTime=g.time;lastWidth=w;lastHeight=h;lastReduce=reduce;}
        }
        if(g.phase==='lost'&&modeRef.current==='playing'){
          setGame(snapshot(g));
          modeRef.current='result';setMode('result');
          setBest(old=>{const value=!old||g.score>old.score?{version:2,score:g.score,distance:Math.floor(g.distance),coins:g.coins}:old;try{localStorage.setItem('river-rush-best',JSON.stringify(value));}catch{}return value;});
        }
      }
    }
    raf=requestAnimationFrame(tick);return()=>{alive=false;cancelAnimationFrame(raf);sceneRef.current?.dispose();sceneRef.current=null;pref.removeEventListener('change',changed);};
  },[art,fallback]);
  useEffect(()=>{
    const mapping={KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',KeyW:'jump',ArrowUp:'jump',Space:'jump',KeyS:'duck',ArrowDown:'duck',ShiftLeft:'rush',ShiftRight:'rush'};
    function down(e){const focusedButton=e.target?.closest?.('button,a');if(modeRef.current==='playing'){if(e.code==='Escape'||e.code==='KeyP'){e.preventDefault();actions.current.pause();return;}if(e.code==='Space'&&focusedButton)return;if(mapping[e.code]){e.preventDefault();if(!e.repeat)queueAction(input.current,mapping[e.code]);}}else if(modeRef.current==='result'&&(e.code==='Enter'||e.code==='KeyR')){if(e.code==='Enter'&&focusedButton)return;e.preventDefault();actions.current.start();}else if(modeRef.current==='paused'&&e.code==='Enter'){if(focusedButton)return;e.preventDefault();actions.current.resume();}}
    function hidden(){if(document.hidden)actions.current.pause();}
    const blur=()=>actions.current.pause();window.addEventListener('keydown',down);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',hidden);
    return()=>{window.removeEventListener('keydown',down);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',hidden);};
  },[]);
  useEffect(()=>{
    const app=appRef.current;
    function down(e){
      if(!e.isPrimary||e.button!==0){if(modeRef.current==='playing'){ignoredClicks.current.add(e.pointerId);if(ignoredClicks.current.size>24)ignoredClicks.current.delete(ignoredClicks.current.values().next().value);}return;}
      ignoredClicks.current.delete(e.pointerId);
      blockedClick.current=null;
      if(modeRef.current!=='playing'||pointer.current)return;
      const button=e.target?.closest?.('button'),capture=button??app;
      pointer.current={id:e.pointerId,button,capture,swipe:{x:e.clientX,y:e.clientY},dragged:false};
      // Keeping tap capture on its button preserves ordinary browser clicks.
      // The app owns capture only after this contact becomes a game gesture.
      try{capture.setPointerCapture(e.pointerId);}catch{}
    }
    function move(e){
      const gesture=pointer.current;if(!gesture||e.pointerId!==gesture.id)return;
      if(modeRef.current!=='playing'){cancelGesture();return;}
      const swipe=readSwipe(gesture.swipe,e.clientX,e.clientY);if(!swipe)return;
      queueAction(input.current,swipe.action);gesture.swipe=swipe.next;gesture.dragged=true;
      e.preventDefault();blockedClick.current=gesture.id;gesture.button?.blur();
      if(gesture.capture!==app){gesture.capture=app;try{app.setPointerCapture(e.pointerId);}catch{}}
    }
    function up(e){
      const gesture=pointer.current;if(!gesture||e.pointerId!==gesture.id)return;
      move(e);pointer.current=null;
      if(gesture.dragged){blockedClick.current=gesture.id;e.preventDefault();}
      try{if(gesture.capture.hasPointerCapture(e.pointerId))gesture.capture.releasePointerCapture(e.pointerId);}catch{}
    }
    function cancelled(e){if(pointer.current?.id===e.pointerId)cancelGesture();}
    function lost(e){if(pointer.current?.id===e.pointerId&&pointer.current.capture===e.target)cancelGesture();}
    function click(e){
      if(e.detail===0)return;
      const secondary=ignoredClicks.current.delete(e.pointerId),drag=blockedClick.current!==null&&(!(e.pointerId>0)||e.pointerId===blockedClick.current);
      e.target?.closest?.('button')?.blur();
      if(secondary||drag){if(drag)blockedClick.current=null;e.preventDefault();e.stopImmediatePropagation();}
    }
    const listeners={pointerdown:down,pointermove:move,pointerup:up,pointercancel:cancelled,lostpointercapture:lost,click};
    for(const [name,listener] of Object.entries(listeners))app.addEventListener(name,listener,{capture:true,passive:false});
    return()=>{cancelGesture();for(const [name,listener] of Object.entries(listeners))app.removeEventListener(name,listener,true);};
  },[]);
  useEffect(()=>{if(mode!=='playing')cancelGesture();},[mode]);
  const inGame=!['menu','help'].includes(mode);
  return <div ref={appRef} className={`app ${inGame?'in-game':''}`} data-paused={inGame&&mode!=='playing'}>
    <canvas key={fallback?'fallback':'webgl'} ref={canvasRef} className="game-canvas" style={{visibility:inGame?'visible':'hidden',pointerEvents:inGame?'auto':'none'}} aria-hidden={!inGame} aria-label="Three-lane river runner. Left and right change lanes, Up or Space jumps, Down ducks, Shift activates Rush."/>
    <header className="app-header"><button className="brand" aria-label="River Rush home" onClick={()=>inGame?pause():home()}><Logo/><span>RIVER RUSH</span></button><div className="header-actions">{inGame&&<button className="circle-button" aria-label="Pause game" onClick={pause}><Icon name="pause"/></button>}<button className="circle-button" aria-label={sound?'Mute sound':'Enable sound'} aria-pressed={sound} onClick={toggleSound}><Icon name={sound?'sound':'muted'}/></button></div></header>
    {!inGame&&<Menu onStart={start} onRetry={retryArt} onHelp={()=>setMode('help')} ready={!!art&&graphicsReady} error={error} best={best} active={mode==='menu'}/>}
    {inGame&&game&&<Hud game={game} model={model} input={input} disabled={mode!=='playing'}/>}
    {mode==='help'&&<Modal label="How to play" onDismiss={home}><button className="modal-close circle-button" aria-label="Close instructions" onClick={home}><Icon name="close"/></button><Icon name="bolt" className="modal-symbol"/><h2>Find your flow.</h2><p>Three lanes. No finish line. How far can you ride?</p><ol className="instructions"><li><b>Dodge · Jump · Duck</b><span>← / → or A / D switch lanes. ↑, W or Space jumps logs. ↓ or S ducks branches. On phones, swipe in any direction or use the buttons.</span></li><li><b>Chase the streak</b><span>Collect eight coins to raise your multiplier, up to ×5. Keep collecting before the streak runs out. Perfect jumps and ducks earn bonus points.</span></li><li><b>Make it a Rush</b><span>Coins and tricks fill your Rush. Press Shift or tap the meter when full: four seconds of speed and invincibility! Magnets pull coins from every lane.</span></li><li><b>Risk. Wipe out. Ride again.</b><span>Your shield absorbs one hit. After that, a collision ends the run. Grab another shield, beat your best, and retry instantly.</span></li></ol><button className="primary" disabled={!art||!graphicsReady} onClick={start}>Let’s ride<Icon name="arrow"/></button></Modal>}
    {mode==='paused'&&<Modal label="Game paused" onDismiss={resume}><Icon name="pause" className="modal-symbol"/><h2>Catch your breath.</h2><p>Your streak will be here.</p><button className="primary" onClick={resume}>Resume run<Icon name="arrow"/></button><div className="modal-secondary"><button onClick={start}>Restart run</button><button onClick={home}>Back to river</button></div><small>← → Lanes · ↑ Jump · ↓ Duck · Shift Rush</small></Modal>}
    {mode==='result'&&game&&<Modal label="Run complete" onDismiss={home}><div className="result-kicker">{best&&game.score>=best.score?'NEW PERSONAL BEST':'ONE MORE RUN?'}</div><h2>What a ride.</h2><p>{game.reason}</p><div className="result-stats"><div><b>{game.score.toLocaleString()}</b><span>POINTS</span></div><div><b>{game.distance.toLocaleString()}m</b><span>DISTANCE</span></div><div><b>{game.coins}</b><span>COINS</span></div></div><p className="result-tricks">{game.jumps} perfect jumps · {game.ducks} perfect ducks</p><button className="primary" onClick={start}>Ride again<Icon name="arrow"/></button><small className="retry-hint">Enter to retry · Best {best?.score.toLocaleString()??'—'}</small><div className="modal-secondary"><button onClick={home}>Back to river</button><button onClick={switchGames}>Switch game</button><a href="/">Arcade</a></div></Modal>}
  </div>;
}
