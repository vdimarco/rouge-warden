const TAU=Math.PI*2;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const DIR=[[0,-1],[1,0],[0,1],[-1,0]];
export default function createGame(api){
  const tiles=Array.from({length:6},(_,i)=>({i,x:57+(i%2)*158,y:153+Math.floor(i/2)*134,w:148,h:124,rotation:Math.floor(api.rng()*4),angle:0,water:0,flower:0,seed:[1,2,5].includes(i)}));
  if(tiles.every((t,i)=>t.rotation===[0,2,1,3,0,0][i]))tiles[1].rotation=0;
  let time=0,moves=0,remaining=100,drag=null,selected=-1,preview=null,complete=false,won=false,route=[],connected=false,leak=null,traveller=0,message='',lastGrown=0;
  const ports=(t,r=t.rotation)=>(t.i===0||t.i===5?[1,3]:[0,1]).map(d=>(d+r+4)%4);
  const say=t=>{if(t!==message){message=t;api.status(t);}};
  let previousMetric='';
  const metric=()=>{const next=`${tiles.filter(t=>t.seed&&t.flower>.98).length}/3 gardens · ${moves} folds · ${Math.ceil(remaining)}s`;if(next!==previousMetric){previousMetric=next;api.metric(next);}};
  const pos=(t,d,inset=0)=>({x:t.x+t.w/2+DIR[d][0]*(t.w/2-inset),y:t.y+t.h/2+DIR[d][1]*(t.h/2-inset)});
  function trace(previewIndex=-1,previewRotation=0){
    const path=[];let i=0,incoming=3,out=1,end=false,spill={x:43,y:215};const visited=new Set();
    while(i>=0&&!visited.has(i)){
      const t=tiles[i],p=ports(t,i===previewIndex?previewRotation:t.rotation);
      if(!p.includes(incoming))break;
      visited.add(i);path.push(i);out=p.find(n=>n!==incoming);spill=pos(t,out);
      const row=Math.floor(i/2),col=i%2,nr=row+DIR[out][1],nc=col+DIR[out][0];
      if(nr<0||nr>2||nc<0||nc>1){end=i===5&&out===1;break;}
      const ni=nr*2+nc,other=tiles[ni],np=ports(other,ni===previewIndex?previewRotation:other.rotation);
      if(!np.includes((out+2)%4))break;
      i=ni;incoming=(out+2)%4;
    }
    return {path,connected:end,leak:spill};
  }
  const find=p=>tiles.findIndex(t=>p.x>=t.x-3&&p.x<=t.x+t.w+3&&p.y>=t.y-3&&p.y<=t.y+t.h+3);
  function fold(i,rotation){if(i<0||complete)return;const t=tiles[i];t.rotation=(rotation+4)%4;t.angle=1;moves++;api.tone(245+i*31,.09,'triangle',.09);api.burst(t.x+t.w-20,t.y+t.h-19,'#f8e5b9',5);metric();say('Water follows joined edges. Grow all three gardens to cross.');}
  say('Tap a paper panel to fold its river. Hold to preview the next fold.');metric();
  return {
    update(dt){
      dt=Math.min(dt,.05);time+=dt;
      tiles.forEach(t=>t.angle=Math.max(0,t.angle-dt*3.6));
      const tr=trace();route=tr.path;connected=tr.connected;leak=tr.leak;
      if(complete)return;
      remaining=Math.max(0,remaining-dt);metric();
      const grows=[];
      tiles.forEach(t=>{const n=route.indexOf(t.i);const fed=n>=0&&(n===0||tiles[route[n-1]].water>.76);t.water=clamp(t.water+dt*(fed?1.05:-.32),0,1);if(t.seed&&t.water>.8){t.flower=Math.min(1,t.flower+dt*.9);}if(t.seed&&t.flower>.98)grows.push(t.i);});
      if(grows.length>lastGrown){lastGrown=grows.length;const a=tiles[grows[grows.length-1]];api.burst(a.x+a.w/2,a.y+a.h/2,'#ffcfb9',17);api.tone(460+grows.length*100,.2,'sine',.12);say(grows.length===3?'The gardens are alive. Keep the whole river joined to cross.':'A garden has grown. Its roots will stay when you fold again.');}
      if(connected&&tiles[5].water>.85&&grows.length===3){traveller=Math.min(1,traveller+dt*.24);}
      if(traveller>=1){complete=true;won=true;say('You folded a river into a living path.');api.finish({title:'A path unfolds',detail:`Three gardens grew in ${moves} folds. Your traveller crossed the paper world. Try again for a new arrangement.`,score:Math.max(100,1200-moves*15-Math.floor(time)*2)});}
      if(remaining===0&&!complete){complete=true;say('The spring is resting. Try a new set of folds.');api.finish({title:'The spring grew quiet',detail:`You grew ${grows.length} of three gardens. Restart to try a new arrangement. Match the blue river ends across the paper edges.`,score:grows.length*200});}
    },
    draw(ctx){
      ctx.save();const scrim=ctx.createLinearGradient(0,110,0,665);scrim.addColorStop(0,'rgba(13,28,33,.22)');scrim.addColorStop(1,'rgba(13,28,33,.68)');ctx.fillStyle=scrim;ctx.fillRect(0,100,420,565);
      // The spring hangs beside the first paper panel.
      ctx.strokeStyle='rgba(180,222,237,.4)';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(22,195);ctx.lineTo(22,215);ctx.lineTo(57,215);ctx.stroke();ctx.strokeStyle='#b7edf6';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#d2f9ff';ctx.beginPath();ctx.arc(22,192,6,0,TAU);ctx.fill();
      ctx.textAlign='center';ctx.font='9px system-ui';ctx.fillStyle='#dbf2ee';ctx.fillText('SPRING',33,172);
      const previewTrace=selected>=0&&preview!==null?trace(selected,preview):null;
      // Bridges across the small spaces between paper leaves show shared edges.
      [[0,1],[0,2],[1,3],[2,3],[2,4],[3,5],[4,5]].forEach(([ia,ib])=>{const a=tiles[ia],b=tiles[ib],horizontal=Math.floor(ia/2)===Math.floor(ib/2),d=horizontal?1:2,p=pos(a,d),q=pos(b,(d+2)%4),join=ports(a).includes(d)&&ports(b).includes((d+2)%4);ctx.strokeStyle=join?'rgba(172,234,235,.85)':'rgba(230,223,187,.15)';ctx.lineWidth=join?5:1;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();});
      tiles.forEach(t=>{
        const cx=t.x+t.w/2,cy=t.y+t.h/2,folding=Math.sin(t.angle*Math.PI)*.12;
        ctx.save();ctx.translate(cx,cy);ctx.scale(1-folding,1);ctx.translate(-cx,-cy);
        ctx.shadowBlur=15;ctx.shadowColor='rgba(0,0,0,.28)';ctx.shadowOffsetY=7;
        const paper=ctx.createLinearGradient(t.x,t.y,t.x+t.w,t.y+t.h);paper.addColorStop(0,t.i%2?'#e1ddbf':'#eee6c8');paper.addColorStop(1,'#bbbc9c');ctx.fillStyle=paper;
        ctx.beginPath();ctx.moveTo(t.x+4,t.y);ctx.lineTo(t.x+t.w-4,t.y+3);ctx.lineTo(t.x+t.w,t.y+t.h-5);ctx.lineTo(t.x+1,t.y+t.h);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;
        ctx.save();ctx.beginPath();ctx.rect(t.x,t.y,t.w,t.h);ctx.clip();
        // Subtle paper fibres, elevation rings, and folds.
        for(let j=0;j<5;j++){ctx.strokeStyle='rgba(114,128,104,.13)';ctx.lineWidth=.8;ctx.beginPath();ctx.ellipse(cx+40,cy-28,26+j*13,15+j*9,-.4,0,TAU);ctx.stroke();}
        ctx.strokeStyle='rgba(112,108,79,.16)';ctx.setLineDash([2,4]);ctx.beginPath();ctx.moveTo(t.x,t.y);ctx.lineTo(t.x+t.w,t.y+t.h);ctx.stroke();ctx.setLineDash([]);
        const drawRiver=(rotation,alpha,dashed=false)=>{
          const pp=ports(t,rotation),a=pos(t,pp[0]),b=pos(t,pp[1]);ctx.globalAlpha=alpha;ctx.strokeStyle='#779a9e';ctx.lineWidth=18;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(cx,cy,b.x,b.y);ctx.stroke();
          ctx.strokeStyle='#bed6c9';ctx.lineWidth=12;ctx.stroke();
          if(t.water>0&&!dashed){ctx.strokeStyle=`rgba(60,154,183,${.35+t.water*.6})`;ctx.lineWidth=9;ctx.stroke();ctx.strokeStyle='rgba(225,255,246,.7)';ctx.lineWidth=1.5;ctx.setLineDash([3,13]);ctx.lineDashOffset=-time*20;ctx.stroke();ctx.setLineDash([]);}
          if(dashed){ctx.strokeStyle='#3b7782';ctx.lineWidth=3;ctx.setLineDash([4,5]);ctx.stroke();ctx.setLineDash([]);}
          pp.forEach(d=>{const p=pos(t,d,8);ctx.fillStyle='#416d78';ctx.beginPath();ctx.arc(p.x,p.y,3,0,TAU);ctx.fill();});ctx.globalAlpha=1;
        };
        drawRiver(t.rotation,selected===t.i?.35:1);
        if(selected===t.i&&preview!==null)drawRiver(preview,.85,true);
        ctx.restore();
        if(t.seed){const fx=cx+20,fy=cy-12,g=t.flower;ctx.strokeStyle='#54806e';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(fx,fy+8);ctx.quadraticCurveTo(fx-6,fy-3,fx+Math.sin(time+t.i)*2,fy-5-g*24);ctx.stroke();if(g>.02){for(let j=0;j<5;j++){ctx.save();ctx.translate(fx+Math.sin(time+t.i)*2,fy-5-g*24);ctx.rotate(j*TAU/5+time*.1);ctx.fillStyle=t.i===1?'#bc6371':t.i===2?'#b99640':'#a373aa';ctx.beginPath();ctx.ellipse(0,5*g,3.6*g,8*g,0,0,TAU);ctx.fill();ctx.restore();}ctx.fillStyle='#fff0b1';ctx.beginPath();ctx.arc(fx+Math.sin(time+t.i)*2,fy-5-g*24,2+g,0,TAU);ctx.fill();}else {ctx.fillStyle='#7a6159';ctx.beginPath();ctx.ellipse(fx,fy-5,4,6,.35,0,TAU);ctx.fill();}}
        // Folded corner remains a clear, reachable touch target.
        ctx.fillStyle=selected===t.i?'#fffae1':'#f5efd9';ctx.beginPath();ctx.moveTo(t.x+t.w-30,t.y+t.h);ctx.lineTo(t.x+t.w,t.y+t.h-30);ctx.lineTo(t.x+t.w,t.y+t.h);ctx.closePath();ctx.fill();ctx.strokeStyle='#a19f80';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(t.x+t.w-30,t.y+t.h);ctx.lineTo(t.x+t.w,t.y+t.h-30);ctx.stroke();ctx.fillStyle='#596b67';ctx.font='15px system-ui';ctx.textAlign='center';ctx.fillText('↻',t.x+t.w-11,t.y+t.h-6);ctx.font='8px system-ui';ctx.textAlign='left';ctx.fillStyle='rgba(59,79,69,.6)';ctx.fillText(String(t.i+1).padStart(2,'0'),t.x+9,t.y+15);
        if(selected===t.i){ctx.strokeStyle='#fff4b6';ctx.lineWidth=2;ctx.strokeRect(t.x-2,t.y-2,t.w+4,t.h+4);}ctx.restore();
      });
      const outgoing=tiles[5],end=pos(outgoing,1);ctx.strokeStyle=connected?'#c1f1d6':'#54776c';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(end.x,end.y);ctx.quadraticCurveTo(381,end.y-9,394,end.y);ctx.stroke();ctx.strokeStyle='#e8dabb';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(382,473);ctx.lineTo(382,451);ctx.quadraticCurveTo(390,442,399,451);ctx.lineTo(399,475);ctx.stroke();ctx.fillStyle='#ede6c9';ctx.font='8px system-ui';ctx.textAlign='center';ctx.fillText('HOME',390,493);
      if(leak&&!connected&&route.length){ctx.fillStyle='rgba(165,231,242,.75)';for(let j=0;j<5;j++){let f=(time*1.2+j*.2)%1;ctx.beginPath();ctx.arc(leak.x+Math.sin(j*3)*f*8,leak.y+f*18,2*(1-f),0,TAU);ctx.fill();}}
      let tx=39,ty=258;const journey=[{x:39,y:258},...([0,1,3,2,4,5].map(i=>({x:tiles[i].x+tiles[i].w/2,y:tiles[i].y+tiles[i].h/2-6}))),{x:390,y:463}];if(traveller>0){const n=traveller*(journey.length-1),i=Math.min(journey.length-2,Math.floor(n)),f=n-i;tx=journey[i].x*(1-f)+journey[i+1].x*f;ty=journey[i].y*(1-f)+journey[i+1].y*f;}
      ctx.save();ctx.translate(tx,ty+Math.sin(time*6)*1.5);ctx.fillStyle='#f4edcf';ctx.beginPath();ctx.ellipse(0,0,6,9,0,0,TAU);ctx.fill();ctx.beginPath();ctx.moveTo(-5,-5);ctx.lineTo(-6,-15);ctx.lineTo(-1,-7);ctx.moveTo(2,-7);ctx.lineTo(6,-16);ctx.lineTo(6,-4);ctx.fill();ctx.fillStyle='#3e635e';ctx.beginPath();ctx.arc(-2,-3,1,0,TAU);ctx.arc(2,-3,1,0,TAU);ctx.fill();ctx.restore();
      ctx.textAlign='center';ctx.font='11px system-ui';ctx.fillStyle='#ebead2';ctx.fillText(previewTrace?`After this fold: ${previewTrace.path.length} river panels joined`:'Join the river ends. Each fold turns one panel.',210,591);
      ctx.font='9px system-ui';ctx.fillStyle='rgba(214,236,222,.67)';ctx.fillText('TAP TO FOLD · HOLD TO PREVIEW · DRAG LEFT TO UNFOLD',210,614);
      ctx.fillStyle='rgba(232,232,207,.2)';ctx.fillRect(93,634,234,2);ctx.fillStyle='#b1d8c3';ctx.fillRect(93,634,234*remaining/100,2);
      ctx.restore();
    },
    pointer(type,p){if(complete)return;if(type==='down'){selected=find(p);if(selected>=0){drag={x:p.x,y:p.y};preview=(tiles[selected].rotation+1)%4;}}
      if(type==='move'&&drag&&selected>=0){preview=(tiles[selected].rotation+(p.x-drag.x<-30?3:1))%4;}
      if(type==='up'&&drag){fold(selected,preview);drag=null;selected=-1;preview=null;}
      if(type==='cancel'){drag=null;selected=-1;preview=null;}},
    key(type,key){if(type==='down'&&/^[1-6]$/.test(key)){const i=Number(key)-1;fold(i,tiles[i].rotation+1);}},
    getState(){return {game:'foldwild',complete,won,moves,remaining,time,route:[...route],connected,traveller,gardens:tiles.filter(t=>t.seed&&t.flower>.98).length,solution:[0,2,1,3,0,0],tiles:tiles.map(t=>({index:t.i,x:t.x+t.w/2,y:t.y+t.h/2,rotation:t.rotation,ports:ports(t),water:t.water,flower:t.flower,seed:t.seed}))};}
  };
}
