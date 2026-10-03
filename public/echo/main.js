import { MAX_CHICKS, HOME, createRun, step, callFlock, toggleDive, birdPosition, clamp } from './crossing.js';
const $=s=>document.querySelector(s), canvas=$('#game'),ctx=canvas.getContext('2d');
const panel=$('#panel'),call=$('#call'),dive=$('#dive'),controls=$('#controls'),pauseButton=$('#pause'),message=$('#message');
const art={};
for(const name of ['lake','parent','chick','rock','boat','nest','mint-chick']){art[name]=new Image();art[name].src=new URL(`./art/${name}.webp`,import.meta.url).href;}
let W,H,P,offset,run=null,paused=false,last=0,audio,pointer=null,noticeUntil=0,shake=0,particles=[],ripples=[],wobble=[];
const keys=new Set();
function resize(){W=innerWidth;H=innerHeight;P=Math.min(W,H*.78,680);offset=(W-P)/2;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
addEventListener('resize',resize);resize();
function tone(freq=500,len=.12,type='sine',gain=.045){
  try{audio??=new AudioContext();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(freq*.65,audio.currentTime+len);g.gain.setValueAtTime(gain,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+len);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+len);}catch{}
}
function notice(text,len=4){message.textContent=text;noticeUntil=(run?.elapsed||0)+len;}
function start(){run=createRun(Math.floor(Math.random()*0xffffffff));paused=false;pointer=null;keys.clear();particles=[];ripples=[];wobble=[];shake=0;panel.hidden=true;controls.hidden=false;pauseButton.hidden=false;pauseButton.textContent='Ⅱ';pauseButton.setAttribute('aria-label','Pause rescue');last=performance.now();tone(680,.3);audio?.resume().catch(()=>{});notice('Swim to a golden chick. Then lead it back to the nest.',7);updateHud();}
$('#start').onclick=start;
function gather(){if(run&&!paused&&callFlock(run)){tone(880,.4,'triangle');consumeEvents();updateHud();}}
function submerge(){if(run&&!paused&&toggleDive(run)){tone(run.diving?180:550,.2);consumeEvents();updateHud();}}
call.onclick=gather;dive.onclick=submerge;
function steer(e){if(run&&!paused&&!run.ended)run.target={x:clamp((e.clientX-offset)/P,.1,.9),y:clamp(e.clientY/H,.19,.82)};}
canvas.addEventListener('pointerdown',e=>{pointer=e.pointerId;canvas.setPointerCapture(e.pointerId);steer(e);});
canvas.addEventListener('pointermove',e=>{if(pointer===e.pointerId)steer(e);});
for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>pointer=null);
addEventListener('keydown',e=>{
  if(e.key===' '&&(e.target instanceof HTMLButtonElement||e.target instanceof HTMLAnchorElement))return;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','w','a','s','d','e','Escape','p'].includes(e.key))e.preventDefault();
  keys.add(e.key.toLowerCase());
  if(e.key===' '&&!e.repeat)submerge();if(e.key.toLowerCase()==='e'&&!e.repeat)gather();
  if((e.key==='Escape'||e.key.toLowerCase()==='p')&&!e.repeat)togglePause();
});
addEventListener('keyup',e=>{keys.delete(e.key.toLowerCase());if(run&&!pointer&&['arrowleft','arrowright','arrowup','arrowdown','w','a','s','d'].includes(e.key.toLowerCase()))run.target={x:run.x,y:run.y};});
function togglePause(force){
  if(!run||run.ended)return;paused=typeof force==='boolean'?force:!paused;keys.clear();pointer=null;
  pauseButton.textContent=paused?'▶':'Ⅱ';pauseButton.setAttribute('aria-label',paused?'Resume rescue':'Pause rescue');
  if(paused){panel.innerHTML='<span class="eyebrow">TAKE A BREATHER</span><h1>LAKE<br>BREAK</h1><p>The eel can wait.</p><button id="resume">BACK TO THE RESCUE</button>';panel.hidden=false;$('#resume').onclick=()=>togglePause(false);}
  else{panel.hidden=true;last=performance.now();}updateHud();
}
pauseButton.onclick=()=>togglePause();addEventListener('blur',()=>togglePause(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)togglePause(true);});
function finish(){
  let best=0;try{best=Number(localStorage.getItem('loon-echo-rescue-best'))||0;best=Math.max(best,run.score);localStorage.setItem('loon-echo-rescue-best',String(best));}catch{}
  panel.innerHTML=`<span class="eyebrow">${run.won?'EVERY LITTLE WEIRDO ACCOUNTED FOR':'THE EEL HAD OTHER PLANS'}</span><h1>${run.won?'FAMILY<br>REUNION!':'RESCUE<br>INTERRUPTED.'}</h1><div class="result">${run.saved} / ${MAX_CHICKS}</div><p>chicks safe at the nest</p><p><b>${run.score.toLocaleString()} points</b> · ${Math.floor(run.elapsed)} seconds<br>${run.trips} deliver${run.trips===1?'y':'ies'} · Best ${best.toLocaleString()}</p><p class="small">${run.won?'Try fewer trips for bigger delivery bonuses.':'Bank small groups to restore energy. Dive to escape; honk to stun the eel.'}</p><button id="again">RESCUE ANOTHER FAMILY</button>`;
  panel.hidden=false;controls.hidden=true;pauseButton.hidden=true;message.textContent='';$('#again').onclick=start;tone(run.won?920:190,.5,'triangle');
}
function consumeEvents(){for(const e of run.events.splice(0)){
  if(e.text)notice(e.text);
  if(['rescue','bank','fish'].includes(e.kind)){tone(e.kind==='bank'?1100:850,.2);burst(run.x,run.y,'#f8df7c');}
  if(e.kind==='hit'){tone(120,.2,'sawtooth');shake=.3;burst(run.x,run.y,'#edaaeb');}
  if(e.kind==='bonk'){tone(150,.1,'sine',.04);ripple(e.x,e.y,'#d6f3ff');wobble[e.rock]=.35;}
  if(e.kind==='warning')tone(250,.3,'triangle');if(e.kind==='end')finish();
}}
function updateHud(){
  $('#flock').textContent=`${run.saved} / 8 home`;$('#chapter').textContent=run.flock.length?`${run.flock.length} in your tail · ${run.score} pts`:`${8-run.saved} to rescue · ${run.score} pts`;
  $('#hearts').textContent='♥ '.repeat(run.hearts)+'♡ '.repeat(3-run.hearts);$('#hearts').setAttribute('aria-label',`${run.hearts} energy`);
  $('#progress').value=run.saved;$('#breath').value=run.breath;
  $('#breath-label').textContent=run.diving?`BREATH ${run.breath.toFixed(1)}s`:run.exhausted?'CATCH YOUR BREATH':'DIVE BREATH';
  dive.textContent=run.diving?'SURFACE ↑':'DIVE ↓';dive.classList.toggle('active',run.diving);dive.disabled=paused||(!run.diving&&(run.exhausted||run.breath<.8));
  call.disabled=paused||run.diving||run.cooldown>0;call.classList.toggle('active',run.call>0);call.textContent=run.cooldown>0?`HONK ${Math.ceil(run.cooldown)}s`:'HONK';
  message.style.opacity=run.elapsed>noticeUntil?'0':'1';
}
function burst(x,y,color){for(let i=0;i<16;i++)particles.push({x,y,vx:(Math.random()-.5)*.3,vy:(Math.random()-.5)*.2,life:1,color});}
function ripple(x,y,color){ripples.push({x,y,color,life:1});}
const px=x=>offset+x*P;
function ellipse(x,y,rx,ry,color,line='#162732'){ctx.beginPath();ctx.ellipse(x,y,Math.max(0,rx),Math.max(0,ry),0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();if(line){ctx.strokeStyle=line;ctx.lineWidth=2.5;ctx.stroke();}}
function sprite(name,x,y,width,angle=0){const img=art[name];if(!img.complete||!img.naturalWidth)return false;const height=width*img.height/img.width;ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.drawImage(img,-width/2,-height/2,width,height);ctx.restore();return true;}
function label(text,x,y,color='#fff1b3',size=11){ctx.font=`800 ${size}px system-ui`;ctx.textAlign='center';ctx.fillStyle='#123135';ctx.lineWidth=4;ctx.strokeStyle='#123135';ctx.strokeText(text,px(x),y*H);ctx.fillStyle=color;ctx.fillText(text,px(x),y*H);}
function bird(b,index,t,waiting=false){
  const size=index?Math.min(23,P*.056):Math.min(30,P*.074),sx=px(b.x),sy=b.y*H+Math.sin(t*7+index)*1.5,angle=waiting?Math.sin(t*2)*.06:b.angle||0;
  ellipse(sx,sy+5,size*.7,size*.27,'#8becbd30',null);
  if(!index){// the loon gets a light ring that turns with it, so it stands out from the chicks
    ctx.save();ctx.translate(sx,sy);ctx.rotate(angle);for(const [w,c] of [[6,'#0c2a30'],[2.5,'#f2ffe9']]){ctx.lineWidth=w;ctx.strokeStyle=c;ctx.beginPath();ctx.ellipse(0,0,size*.98,size*1.38,0,0,7);ctx.stroke();}ctx.restore();
    ctx.shadowColor='#f2ffe9';ctx.shadowBlur=7;
  }
  if(!sprite(index?(index%2?'chick':'mint-chick'):'parent',sx,sy,size,angle))ellipse(sx,sy,size*.45,size*.6,index?'#efd774':'#b5dddd');
  ctx.shadowBlur=0;
}
function drawBackground(t){
  ctx.fillStyle='#101e25';ctx.fillRect(0,0,W,H);const img=art.lake;
  if(img.complete&&img.naturalWidth){if(offset){ctx.globalAlpha=.18;ctx.drawImage(img,0,0,W,H);ctx.globalAlpha=1;}ctx.drawImage(img,offset,0,P,H);}
  else{ctx.fillStyle='#23534f';ctx.fillRect(offset,0,P,H);}
  ctx.strokeStyle='#b3f1cf21';ctx.lineWidth=1.5;for(let i=0;i<18;i++){const x=px(.17+((i*.137)%.66)),y=((i*79+t*8)%H);ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+9,y+4,x+24,y);ctx.stroke();}
}
function drawEel(t){
  const e=run.eel;if(!e.active)return;
  if(e.phase==='windup'&&!e.stun){ctx.strokeStyle='#ffbc9a';ctx.lineWidth=2;ctx.setLineDash([6,5]);ctx.beginPath();ctx.moveTo(px(e.x),e.y*H);ctx.lineTo(px(e.aim.x),e.aim.y*H);ctx.stroke();ctx.setLineDash([]);label('!',e.x,e.y-.034,'#ffc49d',22);}
  const trail=e.trail;
  ctx.lineCap='round';for(let i=1;i<trail.length;i++){ctx.strokeStyle=i%3?'#977db1':'#d0aad1';ctx.lineWidth=4+i/trail.length*11;ctx.beginPath();ctx.moveTo(px(trail[i-1].x),trail[i-1].y*H);ctx.lineTo(px(trail[i].x),trail[i].y*H);ctx.stroke();}
  ctx.save();ctx.translate(px(e.x),e.y*H);ctx.rotate(e.angle);ellipse(0,0,13,20,e.stun?'#97b4b3':'#b29acb');
  ellipse(-8,-10,7,8,'#fff');ellipse(8,-10,7,8,'#fff');ellipse(-7,-12,2.4,3,e.phase==='lunge'?'#d95642':'#172b30');ellipse(7,-12,2.4,3,'#172b30');ctx.restore();
  if(e.stun>1)label('✦',e.x,e.y-.04,'#d9f592',20);
}
function drawWorld(t){
  ellipse(px(HOME.x),HOME.y*H,P*.12,H*.058,'#a4c98b');sprite('nest',px(HOME.x),HOME.y*H,P*.12);
  label(run.deposit?'UNLOADING…':'SAFE NEST',HOME.x,HOME.y+.067,'#d9f7ab');
  if(run.saved)label(`${run.saved}/8`,HOME.x,HOME.y+.007,'#fff7c7',16);
  run.rocks.forEach((rock,i)=>{const s=P*.13*(1+Math.sin((wobble[i]||0)*40)*(wobble[i]||0)*.12);if(!sprite('rock',px(rock.x),rock.y*H,s))ellipse(px(rock.x),rock.y*H,P*.06,H*.035,'#a78baf');});
  for(const f of run.fish)if(!f.cooldown){ctx.save();ctx.globalAlpha=run.diving?1:.38;ctx.translate(px(f.x),f.y*H);ellipse(0,0,10,5,'#b4f4f0');ctx.fillStyle='#b4f4f0';ctx.beginPath();ctx.moveTo(6,0);ctx.lineTo(16,-7);ctx.lineTo(16,7);ctx.fill();ellipse(-5,-1,1.5,1.5,'#173d46',null);ctx.restore();}
  for(const c of run.chicks)if(c.state==='waiting'){
    ctx.strokeStyle='#ffe594';ctx.lineWidth=2;ctx.setLineDash([3,5]);ctx.beginPath();ctx.arc(px(c.x),c.y*H,Math.min(P*.052,24)+Math.sin(t*4+c.id)*2,0,7);ctx.stroke();ctx.setLineDash([]);bird(c,c.id+1,t,true);
  }
  for(const b of run.boats){
    if(b.age<1.5){label(b.direction>0?'BOAT →':'← BOAT',b.direction>0?.16:.84,b.y,'#ffc3ba',12);ctx.setLineDash([4,7]);ctx.strokeStyle='#efb5b680';ctx.beginPath();ctx.moveTo(px(.12),b.y*H);ctx.lineTo(px(.88),b.y*H);ctx.stroke();ctx.setLineDash([]);}
    else{ctx.save();ctx.translate(px(b.x),b.y*H);ctx.scale(b.direction,1);sprite('boat',0,0,P*.23);ctx.restore();}
  }
  drawEel(t);
  if(run.call>0){ctx.strokeStyle='#d1f48a';ctx.lineWidth=3;ctx.globalAlpha=run.call/2;ctx.beginPath();ctx.ellipse(px(run.x),run.y*H,P*(.07+(2-run.call)*.13),H*(.07+(2-run.call)*.13)/1.65,0,0,7);ctx.stroke();ctx.globalAlpha=1;}
  if(run.diving){ctx.fillStyle='#0a306842';ctx.fillRect(offset,0,P,H);}
  for(let i=run.flock.length;i>=0;i--){const b=birdPosition(run,i);ctx.globalAlpha=run.diving?.4:run.invincible&&Math.floor(t*10)%2?.45:1;bird(b,i,t);ctx.globalAlpha=1;if(run.diving){ellipse(px(b.x)+9,b.y*H-12,3,3,'#b5f1f9',null);ellipse(px(b.x)-7,b.y*H-19,2,2,'#b5f1f9',null);}}
  if(run.diving&&run.breath<.75)label('SURFACING!',run.x,run.y-.055,'#ffd89c',13);
  if(pointer!==null){ctx.strokeStyle='#cdf4c2a0';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(px(run.target.x),run.target.y*H,11,0,7);ctx.stroke();}
}
function draw(ts){
  requestAnimationFrame(draw);const dt=Math.min(.05,(ts-last)/1000||0);last=ts;
  if(run&&!paused&&!run.ended){
    const dx=(keys.has('arrowright')||keys.has('d')?1:0)-(keys.has('arrowleft')||keys.has('a')?1:0);
    const dy=(keys.has('arrowdown')||keys.has('s')?1:0)-(keys.has('arrowup')||keys.has('w')?1:0);
    if(dx||dy)run.target={x:run.x+dx*.2,y:run.y+dy*.12};
    step(run,dt);consumeEvents();updateHud();
  }
  const t=run?.elapsed||ts/1000;drawBackground(t);ctx.save();ctx.beginPath();ctx.rect(offset,0,P,H);ctx.clip();
  if(run){if(!paused)shake=Math.max(0,shake-dt);if(shake)ctx.translate(Math.sin(ts*.07)*shake*12,0);drawWorld(t);
    for(const p of particles){if(!paused){p.life-=dt*1.7;p.x+=p.vx*dt;p.y+=p.vy*dt;}ctx.globalAlpha=Math.max(0,p.life);ellipse(px(p.x),p.y*H,3,3,p.color,null);}particles=particles.filter(p=>p.life>0);ctx.globalAlpha=1;
    for(const w of ripples){if(!paused)w.life-=dt*2.2;ctx.globalAlpha=Math.max(0,w.life);ctx.strokeStyle=w.color;ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(px(w.x),w.y*H,P*(.02+(1-w.life)*.06),P*(.012+(1-w.life)*.036),0,0,7);ctx.stroke();}ripples=ripples.filter(w=>w.life>0);ctx.globalAlpha=1;
    if(!paused)wobble=wobble.map(v=>Math.max(0,v-dt));
  }ctx.restore();
}
requestAnimationFrame(draw);
