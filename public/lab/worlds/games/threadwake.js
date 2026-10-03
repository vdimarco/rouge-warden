const TAU=Math.PI*2,G=1200,REACH=200,PX=12,CROWN=1200,PUMP=340,SLOW=.35,START={x:134,y:574};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const metres=y=>Math.max(0,Math.floor((START.y-y)/PX));
// The tower has its own seeded random, so the way you play never changes the layout.
const mulberry=s=>()=>{s=(s+0x6d2b79f5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};
const store={get(k){try{return JSON.parse(globalThis.localStorage?.getItem(k)??'null');}catch{return null;}},set(k,v){try{globalThis.localStorage?.setItem(k,JSON.stringify(v));}catch{}}};
export const RULES={G,REACH,PX,CROWN,START};
// A hold grabs the nearest flower inside the reach ring, but not `skip`: the flower you let go of, while you still rise from it.
// The result is -1 when the ring holds no other flower.
export function grabTarget(p,flowers,reach=REACH,skip=-1){let best=-1,d=reach;flowers.forEach((f,i)=>{const n=dist(f,p);if(i!==skip&&n<=d){d=n;best=i;}});return best;}
// The tower for one seed. Each flower comes from the one below it, so one seed always gives the same tower.
export function makeTower(rand){
  const flowers=[{x:246+rand()*18,y:446-rand()*10,crown:0}],lights=[];let crown=1;
  // The flowers zigzag across the middle, so each swing has room on the side of the next flower.
  function add(){const a=flowers[flowers.length-1],h=(START.y-a.y)/PX,dir=a.x<210?1:-1;
    const x=clamp(a.x+dir*(70+rand()*150),64,356);let y=a.y-(118+rand()*82+Math.min(40,h*.05));
    // Each gap is wider than the reach ring, so every climb needs a swing and a release.
    if(Math.hypot(x-a.x,y-a.y)<REACH+18)y=a.y-Math.sqrt((REACH+18)**2-(x-a.x)**2);
    flowers.push({x,y,crown:START.y-y>=crown*CROWN?crown++:0});
    // Lights hang off the easy arc: high above the line between two flowers, or out past the far one.
    if(rand()<.55){const mx=(a.x+x)/2,my=(a.y+y)/2;lights.push(rand()<.6?{x:clamp(mx+(rand()-.5)*60,30,390),y:my-80-rand()*50,got:false}:{x:clamp(x+(x-a.x)*.45+(rand()-.5)*30,30,390),y:y+30-rand()*60,got:false});}}
  return {flowers,lights,ensure(top){while(flowers[flowers.length-1].y>top)add();}};
}
export default function createGame(api){
  const tw=makeTower(mulberry(Math.floor(api.rng()*4294967296))),{flowers,lights}=tw,best=Number(api.best)||0,key='threadwake-ghosts',seed=`s${api.seed??0}`;
  const ghosts=store.get(key)||{},ghost=Array.isArray(ghosts[seed]?.pts)?ghosts[seed]:null,rec=[],splits=[],bits=[],trail=[];
  const p={x:START.x,y:START.y,vx:0,vy:0};
  let time=0,att=-1,skip=-1,rope=0,ang=0,w=0,taut=false,hold=false,reach=false,ground=true,top=START.y,mistY=START.y+420,mistV=5,camY=0,ended=false;
  let crowns=0,split=null,got=0,grabs=0,creak=0,warn=0,warnT=0,warned=false,recT=0,pulse=0,banner=null,zoom=null,endAt=null,message='',step=0,fastest=0,shown=0;
  const say=t=>{if(t!==message){message=t;api.status(t);}};
  const metric=()=>{shown=metres(top);api.metric(`${shown} m · ${got} ${got===1?'light':'lights'}`);};
  const puff=(x,y,color,n=12,v=120)=>{for(let i=0;i<n;i++){const a=Math.random()*TAU,s=v*(.3+Math.random()*.7);bits.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.4+Math.random()*.5,color});}if(bits.length>180)bits.splice(0,bits.length-180);};
  tw.ensure(-900);say('Hold anywhere to grab the flower. Let go to fly.');metric();
  // The thread goes tight: the creature keeps its speed across the thread and loses its speed along it.
  function tighten(){const f=flowers[att],dx=p.x-f.x,dy=p.y-f.y,d=Math.hypot(dx,dy)||1,out=(p.vx*dx+p.vy*dy)/d;ang=Math.atan2(dx,dy);p.x=f.x+dx/d*rope;p.y=f.y+dy/d*rope;w=(p.vx*Math.cos(ang)-p.vy*Math.sin(ang))/rope;taut=true;
    if(out>260){api.tone(190,.07,'triangle',.06);api.shake?.(2,.12);}}
  function grab(){const i=grabTarget(p,flowers,REACH,skip);
    if(i<0){if(!reach){reach=true;api.tone(250,.08,'sine',.04);if(step>1)say('Keep holding. You grab the next flower that comes into your ring.');}return;}
    const f=flowers[i];reach=false;att=i;rope=clamp(dist(p,f),70,REACH);ground=false;taut=false;pulse=1;grabs++;if(dist(p,f)>=rope-.5)tighten();
    api.tone(330+(i*3%7)*55,.16,'sine',.1);api.tone(660+(i*3%7)*110,.12,'sine',.035,.05);api.buzz?.(12);puff(f.x,f.y,'#c9ffe4',10,90);
    if(step===0){step=1;say('Swing. Let go as you rise, and you fly.');}else if(step===2){step=3;say('Climb above the mist. A crown waits every 100 m.');}}
  function letGo(){reach=false;if(att<0)return;const sp=Math.hypot(p.vx,p.vy);skip=att;att=-1;taut=false;fastest=Math.max(fastest,sp);
    api.noise?.({duration:.3,volume:.05,from:1800,to:420,type:'bandpass',q:1.1});api.tone(200+sp*.3,.09,'triangle',.05);puff(p.x,p.y,'#ffe7b0',8,70);
    if(step===1){step=2;say('Hold again to grab the next flower in your ring.');}}
  function press(){if(ended||hold)return;hold=true;grab();}
  function unpress(){if(!hold)return;hold=false;letGo();}
  // A fixed thread: the creature swings like a pendulum. Its wings beat on each downswing until the swing reaches a set size.
  function swing(ds){const f=flowers[att],c=Math.cos(ang),v=rope*w,lift=f.y-p.y+v*v/(2*G);let a=-G/rope*Math.sin(ang);
    if(c>0&&lift<Math.min(110,rope*.5+15))a+=(Math.abs(w)<.12?((flowers[att+1]?.x??210)>f.x?1:-1):Math.sign(w))*PUMP*c/rope;
    w=(w+a*ds)*Math.exp(-.06*ds);ang+=w*ds;p.x=f.x+rope*Math.sin(ang);p.y=f.y+rope*Math.cos(ang);p.vx=rope*w*Math.cos(ang);p.vy=-rope*w*Math.sin(ang);
    // The creature kicks off a wall, so a swing near a wall keeps most of its speed.
    if(p.x<14&&p.vx<0||p.x>406&&p.vx>0){w=-w*.95;api.tone(150,.06,'sine',.05);puff(p.x,p.y,'#d6f5e6',5,60);}
    // Above the flower and too slow, the thread goes slack and the creature falls free until it goes tight again.
    if(w*w*rope+G*Math.cos(ang)<0)taut=false;
    const sp=Math.abs(v);creak-=ds;if(creak<=0&&sp>60){creak=clamp(28/sp,.09,.32);api.tone(150+sp*.55,.045,'triangle',.022);}}
  // On the island the creature walks back to the tip, where the first flower is in reach.
  function fly(ds){if(ground){p.vy=0;p.vx=clamp((START.x-p.x)*4,-90,90);}else p.vy+=G*ds;
    p.vx*=Math.exp(-.02*ds);p.x+=p.vx*ds;p.y+=p.vy*ds;
    if(p.x<14&&p.vx<0||p.x>406&&p.vx>0){p.vx=-p.vx*.5;p.x=clamp(p.x,14,406);api.tone(150,.06,'sine',.05);}
    if(att>=0&&dist(p,flowers[att])>=rope)tighten();
    // The island holds the creature until the mist covers it.
    if(att<0&&!ground&&p.x<150&&p.vy>0&&p.y>=START.y&&p.y<START.y+40){p.y=START.y;p.vy=0;ground=true;api.tone(180,.07,'sine',.05);}}
  function die(){ended=true;hold=false;reach=false;att=-1;taut=false;const m=metres(top),next=(crowns+1)*100;
    if(m>(ghost?.m??0)){delete ghosts[seed];ghosts[seed]={m,pts:rec.slice(0,7200),splits};const keep=Object.keys(ghosts).slice(-4);store.set(key,Object.fromEntries(keep.map(k=>[k,ghosts[k]])));}
    api.noise?.({duration:.9,volume:.08,from:1100,to:140});api.shake?.(6,.4);api.buzz?.(60);puff(p.x,mistY,'#e7fff5',30,180);metric();say(`The mist caught you at ${m} m.`);
    api.finish({score:m,unit:'m',win:m>best,title:best>0&&m>best?'Your highest climb yet':'The mist caught you',detail:`You climbed ${m} m, passed ${crowns} ${crowns===1?'crown':'crowns'} and caught ${got} ${got===1?'light':'lights'}. The next crown was ${next-m} m above you.`});}
  function update(dt){
    dt=Math.min(dt,.033);if(hold&&reach&&!ended)grab();
    const ds=dt*(reach&&!ground?SLOW:1);time+=ds;pulse=Math.max(0,pulse-dt*2.5);
    if(att>=0&&taut&&!ended)swing(ds);else fly(ds);
    if(ended){p.vx*=Math.exp(-3*ds);p.vy=Math.min(p.vy,140);}
    top=Math.min(top,p.y);if(!ended&&metres(top)!==shown)metric();if(skip>=0&&p.vy>0)skip=-1;
    // The mist speeds up over time, and faster still when you leave it far below.
    mistV=5+time*.36+Math.max(0,mistY-p.y-880)*.6;mistY-=mistV*ds*(ended?.3:1);
    if(!ended){tw.ensure(camY-900);
      for(const l of lights)if(!l.got&&dist(l,p)<26){l.got=true;got++;mistY+=70;api.tone(988,.2,'sine',.08);api.tone(1319,.25,'sine',.06,.06);puff(l.x,l.y,'#fff3c2',18,140);metric();say('A light. The mist sinks a little.');}
      // A crown about every 100 m: a checkpoint that pushes the mist back. The view pulls back for 1 s.
      while(top<=START.y-(crowns+1)*CROWN){crowns++;splits.push(+time.toFixed(2));const g=ghost?.splits?.[crowns-1];split=g==null?null:time-g;banner={k:crowns,diff:split,at:null};zoom={at:null};mistY=Math.max(mistY,START.y-crowns*CROWN+620);
        api.chord?.([392,494,587,784],1.2,'sine',.12);api.slow?.(.4,1);api.buzz?.(30);puff(p.x,p.y,'#ffe2a0',26,160);say(`Crown ${crowns} at ${crowns*100} m. The mist falls back.`);}
      // The warning starts at least 0.85 s before the mist can touch the creature.
      if(att>=0||ground)warn=clamp((120-(mistY-(ground?p.y:flowers[att].y+rope)))/100,0,1);
      else{const v=p.vy+mistV;warn=clamp((.85-(-v+Math.sqrt(Math.max(0,v*v+2*G*(mistY-p.y))))/G)/.6,0,1);}
      warnT-=dt;if(warn>0&&warnT<=0){warnT=.55-.3*warn;api.tone(104,.16,'triangle',.05+.05*warn);api.tone(78,.2,'sine',.05,.09);if(warn>.5)api.buzz?.(15);}
      if(warn>.3&&!warned){warned=true;say('The mist is close. Grab a flower above.');}else if(warn===0)warned=false;
      recT+=ds;while(recT>=.1){recT-=.1;rec.push(Math.round(p.x),Math.round(p.y));}
      if(p.y>mistY+6)die();}
    trail.push({x:p.x,y:p.y});if(trail.length>30)trail.shift();
    for(const b of bits){b.life-=ds;b.x+=b.vx*ds;b.y+=b.vy*ds;b.vy+=160*ds;}for(let i=bits.length-1;i>=0;i--)if(bits[i].life<=0)bits.splice(i,1);
    let want=Math.min(0,p.y-410+clamp(p.vy*.22,-120,60));if(p.y-want>610)want=p.y-610;camY+=(want-camY)*Math.min(1,dt*3.2);
  }
  function drawFlower(ctx,f,i){const on=att===i,crown=f.crown>0,sx=on?0:Math.sin(time*.7+i)*1.5,x=f.x+sx,y=f.y,side=f.x<210?-1:1,wx=side<0?0:420;ctx.globalAlpha=i===skip?.5:1;
    const glow=ctx.createRadialGradient(x,y,0,x,y,crown?64:52);glow.addColorStop(0,crown?'rgba(255,205,120,.28)':'rgba(119,255,207,.17)');glow.addColorStop(1,'rgba(119,255,207,0)');ctx.fillStyle=glow;ctx.fillRect(x-66,y-66,132,132);
    ctx.strokeStyle='#5f9481';ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(wx+side*400,y+58);ctx.lineTo(wx,y+58);ctx.bezierCurveTo(wx-side*70,y+50,x+side*40,y+30,x,y);ctx.stroke();
    for(let j=0;j<2;j++){const t=.45+j*.25,lx=wx+(x-wx)*t,ly=y+58-58*t+8;ctx.fillStyle=j?'#70a58d':'#427f73';ctx.beginPath();ctx.ellipse(lx,ly,13,4,j?-.5:.7,0,TAU);ctx.fill();}
    if(crown){ctx.strokeStyle=crowns>=f.crown?'#ffdc97':'#c9ad78';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,24,Math.PI*.15,Math.PI*.85,true);ctx.stroke();ctx.beginPath();ctx.moveTo(x-22,y+10);ctx.lineTo(x-22,y+26);ctx.moveTo(x+22,y+10);ctx.lineTo(x+22,y+26);ctx.stroke();}
    ctx.save();ctx.translate(x,y);ctx.rotate(time*.15+i);for(let j=0;j<5;j++){ctx.rotate(TAU/5);ctx.fillStyle=crown?'#ffe0a6':'#b9f8d7';ctx.beginPath();ctx.ellipse(0,9,4,11,0,0,TAU);ctx.fill();}ctx.restore();
    ctx.fillStyle=crown?'#ffd99d':'#e2ffe6';ctx.shadowBlur=17;ctx.shadowColor=ctx.fillStyle;ctx.beginPath();ctx.arc(x,y,6,0,TAU);ctx.fill();ctx.shadowBlur=0;
    if(on){ctx.strokeStyle=`rgba(202,255,232,${.35+pulse*.5})`;ctx.lineWidth=1.5+pulse*2;ctx.beginPath();ctx.arc(x,y,26+pulse*14,0,TAU);ctx.stroke();}ctx.globalAlpha=1;}
  function drawCreature(ctx){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(clamp(p.vx/500,-.5,.5));const flap=Math.sin(time*(att>=0?14:8))*4;
    ctx.shadowColor='#ffe6ad';ctx.shadowBlur=17;ctx.fillStyle='#fff2cc';ctx.beginPath();ctx.moveTo(0,-12);ctx.quadraticCurveTo(13,-3,8,7);ctx.quadraticCurveTo(0,16,-8,7);ctx.quadraticCurveTo(-13,-3,0,-12);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='#eed398';ctx.beginPath();ctx.moveTo(-7,2);ctx.quadraticCurveTo(-24,-5,-16,13+flap);ctx.lineTo(-3,9);ctx.fill();ctx.beginPath();ctx.moveTo(7,2);ctx.quadraticCurveTo(24,-5,16,13-flap);ctx.lineTo(3,9);ctx.fill();
    ctx.fillStyle='#37594e';ctx.beginPath();ctx.arc(-3,-1,1.2,0,TAU);ctx.arc(3,-1,1.2,0,TAU);ctx.fill();ctx.restore();}
  function draw(ctx,t){
    if(zoom&&zoom.at==null)zoom.at=t;if(banner&&banner.at==null)banner.at=t;if(ended&&endAt==null)endAt=t;
    // At a crown the view pulls back for 1 s. At the end it pulls back slowly to show the climb.
    let z=1;if(zoom){const u=(t-zoom.at)/1;if(u>=1||u<0)zoom=null;else z=1-.42*Math.sin(Math.PI*u);}
    if(endAt!=null)z=Math.min(z,1-.32*Math.min(1,(t-endAt)/1.2));
    const fy=clamp(p.y-camY,160,600),lo=camY+fy-fy/z-70,hi=camY+fy+(680-fy)/z+70,mh=metres(top);
    ctx.save();
    const shade=ctx.createLinearGradient(0,0,0,680);shade.addColorStop(0,'rgba(3,22,28,.1)');shade.addColorStop(1,'rgba(3,22,28,.5)');ctx.fillStyle=shade;ctx.fillRect(0,0,420,680);
    for(let i=0;i<24;i++){const x=(i*83+Math.sin(time*.3+i)*14+420)%420,y=((i*127-camY*.45)%760+760)%760-40;ctx.globalAlpha=.2+Math.sin(time+i)*.1;ctx.fillStyle='#baffdc';ctx.beginPath();ctx.arc(x,y,1.7,0,TAU);ctx.fill();}ctx.globalAlpha=1;
    ctx.save();ctx.translate(210,fy);ctx.scale(z,z);ctx.translate(-210,-(camY+fy));
    // Height marks every 10 m on the right, with a label every 50 m.
    ctx.textAlign='right';ctx.font='12px system-ui';for(let m=Math.max(0,Math.floor((START.y-hi)/PX/10)*10);START.y-m*PX>lo;m+=10){const y=START.y-m*PX;ctx.fillStyle='rgba(214,244,226,.35)';ctx.fillRect(m%50?410:402,y,m%50?8:16,1.5);if(m%50===0&&m>0&&m%100)ctx.fillText(`${m} m`,398,y+4);}
    for(let k=Math.max(1,Math.floor((START.y-hi)/CROWN));START.y-k*CROWN>lo;k++){const y=START.y-k*CROWN,done=crowns>=k;ctx.strokeStyle=done?'rgba(255,220,151,.55)':'rgba(255,220,151,.3)';ctx.lineWidth=2;ctx.setLineDash([2,6]);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(420,y);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#ffe2b2';ctx.font='600 14px system-ui';ctx.textAlign='right';ctx.fillText(`CROWN · ${k*100} m`,408,y-8);}
    if(best>0){const y=START.y-best*PX;if(y>lo&&y<hi){ctx.strokeStyle='rgba(255,243,206,.55)';ctx.lineWidth=1.5;ctx.setLineDash([8,6]);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(420,y);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#fff3ce';ctx.font='12px system-ui';ctx.textAlign='left';ctx.fillText(`YOUR BEST · ${best} m`,12,y-6);}}
    // Your ghost: the best run on this seed, as a faint dotted thread.
    if(ghost&&!ended){const pts=ghost.pts,n=pts.length/2,gi=time/.1;for(let k=Math.max(0,Math.floor(gi)-14);k<=Math.min(n-1,Math.floor(gi));k++){ctx.fillStyle=`rgba(214,236,255,${.12+.25*(1-(gi-k)/15)})`;ctx.beginPath();ctx.arc(pts[k*2],pts[k*2+1],1.8,0,TAU);ctx.fill();}
      if(gi<n-1){const k=Math.floor(gi),u=gi-k,gx=pts[k*2]+(pts[k*2+2]-pts[k*2])*u,gy=pts[k*2+1]+(pts[k*2+3]-pts[k*2+1])*u;ctx.fillStyle='rgba(214,236,255,.28)';ctx.beginPath();ctx.arc(gx,gy,8,0,TAU);ctx.fill();}}
    const target=!ended&&att<0?grabTarget(p,flowers,REACH,skip):-1;
    flowers.forEach((f,i)=>{if(f.y>lo&&f.y<hi)drawFlower(ctx,f,i);});
    if(target>=0){const f=flowers[target];ctx.strokeStyle='#fff5c6';ctx.lineWidth=1.5;ctx.setLineDash([5,4]);ctx.beginPath();ctx.arc(f.x,f.y,30+Math.sin(time*6)*2,0,TAU);ctx.stroke();ctx.setLineDash([]);}
    for(const l of lights){if(l.got||l.y<lo||l.y>hi)continue;const r=5+Math.sin(time*4+l.x)*1.2,g=ctx.createRadialGradient(l.x,l.y,0,l.x,l.y,30);g.addColorStop(0,'rgba(255,240,180,.55)');g.addColorStop(1,'rgba(255,240,180,0)');ctx.fillStyle=g;ctx.fillRect(l.x-30,l.y-30,60,60);ctx.fillStyle='#fff6d6';ctx.beginPath();ctx.arc(l.x,l.y,r,0,TAU);ctx.fill();}
    // The reach ring: a hold grabs the nearest flower inside it. It glows while time slows for a hold with no flower in reach.
    if(!ended){ctx.strokeStyle=reach?`rgba(255,240,190,${.4+Math.sin(time*12)*.15})`:target>=0?'rgba(202,255,232,.3)':'rgba(202,255,232,.17)';ctx.lineWidth=reach?2.2:1.5;ctx.setLineDash([6,10]);ctx.beginPath();ctx.arc(p.x,p.y,REACH,0,TAU);ctx.stroke();ctx.setLineDash([]);}
    if(att>=0){const f=flowers[att],sag=taut?Math.sin(time*8)*3:Math.max(0,rope-dist(p,f))*.8;ctx.strokeStyle='rgba(190,255,226,.25)';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.quadraticCurveTo((f.x+p.x)/2+(taut?sag:0),(f.y+p.y)/2+(taut?0:sag),f.x,f.y);ctx.stroke();ctx.strokeStyle='#caffdf';ctx.lineWidth=1.2;ctx.stroke();}
    trail.forEach((q,i)=>{ctx.globalAlpha=i/trail.length*.3;ctx.fillStyle='#ffdb9d';ctx.beginPath();ctx.arc(q.x,q.y,1.5+i/trail.length*3,0,TAU);ctx.fill();});ctx.globalAlpha=1;
    drawCreature(ctx);
    for(const b of bits){ctx.globalAlpha=Math.min(1,b.life*2);ctx.fillStyle=b.color;ctx.beginPath();ctx.arc(b.x,b.y,2.2,0,TAU);ctx.fill();}ctx.globalAlpha=1;
    if(START.y+60>lo){ctx.fillStyle='#23494a';ctx.beginPath();ctx.moveTo(0,START.y+14);ctx.bezierCurveTo(40,START.y,103,START.y+2,152,START.y+18);ctx.lineTo(96,START.y+48);ctx.lineTo(34,START.y+42);ctx.closePath();ctx.fill();ctx.strokeStyle='#86c7a6';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,START.y+14);ctx.quadraticCurveTo(80,START.y-4,150,START.y+18);ctx.stroke();
      for(let i=0;i<12;i++){const x=12+i*10;ctx.strokeStyle='#669b89';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x,START.y+10);ctx.quadraticCurveTo(x-6,START.y-4,x+Math.sin(time+i)*3,START.y-6-i%4*2);ctx.stroke();}}
    // At the end, the whole climb shows as one golden thread, and a brighter line runs along it.
    if(ended&&rec.length>4){const line=n=>{ctx.beginPath();ctx.moveTo(rec[0],rec[1]);for(let k=2;k<n;k+=2)ctx.lineTo(rec[k],rec[k+1]);ctx.stroke();};ctx.strokeStyle='rgba(255,222,160,.35)';ctx.lineWidth=2;line(rec.length);
      ctx.strokeStyle='rgba(255,236,190,.85)';ctx.lineWidth=3.5;line(Math.floor(Math.min(1,(t-endAt)/1.3)*rec.length/2)*2);}
    // The mist: a soft wall that rises from below. It turns warm when it gets close.
    if(mistY<hi){const g=ctx.createLinearGradient(0,mistY-30,0,mistY+260);g.addColorStop(0,'rgba(222,244,238,0)');g.addColorStop(.16,`rgba(${222+30*warn|0},${244-24*warn|0},${238-30*warn|0},.6)`);g.addColorStop(1,'rgba(205,232,226,.93)');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-420,hi+400);
      for(let x=-420;x<=840;x+=20)ctx.lineTo(x,mistY-8+Math.sin(x*.03+time*1.3)*7+Math.sin(x*.071-time*.9)*4);ctx.lineTo(840,hi+400);ctx.closePath();ctx.fill();
      ctx.fillStyle='rgba(236,250,246,.22)';for(let i=0;i<9;i++){const x=(i*61+time*(i%2?9:-7)+840)%560-70;ctx.beginPath();ctx.ellipse(x,mistY+6+Math.sin(time+i)*5,46,13,0,0,TAU);ctx.fill();}}
    ctx.restore();
    if(warn>0){const a=warn*(.7+Math.sin(time*14)*.3),g=ctx.createLinearGradient(0,680,0,400);g.addColorStop(0,`rgba(255,160,135,${.55*a})`);g.addColorStop(1,'rgba(255,160,135,0)');ctx.fillStyle=g;ctx.fillRect(0,400,420,280);ctx.strokeStyle=`rgba(255,190,170,${.7*a})`;ctx.lineWidth=3;ctx.strokeRect(1.5,1.5,417,677);}
    const band=ctx.createLinearGradient(0,0,0,70);band.addColorStop(0,'rgba(3,20,24,.5)');band.addColorStop(1,'rgba(3,20,24,0)');ctx.fillStyle=band;ctx.fillRect(0,0,420,70);
    ctx.textAlign='left';ctx.fillStyle='#f2fbf4';ctx.font='600 22px system-ui';ctx.fillText(`${mh} m`,16,34);ctx.font='12px system-ui';ctx.fillStyle='rgba(222,240,230,.75)';ctx.fillText(`Next crown at ${(crowns+1)*100} m`,16,52);
    const below=Math.round((mistY-(camY+680))/PX);if(below>0&&!ended){ctx.textAlign='center';ctx.font=warn>0?'700 14px system-ui':'600 12px system-ui';ctx.fillStyle=warn>0?'#ffe1d8':'rgba(222,244,238,.8)';ctx.fillText(`MIST ${below} m BELOW ↓`,210,666);}
    if(banner&&banner.at!=null){const u=(t-banner.at)/2.4;if(u>=1)banner=null;else{ctx.globalAlpha=Math.min(1,(1-u)*4,u*8);ctx.textAlign='center';ctx.fillStyle='#ffe2b2';ctx.font='600 20px system-ui';ctx.fillText(`CROWN ${banner.k} · ${banner.k*100} m`,210,120);
      if(banner.diff!=null){ctx.font='14px system-ui';ctx.fillStyle=banner.diff<=0?'#d8ffd0':'#ffd7c9';ctx.fillText(`${Math.abs(banner.diff).toFixed(1)} s ${banner.diff<=0?'ahead of':'behind'} your ghost`,210,144);}ctx.globalAlpha=1;}}
    if(step<3&&!ended){ctx.textAlign='center';ctx.font='600 14px system-ui';ctx.fillStyle='rgba(240,252,244,.9)';ctx.fillText(step===0?'HOLD TO GRAB · LET GO TO FLY':step===1?'LET GO AS YOU SWING UP':'HOLD TO GRAB THE NEXT FLOWER',210,640);}
    ctx.restore();
  }
  return {update,draw,
    pointer(type){if(type==='down')press();else if(type==='up'||type==='cancel')unpress();},
    key(type,k){if(![' ','Enter','ArrowUp','w','W'].includes(k))return;if(type==='down')press();else if(type==='up')unpress();},
    getState(){return {game:'threadwake',ended,height:metres(top),time,attached:att,skip,taut,rope,holding:hold,reaching:reach,ground,lights:got,crowns,splits:[...splits],split,mist:mistY,mistSpeed:mistV,warn,ghost:!!ghost,fastest,player:{...p},flowers:flowers.map(f=>({x:f.x,y:f.y,crown:f.crown})),lightList:lights.map(l=>({x:l.x,y:l.y,got:l.got}))};},
    destroy(){}};
}
