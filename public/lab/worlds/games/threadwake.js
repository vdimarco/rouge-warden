const TAU=Math.PI*2;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export default function createGame(api){
  const anchors=[{x:129,y:463},{x:306,y:361},{x:159,y:258},{x:314,y:145}].map((p,i)=>({...p,bx:p.x,by:p.y,phase:api.rng()*TAU,got:false,exit:i===3}));
  const player={x:74,y:570,vx:0,vy:0};
  let time=0,tether=-1,length=0,drag=null,selected=-1,complete=false,falls=0,flight=0,message='',trail=[],pulse=0;
  const say=t=>{if(t!==message){message=t;api.status(t);}};
  const nearest=p=>{let best=-1,d=83;anchors.forEach((a,i)=>{const n=dist(a,p);if(n<d){d=n;best=i;}});return best;};
  const setMetric=()=>api.metric(`${anchors.filter(a=>a.got&&!a.exit).length}/3 lights · ${tether<0?'free flight':'thread linked'}`);
  say('Touch a glowing branch to cast your thread.');setMetric();
  function link(i){
    if(i<0)return;
    if(anchors[i].exit&&anchors.slice(0,3).some(a=>!a.got)){say('Gather the three lights, then enter the crown.');return;}
    tether=i;length=Math.max(32,dist(player,anchors[i]));api.tone(310+i*85,.15,'sine',.1);pulse=1;setMetric();
    say('Your thread reels in. Touch the next branch, or pull back and release to fly.');
  }
  function resetFall(){falls++;player.x=74;player.y=570;player.vx=0;player.vy=-80;tether=-1;drag=null;trail=[];api.burst(74,580,'#b3ffe4',15);say('The garden caught you. Cast again. Your lights are safe.');setMetric();}
  return {
    update(dt){
      dt=Math.min(dt,.033);time+=dt;pulse=Math.max(0,pulse-dt*2);
      anchors.forEach((a,i)=>{const bias=tether===i?clamp((player.x-a.x)*.06,-12,12):0;a.x+=(a.bx+Math.sin(time*.7+a.phase)*6+bias-a.x)*dt*4;a.y+=(a.by+Math.cos(time*.85+a.phase)*4-a.y)*dt*4;});
      if(complete)return;
      const speed=drag && drag.target<0 ? .32 : 1;const ds=dt*speed;
      player.vy+=205*ds;
      if(tether>=0){const a=anchors[tether],dx=player.x-a.x,dy=player.y-a.y,d=Math.hypot(dx,dy)||1;length=Math.max(25,length-145*ds);
        const stretch=Math.max(0,d-length),f=stretch*45;
        player.vx-=dx/d*f*ds;player.vy-=dy/d*f*ds;
        player.vx*=Math.exp(-2*ds);player.vy*=Math.exp(-2*ds);
        // A short linked thread lets the player circle the flexible anchor.
        if(d<65){player.vx+=Math.cos(time*2)*12*ds;}
      }else {player.vx*=Math.exp(-.15*ds);flight+=ds;}
      player.x+=player.vx*ds;player.y+=player.vy*ds;
      if(player.x<18){player.x=18;player.vx=Math.abs(player.vx)*.65;}if(player.x>402){player.x=402;player.vx=-Math.abs(player.vx)*.65;}
      if(player.y<54){player.y=54;player.vy=Math.abs(player.vy)*.3;}
      if(player.y>584&&player.x<143){player.y=584;player.vy=-Math.abs(player.vy)*.12;player.vx*=.94;}
      if(player.y>715)resetFall();
      trail.push({x:player.x,y:player.y,life:1});if(trail.length>35)trail.shift();trail.forEach(p=>p.life-=dt*1.8);
      anchors.forEach((a,i)=>{
        if(dist(a,player)<59&&!a.got){
          if(a.exit&&anchors.slice(0,3).some(n=>!n.got))return;
          a.got=true;api.burst(a.x,a.y,a.exit?'#f9dda2':'#befbe2',23);api.tone(470+i*140,.24,'sine',.12);setMetric();
          if(a.exit){complete=true;say('You woke the crown.');api.finish({title:'The garden is awake',detail:`Three lights carried to the crown. ${falls?`${falls} soft landings.`:'A clean climb.'} Try a new route through the branches.`,score:Math.max(100,1000-Math.round(time)*3-falls*50)});}else say(anchors.slice(0,3).every(n=>n.got)?'The crown is ready. Touch the golden arch at the top.':'Light gathered. Touch another branch to climb.');
        }
      });
    },
    draw(ctx){
      ctx.save();
      const shade=ctx.createLinearGradient(0,90,0,680);shade.addColorStop(0,'rgba(3,22,28,.04)');shade.addColorStop(1,'rgba(3,22,28,.58)');ctx.fillStyle=shade;ctx.fillRect(0,0,420,680);
      for(let i=0;i<17;i++){let x=(i*83+time*(i%2?4:-3)+420)%420,y=140+(i*127)%480+Math.sin(time+i)*12;ctx.globalAlpha=.22+Math.sin(time+i)*.12;ctx.fillStyle='#baffdc';ctx.beginPath();ctx.arc(x,y,1.7,0,TAU);ctx.fill();}ctx.globalAlpha=1;
      // Starting island with a folded underside and gently moving grass.
      ctx.fillStyle='#23494a';ctx.beginPath();ctx.moveTo(0,588);ctx.bezierCurveTo(40,573,103,576,148,593);ctx.lineTo(92,622);ctx.lineTo(34,616);ctx.closePath();ctx.fill();ctx.strokeStyle='#86c7a6';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,588);ctx.quadraticCurveTo(80,570,145,592);ctx.stroke();
      for(let i=0;i<12;i++){const x=12+i*10;ctx.strokeStyle='#669b89';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x,584);ctx.quadraticCurveTo(x-6,570,x+Math.sin(time+i)*3,568-i%4*2);ctx.stroke();}
      anchors.forEach((a,i)=>{
        const active=tether===i,focus=selected===i;const glow=ctx.createRadialGradient(a.x,a.y,0,a.x,a.y,a.exit?61:51);glow.addColorStop(0,a.exit?'rgba(255,201,114,.23)':'rgba(119,255,207,.16)');glow.addColorStop(1,'transparent');ctx.fillStyle=glow;ctx.fillRect(a.x-66,a.y-66,132,132);
        ctx.strokeStyle=a.got?'#9ac1a4':'#6c9c89';ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a.bx-31,a.by+54);ctx.bezierCurveTo(a.bx+18,a.by+43,a.x-33,a.y+19,a.x,a.y);ctx.stroke();
        for(let j=0;j<3;j++){const y=a.y+23+j*8,x=a.x-14-j*4;ctx.fillStyle=j%2?'#70a58d':'#427f73';ctx.beginPath();ctx.ellipse(x+(j%2?10:-6),y,13,4,j%2?-.5:.7,0,TAU);ctx.fill();}
        if(a.exit){ctx.strokeStyle=anchors.slice(0,3).every(n=>n.got)?'#ffdc97':'#b09d77';ctx.lineWidth=3;ctx.beginPath();ctx.arc(a.x,a.y,24,Math.PI*.15,Math.PI*.85,true);ctx.stroke();ctx.beginPath();ctx.moveTo(a.x-22,a.y+10);ctx.lineTo(a.x-22,a.y+26);ctx.moveTo(a.x+22,a.y+10);ctx.lineTo(a.x+22,a.y+26);ctx.stroke();ctx.font='500 9px system-ui';ctx.textAlign='center';ctx.fillStyle='#ffe2b2';ctx.fillText('CROWN',a.x,a.y-34);}
        else {ctx.save();ctx.translate(a.x,a.y);ctx.rotate(time*.15+i);for(let j=0;j<5;j++){ctx.rotate(TAU/5);ctx.fillStyle=a.got?'#568276':'#b9f8d7';ctx.beginPath();ctx.ellipse(0,9,4,11,0,0,TAU);ctx.fill();}ctx.restore();}
        ctx.fillStyle=a.got?'#c6e7c4':a.exit?'#ffd99d':'#e2ffe6';ctx.shadowBlur=a.got?5:17;ctx.shadowColor=ctx.fillStyle;ctx.beginPath();ctx.arc(a.x,a.y,a.got?4:6,0,TAU);ctx.fill();ctx.shadowBlur=0;
        if(active||focus){ctx.strokeStyle=focus?'#fff5c6':'rgba(202,255,232,.4)';ctx.lineWidth=1.5;ctx.setLineDash(focus?[5,4]:[]);ctx.beginPath();ctx.arc(a.x,a.y,35+Math.sin(time*4)*2,0,TAU);ctx.stroke();ctx.setLineDash([]);}
      });
      // Real tether follows the movement of its anchor.
      if(tether>=0){const a=anchors[tether];ctx.strokeStyle='rgba(190,255,226,.25)';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(player.x,player.y);ctx.quadraticCurveTo((a.x+player.x)/2+Math.sin(time*8)*3,(a.y+player.y)/2,a.x,a.y);ctx.stroke();ctx.strokeStyle='#caffdf';ctx.lineWidth=1.2;ctx.stroke();}
      if(drag){if(selected>=0){const a=anchors[selected];ctx.strokeStyle='#fff4ce';ctx.lineWidth=1.4;ctx.setLineDash([4,6]);ctx.beginPath();ctx.moveTo(player.x,player.y);ctx.lineTo(a.x,a.y);ctx.stroke();ctx.setLineDash([]);}else if(tether>=0){const dx=clamp(drag.x-drag.startX,-110,110),dy=clamp(drag.y-drag.startY,-110,110);ctx.strokeStyle='#ffd79f';ctx.lineWidth=2;ctx.setLineDash([3,6]);ctx.beginPath();ctx.moveTo(player.x,player.y);ctx.lineTo(player.x-dx,player.y-dy);ctx.stroke();ctx.setLineDash([]);}}
      trail.forEach((p,i)=>{if(p.life<=0)return;ctx.globalAlpha=p.life*.22;ctx.fillStyle='#ffdb9d';ctx.beginPath();ctx.arc(p.x,p.y,2+i/trail.length*3,0,TAU);ctx.fill();});ctx.globalAlpha=1;
      ctx.save();ctx.translate(player.x,player.y);ctx.rotate(clamp(player.vx/500,-.5,.5));ctx.shadowColor='#ffe6ad';ctx.shadowBlur=17;ctx.fillStyle='#fff2cc';ctx.beginPath();ctx.moveTo(0,-12);ctx.quadraticCurveTo(13,-3,8,7);ctx.quadraticCurveTo(0,16,-8,7);ctx.quadraticCurveTo(-13,-3,0,-12);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#eed398';ctx.beginPath();ctx.moveTo(-7,2);ctx.quadraticCurveTo(-24,-5,-16,13+Math.sin(time*8)*4);ctx.lineTo(-3,9);ctx.fill();ctx.beginPath();ctx.moveTo(7,2);ctx.quadraticCurveTo(24,-5,16,13+Math.sin(time*8+1)*4);ctx.lineTo(3,9);ctx.fill();ctx.fillStyle='#37594e';ctx.beginPath();ctx.arc(-3,-1,1.2,0,TAU);ctx.arc(3,-1,1.2,0,TAU);ctx.fill();ctx.restore();
      ctx.fillStyle='rgba(214,244,226,.65)';ctx.font='10px system-ui';ctx.textAlign='left';ctx.fillText('TOUCH A BRANCH · PULL BACK TO LAUNCH',24,641);
      ctx.restore();
    },
    pointer(type,p){if(complete)return;if(type==='down'){selected=nearest(p);drag={startX:p.x,startY:p.y,x:p.x,y:p.y,target:selected};}
      if(type==='move'&&drag){drag.x=p.x;drag.y=p.y;selected=nearest(p);}
      if(type==='up'&&drag){const dx=p.x-drag.startX,dy=p.y-drag.startY;if(selected>=0)link(selected);else if(tether>=0&&Math.hypot(dx,dy)>12){tether=-1;player.vx=clamp(-dx*4,-430,430);player.vy=clamp(-dy*4,-500,390);api.tone(190,.12,'triangle',.13);flight=0;say('In flight. Touch a branch to catch a new thread.');setMetric();}else if(tether<0)say('Touch one of the three glowing branches to attach.');drag=null;selected=-1;}
      if(type==='cancel'){drag=null;selected=-1;}},
    key(type,key){if(type==='down'&&/^[1-4]$/.test(key))link(Number(key)-1);},
    getState(){return {game:'threadwake',complete,lights:anchors.slice(0,3).filter(a=>a.got).length,tether,falls,player:{...player},anchors:anchors.map(a=>({x:a.x,y:a.y,got:a.got,exit:a.exit})),time};}
  };
}
