// Foldwild. Turn paper panels to lead a river from the spring to home before the water gets there.
// Each path home adds time, and the next sheet of paper slides in below. The run ends when the clock runs out.
const TAU=Math.PI*2;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
const DIR=[[0,-1],[1,0],[0,1],[-1,0]];
// A straight piece joins opposite edges. A corner piece joins two edges that meet.
const BASE={straight:[1,3],corner:[0,1]};
// The water plays the next note of this scale in each panel it enters.
const SCALE=[392,440,523.25,587.33,659.25,783.99,880,1046.5,1174.66,1318.51,1567.98,1760,2093];
export const RULES={START:100,BONUS:15,SPILL:3,REFILL:2,WARN:.5,RUSH:3.5,HOP:1.5,PAN:.8};
const {START,BONUS,SPILL,REFILL,WARN,RUSH,HOP,PAN}=RULES,GUTTER=120,CX=210,CY=326,MOUTH=24;
// Sheet k has [columns, rows, panel size]. The water gets faster and waits less on each new sheet.
const SHEETS=[[3,3,96],[3,3,96],[3,4,92],[3,4,92],[3,5,82],[3,5,82],[4,5,72],[4,5,72],[4,6,68]];
// In the outro the light starts after LIGHT[0] seconds and takes LIGHT[1] seconds to run the whole river.
const LIGHT=[.1,.62];
export const speedOf=k=>Math.min(2.2,.36*Math.pow(1.2,k)),waitOf=k=>Math.max(1,5-k*.55);
const calm=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
export default function createGame(api){
  const rng=api.rng,boards=[],timers=[],popups=[];
  let b,n=0,time=0,remaining=START,paths=0,gardens=0,moves=0,spills=0,over=false,outro=0,shake=0,flash=0,flashColor='#bff5c8',pulse=0;
  let held=null,cursor=-1,hop=null,pan=null,camera={x:CX,y:CY,s:1},lastSecond=START,message='',said=false,shown='',slow=null,light=null;
  const later=(t,fn)=>timers.push({t,fn});
  // Slow motion uses the shell when it can. Otherwise the game slows its own clock.
  const slowmo=(f,d)=>{if(api.slow)api.slow(f,d);else if(!calm)slow={f,left:d};};
  const say=t=>{if(t!==message){message=t;api.status(t);}};
  const metric=()=>{const next=`${paths} ${paths===1?'path':'paths'} · ${Math.ceil(remaining)} s`;if(next!==shown){shown=next;api.metric(next);}};
  const ports=(t,r=t.rotation)=>BASE[t.kind].map(d=>(d+r)%4);
  const fits=(t,r,a,o)=>{const p=ports(t,r);return p.includes(a)&&p.includes(o);};
  const corner=(bd,i)=>({x:bd.ox+(i%bd.cols)*(bd.size+bd.gap),y:bd.oy+Math.floor(i/bd.cols)*(bd.size+bd.gap)});
  const mid=(bd,i)=>{const p=corner(bd,i);return {x:p.x+bd.size/2,y:p.y+bd.size/2};};
  const edge=(bd,i,d,out=0)=>{const c=mid(bd,i),r=bd.size/2+out;return {x:c.x+DIR[d][0]*r,y:c.y+DIR[d][1]*r};};
  const step=(bd,i,d)=>{const r=Math.floor(i/bd.cols)+DIR[d][1],c=i%bd.cols+DIR[d][0];return r<0||r>=bd.rows||c<0||c>=bd.cols?-1:r*bd.cols+c;};
  const toward=(bd,i,j)=>[0,1,2,3].find(d=>step(bd,i,d)===j);
  const screen=w=>({x:(w.x-camera.x)*camera.s+CX,y:(w.y-camera.y)*camera.s+CY});
  const world=p=>({x:(p.x-CX)/camera.s+camera.x,y:(p.y-CY)/camera.s+camera.y});
  const burst=(w,color,count)=>{const p=screen(w);api.burst(p.x,p.y,color,count);};
  const popup=(w,text,color)=>popups.push({x:w.x,y:w.y,text,color,t:0});
  const bez=(A,C,B,u)=>{const q=1-u;return {x:q*q*A.x+2*q*u*C.x+u*u*B.x,y:q*q*A.y+2*q*u*C.y+u*u*B.y};};
  const focus=bd=>({x:CX,y:bd.oy+bd.h/2,s:1});

  // A random path that never crosses itself, from one cell to another, at least minLen cells long.
  function walk(bd,from,to,minLen){
    const seen=new Set([from]),path=[from];let steps=0;
    const go=i=>{if(++steps>4000)return false;if(i===to)return path.length>=minLen;
      const next=[0,1,2,3].map(d=>step(bd,i,d)).filter(j=>j>=0&&!seen.has(j));
      for(let k=next.length-1;k>0;k--){const j=Math.floor(rng()*(k+1));[next[k],next[j]]=[next[j],next[k]];}
      for(const j of next){seen.add(j);path.push(j);if(go(j))return true;path.pop();seen.delete(j);}return false;};
    return go(from)?path:null;
  }
  // Each sheet comes from the seed: a spring edge, a home edge, a path between them, decoys, and three gardens on the path.
  // Later sheets are bigger, with longer paths, faster water and a shorter wait.
  function makeBoard(k,prev){
    const [cols,rows,size]=SHEETS[Math.min(k,SHEETS.length-1)],gap=6,w=cols*size+(cols-1)*gap,h=rows*size+(rows-1)*gap,minLen=Math.min(Math.floor(rows*cols*.75),5+k);
    const bd={k,rows,cols,size,gap,w,h,ox:(420-w)/2,oy:prev?prev.oy+prev.h+GUTTER:0,speed:speedOf(k),front:0,entered:0,leak:null,spills:0,done:false,final:null,link:null};
    bd.wait=bd.maxWait=waitOf(k)+(prev?PAN:0);
    for(;;){
      bd.spring=rng()<.6?{cell:Math.floor(rng()*cols),dir:0}:rng()<.5?{cell:0,dir:3}:{cell:cols-1,dir:1};
      bd.home=rng()<.6?{cell:(rows-1)*cols+Math.floor(rng()*cols),dir:2}:rng()<.5?{cell:(rows-1)*cols,dir:3}:{cell:rows*cols-1,dir:1};
      const path=walk(bd,bd.spring.cell,bd.home.cell,minLen);if(!path)continue;
      const need=path.map((c,j)=>[j?toward(bd,c,path[j-1]):bd.spring.dir,j<path.length-1?toward(bd,c,path[j+1]):bd.home.dir]);
      bd.tiles=Array.from({length:rows*cols},(_,i)=>({i,kind:rng()<.6?'corner':'straight',rotation:0,angle:0,nudge:0,water:0,shown:0,flower:0,garden:false,bloomed:false,locked:false}));
      path.forEach((c,j)=>bd.tiles[c].kind=(need[j][0]+2)%4===need[j][1]?'straight':'corner');
      const picks=new Set();for(let g=0;g<3;g++){let j=clamp(Math.floor((g+.5)*path.length/3)+Math.floor(rng()*3)-1,0,path.length-1);while(picks.has(j))j=(j+1)%path.length;picks.add(j);}
      picks.forEach(j=>bd.tiles[path[j]].garden=true);
      // Scramble the panels. Keep the sheet only if it starts broken, with at least half of the path turned wrong.
      for(let tries=0;tries<40;tries++){bd.tiles.forEach(t=>t.rotation=Math.floor(rng()*4));const wrong=path.filter((c,j)=>!fits(bd.tiles[c],bd.tiles[c].rotation,need[j][0],need[j][1])).length;if(wrong>=Math.ceil(path.length/2)&&trace(bd).end!=='home')return bd;}
    }
  }
  // Follow the river from the spring through every joined edge. end is 'home', 'edge' (off the sheet) or 'blocked'.
  function trace(bd,pi=-1,pr=0){
    const path=[],seen=new Set();let i=bd.spring.cell,a=bd.spring.dir,end='blocked';
    while(!seen.has(i)){const t=bd.tiles[i],p=ports(t,i===pi?pr:t.rotation);if(!p.includes(a))break;seen.add(i);const o=p[0]===a?p[1]:p[0];path.push({i,a,o});const j=step(bd,i,o);if(j<0){end=i===bd.home.cell&&o===bd.home.dir?'home':'edge';break;}i=j;a=(o+2)%4;}
    return {path,end};
  }
  const spillAt=(bd,tr)=>{const l=tr.path[tr.path.length-1];return l?edge(bd,l.i,l.o):edge(bd,bd.spring.cell,bd.spring.dir);};
  // The water channel between two sheets: out of the home gate, along the margin and the gutter, into the next spring.
  function connector(a,c){const P=edge(a,a.home.cell,a.home.dir),P1=edge(a,a.home.cell,a.home.dir,MOUTH),gy=a.oy+a.h+GUTTER/2,Q=edge(c,c.spring.cell,c.spring.dir),Q1=edge(c,c.spring.cell,c.spring.dir,MOUTH);return [P,P1,{x:P1.x,y:gy},{x:Q1.x,y:gy},Q1,Q];}
  const length=pts=>pts.slice(1).reduce((s,p,j)=>s+Math.hypot(p.x-pts[j].x,p.y-pts[j].y),0);
  function along(pts,u){let d=length(pts)*u;for(let j=1;j<pts.length;j++){const a=pts[j-1],c=pts[j],l=Math.hypot(c.x-a.x,c.y-a.y);if(d<=l||j===pts.length-1){const f=l?Math.min(1,d/l):0;return {x:a.x+(c.x-a.x)*f,y:a.y+(c.y-a.y)*f};}d-=l;}return pts[0];}

  const warnSound=()=>{api.tone(988,.06,'square',.045);later(.16,()=>api.tone(988,.06,'square',.045));};
  // The water waits, then moves along the joined river. A panel that holds water locks.
  // When the river ends at an open edge, the edge flashes and drips WARN seconds before the water spills there.
  function flow(dt){
    const bd=b,tr=trace(bd),L=tr.path.length;
    if(bd.wait>0){const was=Math.ceil(bd.wait);bd.wait-=dt;if(bd.wait<=0){api.tone(330,.3,'sine',.06);later(.08,()=>api.tone(494,.3,'sine',.05));say('The water is coming. Keep the river joined ahead of it.');}else if(Math.ceil(bd.wait)<was&&was<=3)api.tone(660,.05,'sine',.04);return;}
    if(bd.front>L){bd.front=L;bd.entered=Math.min(bd.entered,L);}
    const v=tr.end==='home'?Math.max(RUSH,bd.speed):bd.speed;bd.front=Math.min(L,bd.front+v*dt);
    while(bd.entered<L&&bd.front>bd.entered){api.tone(SCALE[Math.min(SCALE.length-1,bd.entered)],.24,'sine',.07);bd.entered++;}
    const at=new Map(tr.path.map((s,j)=>[s.i,j]));
    for(const t of bd.tiles){const j=at.get(t.i);t.water=j===undefined?0:clamp(bd.front-j,0,1);t.locked=t.water>.5;}
    const open=tr.end!=='home';
    if(open&&(L-bd.front)/v<=WARN+1e-9){
      if(!bd.leak){bd.leak={t:0};warnSound();say('The water will spill. Join the next panel.');}else bd.leak.t+=dt;
      if(bd.leak.t>=WARN&&bd.front>=L-1e-6)spill(bd,tr);
    }else bd.leak=null;
    if(!open&&bd.front>=L-1e-6)cross(bd,tr);
  }
  // A spill costs SPILL seconds. The water drains back to the spring and every panel unlocks, so no sheet can trap the player.
  function spill(bd,tr){
    remaining=Math.max(0,remaining-SPILL);spills++;bd.spills++;bd.leak=null;bd.front=0;bd.entered=0;bd.wait=bd.maxWait=REFILL;
    for(const t of bd.tiles){t.water=0;t.locked=false;}
    const S=spillAt(bd,tr);burst(S,'#a5e7f2',18);popup({x:S.x,y:S.y-16},`−${SPILL} s`,'#ffb39c');
    api.tone(110,.28,'sawtooth',.06);api.tone(82,.34,'sine',.09);shake=1;flash=1;flashColor='#ff8a6a';
    say(`The water spilled. You lost ${SPILL} seconds, and it starts again from the spring.`);
  }
  function cross(bd,tr){
    paths++;remaining+=BONUS;bd.done=true;bd.final=tr;bd.leak=null;
    const H=edge(bd,bd.home.cell,bd.home.dir,MOUTH);burst(H,'#ffe6a6',22);popup({x:H.x,y:H.y-22},`+${BONUS} s`,'#c9f7cf');if(!bd.spills)popup({x:H.x,y:H.y-44},'CLEAN','#fff1a8');
    [523.25,659.25,783.99,1046.5].forEach((f,j)=>later(j*.07,()=>api.tone(f,.42,'sine',.075)));flash=1;flashColor='#bff5c8';slowmo(.35,.45);
    const next=makeBoard(n+1,bd);next.link=connector(bd,next);boards.push(next);hop={t:0,pts:next.link};pan={from:{...camera},to:focus(next),t:0,dur:PAN};
    b=next;n++;held=null;cursor=-1;
    say(`Path ${paths} crossed. You gain ${BONUS} seconds.`);
  }
  function end(){
    over=true;held=null;cursor=-1;popups.length=0;const k=trace(b).path.length,pl=k===1?'panel':'panels';
    api.finish({score:paths,unit:'paths',win:paths>0,title:paths?'The spring ran dry':'The water found no way home',
      detail:paths?`You crossed ${paths} ${paths===1?'path':'paths'} and grew ${gardens} ${gardens===1?'garden':'gardens'}. On path ${n+1} the river joined ${k} ${pl}.`:`The river joined ${k} ${pl} before the clock ran out. Turn each panel so its river meets the next one.`});
    // The outro pulls back to show every sheet. A light runs down the whole river and rings a note at each home it passes.
    const top=boards[0].oy-70,bottom=b.oy+b.h+60,s=Math.min(1,540/(bottom-top));pan={from:{...camera},to:{x:CX,y:(top+bottom)/2,s},t:0,dur:.6};
    light=journey();const total=light.len=length(light.pts)||1;
    light.homes.forEach((d,j)=>later(LIGHT[0]+LIGHT[1]*d/total,()=>api.tone(SCALE[Math.min(SCALE.length-1,2+j*2)],.5,'sine',.07)));
    if(!paths)[523.25,392].forEach((f,j)=>later(.1+j*.16,()=>api.tone(f,.5,'sine',.06)));
  }
  // Every point the water passed, from the first spring to the last water, and the distance along it to each home gate.
  function journey(){
    const pts=[],homes=[];
    for(const bd of boards){
      if(bd.link)pts.push(...bd.link.slice(2));else pts.push(edge(bd,bd.spring.cell,bd.spring.dir,MOUTH),edge(bd,bd.spring.cell,bd.spring.dir));
      const tr=bd.final||trace(bd),L=bd.done?tr.path.length:Math.min(tr.path.length,Math.ceil(bd.front));
      for(let j=0;j<L;j++){const s=tr.path[j],A=edge(bd,s.i,s.a),C=mid(bd,s.i),B=edge(bd,s.i,s.o);for(let q=1;q<=6;q++)pts.push(bez(A,C,B,q/6));}
      if(bd.done){pts.push(edge(bd,bd.home.cell,bd.home.dir,MOUTH));homes.push(length(pts));}
    }
    return {pts,homes};
  }
  // Turn a panel. A panel that holds water does not turn. Joining or breaking the river makes its own sound.
  function fold(i,r){
    const t=b.tiles[i];if(over||!t)return false;
    if(t.water>.5){t.nudge=1;api.tone(150,.08,'square',.05);say('Water holds this panel. It cannot turn now.');return false;}
    const was=trace(b);t.rotation=((r%4)+4)%4;t.angle=1;moves++;const now=trace(b),c=mid(b,i);
    api.tone(300+(i%b.cols)*24+Math.floor(i/b.cols)*12,.07,'triangle',.07);burst({x:c.x+b.size*.3,y:c.y+b.size*.3},'#f8e5b9',5);
    if(now.end==='home'&&was.end!=='home'){[659.25,783.99,1046.5].forEach((f,j)=>later(.05+j*.06,()=>api.tone(f,.3,'sine',.07)));say('The river reaches home. The water rushes there.');}
    else if(now.path.length>was.path.length){later(.04,()=>api.tone(659.25,.09,'sine',.065));later(.11,()=>api.tone(880,.13,'sine',.065));}
    else if(now.path.length<was.path.length){later(.04,()=>api.tone(330,.1,'triangle',.07));later(.12,()=>api.tone(247,.15,'triangle',.06));}
    return true;
  }
  const hit=(p,slack=3)=>{const w=world(p);return b.tiles.findIndex(t=>{const c=corner(b,t.i);return w.x>=c.x-slack&&w.x<=c.x+b.size+slack&&w.y>=c.y-slack&&w.y<=c.y+b.size+slack;});};

  function txt(ctx,s,x,y,size,color,align='center',weight=600,outline=0){ctx.font=`${weight} ${size}px system-ui, sans-serif`;ctx.textAlign=align;if(outline){ctx.lineJoin='round';ctx.lineWidth=outline;ctx.strokeStyle='rgba(10,24,28,.85)';ctx.strokeText(s,x,y);}ctx.fillStyle=color;ctx.fillText(s,x,y);}
  function sheet(ctx,x,y,s,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.moveTo(x+4,y);ctx.lineTo(x+s-4,y+3);ctx.lineTo(x+s,y+s-5);ctx.lineTo(x+1,y+s);ctx.closePath();ctx.fill();}
  function curve(ctx,A,C,B,u1){ctx.beginPath();for(let k=0;k<=12;k++){const p=bez(A,C,B,u1*k/12);k?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}}
  function river(ctx,bd,t,rot,alpha,dashed){
    const pp=ports(t,rot),c=mid(bd,t.i),A=edge(bd,t.i,pp[0]),B=edge(bd,t.i,pp[1]);ctx.globalAlpha=alpha;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.quadraticCurveTo(c.x,c.y,B.x,B.y);
    if(dashed){ctx.strokeStyle='#2c6672';ctx.lineWidth=3;ctx.setLineDash([5,5]);ctx.stroke();ctx.setLineDash([]);}
    else{ctx.strokeStyle='#779a9e';ctx.lineWidth=bd.size*.19;ctx.stroke();ctx.strokeStyle='#bed6c9';ctx.lineWidth=bd.size*.12;ctx.stroke();for(const d of pp){const q=edge(bd,t.i,d,-7);ctx.fillStyle='#416d78';ctx.beginPath();ctx.arc(q.x,q.y,2.6,0,TAU);ctx.fill();}}
    ctx.globalAlpha=1;
  }
  function drawPanel(ctx,bd,t,seg,fine,live){
    const p=corner(bd,t.i),s=bd.size,cx=p.x+s/2,cy=p.y+s/2,squash=Math.sin(t.angle*Math.PI)*.12,nx=t.nudge?Math.sin(t.nudge*28)*5*t.nudge:0,isHeld=live&&held&&held.i===t.i;
    ctx.save();ctx.translate(cx+nx,cy);ctx.scale(1-squash,1);ctx.translate(-cx,-cy);
    // Far away, as in the outro, a flat fill stands in for the shadow and the gradient.
    if(fine){sheet(ctx,p.x+2,p.y+6,s,'rgba(0,0,0,.24)');const paper=ctx.createLinearGradient(p.x,p.y,p.x+s,p.y+s);paper.addColorStop(0,(t.i+bd.k)%2?'#e4dfc1':'#efe7ca');paper.addColorStop(1,t.locked?'#a9a88a':'#bebd9e');sheet(ctx,p.x,p.y,s,paper);}
    else sheet(ctx,p.x,p.y,s,(t.i+bd.k)%2?'#d9d4b6':'#e3dcbe');
    ctx.save();ctx.beginPath();ctx.rect(p.x,p.y,s,s);ctx.clip();
    // Paper fibres, elevation rings and a fold line.
    if(fine){ctx.strokeStyle='rgba(114,128,104,.13)';ctx.lineWidth=.8;for(let j=0;j<3;j++){ctx.beginPath();ctx.ellipse(cx+s*.25,cy-s*.2,s*(.18+j*.1),s*(.11+j*.07),-.4,0,TAU);ctx.stroke();}ctx.strokeStyle='rgba(112,108,79,.16)';ctx.setLineDash([2,4]);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+s,p.y+s);ctx.stroke();ctx.setLineDash([]);}
    river(ctx,bd,t,t.rotation,isHeld?.35:1);
    if(seg&&t.water>0){curve(ctx,edge(bd,t.i,seg.a),{x:cx,y:cy},edge(bd,t.i,seg.o),t.water);ctx.strokeStyle='rgba(60,154,183,.95)';ctx.lineWidth=Math.max(s*.1,2.4/camera.s);ctx.lineCap='round';ctx.stroke();if(fine){ctx.strokeStyle='rgba(225,255,246,.75)';ctx.lineWidth=1.5;ctx.setLineDash([3,12]);ctx.lineDashOffset=-time*28;ctx.stroke();ctx.setLineDash([]);}}
    else if(t.shown>0){const pp=ports(t);ctx.globalAlpha=t.shown;curve(ctx,edge(bd,t.i,pp[0]),{x:cx,y:cy},edge(bd,t.i,pp[1]),1);ctx.strokeStyle='rgba(60,154,183,.6)';ctx.lineWidth=s*.08;ctx.stroke();ctx.globalAlpha=1;}
    if(isHeld)river(ctx,bd,t,t.rotation+held.turn,held.inside?.9:.4,true);
    ctx.restore();
    if(t.garden){const k=s/110,fx=cx+s*.2,fy=cy-s*.14,g=t.flower,sw=Math.sin(time+t.i)*2*k,hx=fx+sw,hy=fy-(5+g*24)*k,petal=['#bc6371','#b99640','#a373aa'][t.i%3];ctx.strokeStyle='#54806e';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(fx,fy+8*k);ctx.quadraticCurveTo(fx-6*k,fy-3*k,hx,hy);ctx.stroke();
      if(!fine&&t.bloomed){ctx.fillStyle=petal;ctx.beginPath();ctx.arc(hx,hy,3.4/camera.s,0,TAU);ctx.fill();}
      else if(g>.02){ctx.fillStyle=petal;for(let j=0;j<5;j++){ctx.save();ctx.translate(hx,hy);ctx.rotate(j*TAU/5+time*.1);ctx.beginPath();ctx.ellipse(0,5*g*k,3.6*g*k,8*g*k,0,0,TAU);ctx.fill();ctx.restore();}ctx.fillStyle='#fff0b1';ctx.beginPath();ctx.arc(hx,hy,(2+g)*k,0,TAU);ctx.fill();}
      else{ctx.fillStyle='#7a6159';ctx.beginPath();ctx.ellipse(fx,fy-5*k,4*k,6*k,.35,0,TAU);ctx.fill();}}
    // A brass pin shows that the water holds this panel.
    if(t.locked&&!bd.done){ctx.fillStyle='#8a6b3c';ctx.beginPath();ctx.arc(p.x+12,p.y+12,5,0,TAU);ctx.fill();ctx.fillStyle='#ecd096';ctx.beginPath();ctx.arc(p.x+11,p.y+11,2.2,0,TAU);ctx.fill();}
    if(isHeld){ctx.strokeStyle='#fff4b6';ctx.lineWidth=2;if(!held.inside)ctx.setLineDash([4,4]);ctx.strokeRect(p.x-2,p.y-2,s+4,s+4);ctx.setLineDash([]);}
    else if(live&&cursor===t.i){ctx.strokeStyle='#9fe3ff';ctx.lineWidth=2;ctx.strokeRect(p.x-3,p.y-3,s+6,s+6);}
    ctx.restore();
  }
  function drawSpring(ctx,bd,started){
    const P=edge(bd,bd.spring.cell,bd.spring.dir),Q=edge(bd,bd.spring.cell,bd.spring.dir,MOUTH);
    ctx.lineCap='round';ctx.strokeStyle='rgba(180,222,237,.45)';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(Q.x,Q.y);ctx.lineTo(P.x,P.y);ctx.stroke();ctx.strokeStyle=started?'#4fa7c4':'#b7edf6';ctx.lineWidth=started?7:3;ctx.stroke();
    if(!bd.k){ctx.fillStyle='#6d7d74';ctx.beginPath();ctx.ellipse(Q.x,Q.y-12,16,9,0,0,TAU);ctx.fill();}
    ctx.fillStyle='#d2f9ff';ctx.beginPath();ctx.arc(Q.x,Q.y,9,0,TAU);ctx.fill();
    // The ring fills while the water waits. When it closes, the water starts to move.
    if(bd===b&&!started&&!over){ctx.strokeStyle='#9fe3ff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(Q.x,Q.y,15,-Math.PI/2,-Math.PI/2+(1-bd.wait/bd.maxWait)*TAU);ctx.stroke();}
    if(camera.s>.6){if(bd.spring.dir===0)txt(ctx,'SPRING',Q.x+16,Q.y+5,12,'#dbf2ee','left',700,3);else txt(ctx,'SPRING',bd.spring.dir===3?6:414,Q.y+30,12,'#dbf2ee',bd.spring.dir===3?'left':'right',700,3);}
  }
  function drawHome(ctx,bd,lit){
    const P=edge(bd,bd.home.cell,bd.home.dir),Q=edge(bd,bd.home.cell,bd.home.dir,MOUTH),wet=bd.done;
    ctx.lineCap='round';ctx.strokeStyle='rgba(180,222,237,.4)';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(P.x,P.y);ctx.lineTo(Q.x,Q.y);ctx.stroke();ctx.strokeStyle=wet?'#4fa7c4':lit?'#c1f1d6':'#54776c';ctx.lineWidth=wet?7:3;ctx.stroke();
    if(lit||wet){const g=ctx.createRadialGradient(Q.x,Q.y,0,Q.x,Q.y,34);g.addColorStop(0,'rgba(255,233,160,.55)');g.addColorStop(1,'rgba(255,233,160,0)');ctx.fillStyle=g;ctx.fillRect(Q.x-34,Q.y-34,68,68);}
    ctx.strokeStyle=lit||wet?'#ffe9b0':'#e8dabb';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(Q.x-9,Q.y+10);ctx.lineTo(Q.x-9,Q.y-5);ctx.quadraticCurveTo(Q.x,Q.y-18,Q.x+9,Q.y-5);ctx.lineTo(Q.x+9,Q.y+10);ctx.stroke();
    if(camera.s>.6&&!wet){if(bd.home.dir===2)txt(ctx,'HOME',Q.x+16,Q.y+5,12,'#ede6c9','left',700,3);else txt(ctx,'HOME',bd.home.dir===3?6:414,Q.y-24,12,'#ede6c9',bd.home.dir===3?'left':'right',700,3);}
  }
  function drawLink(ctx,bd,fill){
    const pts=bd.link,l=length(pts);ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();pts.forEach((p,j)=>j?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
    ctx.strokeStyle='rgba(119,154,158,.85)';ctx.lineWidth=13;ctx.stroke();ctx.strokeStyle='#bed6c9';ctx.lineWidth=8;ctx.stroke();
    if(fill>0){ctx.setLineDash([l*fill,l+1]);ctx.strokeStyle='#4fa7c4';ctx.lineWidth=Math.max(7,2.4/camera.s);ctx.stroke();ctx.setLineDash([]);}
  }
  function drawBoard(ctx,bd,fine){
    const live=bd===b&&!over,tr=bd.final||trace(bd),route=new Map(tr.path.map(s=>[s.i,s])),started=bd.wait<=0;
    drawSpring(ctx,bd,started);drawHome(ctx,bd,tr.end==='home');
    // A short bridge marks each edge where two rivers meet.
    for(let i=0;i<bd.tiles.length;i++)for(const d of [1,2]){const j=step(bd,i,d);if(j<0)continue;const A=bd.tiles[i],C=bd.tiles[j];if(!(ports(A).includes(d)&&ports(C).includes((d+2)%4)))continue;const p=edge(bd,i,d),q=edge(bd,j,(d+2)%4),wet=A.water>.99&&C.water>0||C.water>.99&&A.water>0;ctx.strokeStyle=wet?'#4fa7c4':'rgba(190,232,226,.85)';ctx.lineWidth=bd.size*.11;ctx.lineCap='butt';ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();}
    for(const t of bd.tiles)drawPanel(ctx,bd,t,route.get(t.i),fine,live);
  }
  // The open edge where the water will spill: a faint ring, then a flash and drips in the last WARN seconds.
  function drawLeak(ctx){
    if(over||b.wait>0)return;const tr=trace(b);if(tr.end==='home')return;const S=spillAt(b,tr);
    if(b.leak){const k=.5+.5*Math.sin(time*TAU*5);ctx.fillStyle=`rgba(255,122,90,${.25+.35*k})`;ctx.beginPath();ctx.arc(S.x,S.y,14+8*k,0,TAU);ctx.fill();ctx.strokeStyle='#ffd2c2';ctx.lineWidth=3;ctx.stroke();
      ctx.fillStyle='rgba(165,231,242,.95)';for(let j=0;j<6;j++){const f=(time*2.2+j/6)%1;ctx.beginPath();ctx.arc(S.x+Math.sin(j*2.7)*f*12,S.y+6+f*28,2.8*(1-f)+.5,0,TAU);ctx.fill();}}
    else{ctx.strokeStyle='rgba(255,206,180,.6)';ctx.lineWidth=2;ctx.setLineDash([3,4]);ctx.beginPath();ctx.arc(S.x,S.y,10,0,TAU);ctx.stroke();ctx.setLineDash([]);}
  }
  function drawTraveller(ctx){
    let p;
    if(hop)p=along(hop.pts,smooth(hop.t/HOP));
    else{const tr=trace(b),L=tr.path.length;if(b.wait>0||b.front<=0||!L)p=edge(b,b.spring.cell,b.spring.dir,MOUTH);else{const k=Math.min(L-1,Math.floor(b.front)),s=tr.path[k];p=bez(edge(b,s.i,s.a),mid(b,s.i),edge(b,s.i,s.o),Math.min(1,b.front-k));}}
    ctx.save();ctx.translate(p.x,p.y-6+Math.sin(time*6)*1.5);
    ctx.fillStyle='#6f9a64';ctx.beginPath();ctx.ellipse(0,8,12,4,0,0,TAU);ctx.fill();
    ctx.fillStyle='#f4edcf';ctx.beginPath();ctx.ellipse(0,0,6,9,0,0,TAU);ctx.fill();ctx.beginPath();ctx.moveTo(-5,-5);ctx.lineTo(-6,-15);ctx.lineTo(-1,-7);ctx.moveTo(2,-7);ctx.lineTo(6,-16);ctx.lineTo(6,-4);ctx.fill();
    ctx.fillStyle='#3e635e';ctx.beginPath();ctx.arc(-2,-3,1,0,TAU);ctx.fill();ctx.beginPath();ctx.arc(2,-3,1,0,TAU);ctx.fill();ctx.restore();
  }
  function drawHud(ctx){
    if(over){ctx.globalAlpha=smooth(outro/.4);txt(ctx,`${paths} ${paths===1?'path':'paths'} crossed · ${gardens} ${gardens===1?'garden':'gardens'}`,210,46,18,'#f6ecc8','center',700);ctx.globalAlpha=1;return;}
    const urgent=remaining<10,ratio=Math.min(1,remaining/START);
    ctx.fillStyle='rgba(8,20,25,.62)';ctx.beginPath();ctx.roundRect(14,12,392,36,12);ctx.fill();
    txt(ctx,`PATH ${n+1}`,28,36,14,'#f2ead0','left',700);
    ctx.fillStyle='rgba(232,232,207,.2)';ctx.beginPath();ctx.roundRect(108,26,224,8,4);ctx.fill();
    ctx.fillStyle=urgent?'#ff8a6a':flash>0?flashColor:'#b1d8c3';ctx.beginPath();ctx.roundRect(108,26,Math.max(8,224*ratio),8,4);ctx.fill();
    txt(ctx,`${Math.ceil(remaining)} s`,394,37,urgent?Math.round(17+5*pulse):16,urgent?'#ffb39c':flash>0?flashColor:'#f2ead0','right',800);
    let hint;const tr=trace(b);
    if(held){const pv=trace(b,held.i,b.tiles[held.i].rotation+held.turn),k=pv.path.length,was=tr.path.length;hint=!held.inside?'Lift here to cancel the turn.':pv.end==='home'?'Lift to turn. The river will reach home.':k>was?`Lift to turn. The river grows to ${k} ${k===1?'panel':'panels'}.`:k<was?`Lift to turn. The river breaks after ${k} ${k===1?'panel':'panels'}.`:'Lift to turn this panel.';}
    else if(b.leak)hint='The water will spill. Join the next panel.';
    else if(b.wait>0)hint=b.spills&&b.maxWait===REFILL?`It spilled. The water starts again in ${Math.ceil(b.wait)} s.`:`Water in ${Math.ceil(b.wait)} s. Join the river from spring to home.`;
    else if(tr.end==='home')hint='The river is joined. The water rushes home.';
    else hint=n?'Keep the river joined ahead of the water.':'Tap a panel to turn it. Join the river to home.';
    txt(ctx,hint,210,620,14,b.leak?'#ffcdbd':'#ebead2','center',600);
    if(n<2){txt(ctx,'TAP TO TURN · DRAG LEFT TO TURN BACK',210,644,12,'rgba(214,236,222,.82)','center',600);txt(ctx,'LIFT OUTSIDE THE PANEL TO CANCEL',210,662,12,'rgba(214,236,222,.82)','center',600);}
  }

  b=makeBoard(0,null);boards.push(b);camera=focus(b);
  say('Turn the panels to join the river from the spring to home before the water comes.');metric();
  return {
    update(dt){
      dt=Math.min(dt,.05);if(slow){slow.left-=dt;dt*=slow.f;if(slow.left<=0)slow=null;}time+=dt;if(!said){said=true;api.status(message);}
      for(let i=timers.length-1;i>=0;i--)if((timers[i].t-=dt)<=0)timers.splice(i,1)[0].fn();
      shake=Math.max(0,shake-dt*3);flash=Math.max(0,flash-dt*2);pulse=Math.max(0,pulse-dt*2.5);
      for(let i=popups.length-1;i>=0;i--)if((popups[i].t+=dt)>1.2)popups.splice(i,1);
      for(const bd of boards)for(const t of bd.tiles){t.angle=Math.max(0,t.angle-dt*3.6);t.nudge=Math.max(0,t.nudge-dt*2.5);t.shown=t.water>=t.shown?t.water:Math.max(t.water,t.shown-dt*2.5);
        if(t.garden&&t.water>.8&&t.flower<1){t.flower=Math.min(1,t.flower+dt*1.8);if(t.flower>=1&&!t.bloomed){t.bloomed=true;gardens++;const c=mid(bd,t.i);burst({x:c.x+bd.size*.2,y:c.y-bd.size*.3},'#ffcfb9',14);api.tone(698.46+(gardens%3)*87,.22,'sine',.07);}}}
      if(pan){pan.t+=dt;const u=smooth(pan.t/pan.dur),f=pan.from,o=pan.to;camera={x:f.x+(o.x-f.x)*u,y:f.y+(o.y-f.y)*u,s:f.s+(o.s-f.s)*u};if(pan.t>=pan.dur)pan=null;}
      if(hop&&(hop.t+=dt)>=HOP)hop=null;
      if(over){outro+=dt;return;}
      remaining=Math.max(0,remaining-dt);
      // The last ten seconds tick and pulse.
      const sec=Math.ceil(remaining);if(sec<lastSecond&&sec<=10&&sec>0){api.tone(sec<=3?1175:880,.07,'square',.05);pulse=1;if(lastSecond>10)say('Ten seconds left. Finish this path to gain time.');}lastSecond=sec;
      flow(dt);metric();
      if(remaining<=0)end();
    },
    draw(ctx){
      ctx.save();const scrim=ctx.createLinearGradient(0,0,0,680);scrim.addColorStop(0,'rgba(13,28,33,.34)');scrim.addColorStop(1,'rgba(13,28,33,.74)');ctx.fillStyle=scrim;ctx.fillRect(0,0,420,680);
      if(!over&&remaining<10){const g=ctx.createRadialGradient(210,340,180,210,340,430);g.addColorStop(0,'rgba(255,90,60,0)');g.addColorStop(1,`rgba(255,90,60,${.2+.3*pulse})`);ctx.fillStyle=g;ctx.fillRect(0,0,420,680);}
      ctx.save();if(shake&&!calm)ctx.translate((Math.random()-.5)*shake*7,(Math.random()-.5)*shake*7);
      ctx.translate(CX,CY);ctx.scale(camera.s,camera.s);ctx.translate(-camera.x,-camera.y);
      const top=camera.y-CY/camera.s-90,bottom=camera.y+(680-CY)/camera.s+90,fine=camera.s>.6;
      for(const bd of boards)if(bd.link&&bd.oy>top-GUTTER&&bd.oy-GUTTER<bottom)drawLink(ctx,bd,bd===b&&hop?smooth(hop.t/HOP):1);
      for(const bd of boards)if(bd.oy+bd.h>top&&bd.oy<bottom)drawBoard(ctx,bd,fine);
      drawTraveller(ctx);drawLeak(ctx);
      if(over&&light){const u=clamp((outro-LIGHT[0])/LIGHT[1],0,1);if(u>0){const p=along(light.pts,u),r=18/camera.s;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();light.pts.forEach((q,j)=>j?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.setLineDash([light.len*u,light.len+1]);ctx.strokeStyle='rgba(255,246,196,.9)';ctx.lineWidth=2.6/camera.s;ctx.stroke();ctx.setLineDash([]);
        const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r);g.addColorStop(0,'rgba(255,252,225,1)');g.addColorStop(.35,'rgba(255,236,170,.7)');g.addColorStop(1,'rgba(255,236,170,0)');ctx.fillStyle=g;ctx.fillRect(p.x-r,p.y-r,2*r,2*r);}}
      for(const p of popups){const k=p.t/1.2;ctx.globalAlpha=1-k*k;txt(ctx,p.text,p.x,p.y-k*26,Math.round(17/camera.s),p.color,'center',800,4/camera.s);}ctx.globalAlpha=1;
      ctx.restore();drawHud(ctx);ctx.restore();
    },
    // Press to preview a turn. Drag left to preview the other way. Lift on the panel to turn it, or lift outside it to cancel.
    pointer(type,p){
      if(over)return;
      if(type==='down'){const i=hit(p);if(i<0)return;const t=b.tiles[i];if(t.water>.5){t.nudge=1;api.tone(150,.08,'square',.05);say('Water holds this panel. It cannot turn now.');return;}held={i,x:p.x,y:p.y,turn:1,inside:true};cursor=-1;api.tone(520,.03,'sine',.03);}
      else if(type==='move'&&held){held.turn=p.x-held.x<-24?3:1;held.inside=hit(p,8)===held.i;}
      else if(type==='up'&&held){const h=held;held=null;if(hit(p,8)===h.i)fold(h.i,b.tiles[h.i].rotation+(p.x-h.x<-24?3:1));else{api.tone(220,.08,'sine',.05);say('Turn cancelled.');}}
      else if(type==='cancel')held=null;
    },
    // Keys: arrows pick a panel, Space or Enter turns it, Z or X turns it back. Keys 1 to 9 turn a panel at once.
    key(type,k){
      if(type!=='down'||over)return;
      if(/^[1-9]$/.test(k)){const i=+k-1;if(i<b.tiles.length){cursor=i;fold(i,b.tiles[i].rotation+1);}return;}
      const d={ArrowUp:0,ArrowRight:1,ArrowDown:2,ArrowLeft:3}[k];
      if(d!==undefined){if(cursor<0)cursor=0;else{const j=step(b,cursor,d);if(j>=0)cursor=j;}api.tone(600,.02,'sine',.02);return;}
      if(cursor<0)return;
      if(k===' '||k==='Enter')fold(cursor,b.tiles[cursor].rotation+1);
      else if(/^[zZxX]$/.test(k)||k==='Backspace')fold(cursor,b.tiles[cursor].rotation+3);
    },
    getState(){const tr=trace(b);return {game:'foldwild',over,outro,board:n,paths,remaining,urgent:!over&&remaining<10,time,moves,spills,gardens,cols:b.cols,rows:b.rows,speed:b.speed,waiting:b.wait>0,wait:Math.max(0,b.wait),front:b.front,route:tr.path.map(s=>s.i),end:tr.end,connected:tr.end==='home',
      leak:b.leak?{t:b.leak.t,warning:b.leak.t>=0}:null,boardSpills:b.spills,spring:{...b.spring},home:{...b.home},transition:!!pan,walking:!!hop,held:held?{i:held.i,turn:held.turn,inside:held.inside}:null,camera:{...camera},
      tiles:b.tiles.map(t=>{const c=screen(mid(b,t.i));return {index:t.i,x:c.x,y:c.y,size:b.size*camera.s,kind:t.kind,rotation:t.rotation,ports:ports(t),water:t.water,locked:t.locked,garden:t.garden,flower:t.flower};})};},
    destroy(){timers.length=0;popups.length=0;},
  };
}
