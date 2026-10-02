const TAU = Math.PI * 2;
const COLORS = ['#bbacf6', '#91f4df', '#ffd699', '#ff9989','#b99aef','#a4dfff','#ffba83','#c3d990','#c5bdff','#ffc16d','#96e0ac','#a9dfb7'];
export function attackPose(e, time) {
  const casting = Number.isFinite(e.castStarted) && time - e.castStarted < .56 && e.castStarted >= (e.attackStarted ?? -1);
  const start = casting ? e.castStarted : e.attackStarted;
  if (!Number.isFinite(start)) return null;
  const age = time - start, duration = casting ? .56 : (e.attackDuration || .46);
  if (age < 0 || age >= duration) return null;
  const windup = casting ? .12 : (e.attackWindup || .12), strike = windup + .10;
  const stage = age < windup ? 0 : age < strike ? 1 : 2;
  const power = age < windup ? -Math.sin(age / windup * Math.PI / 2) * .28 : age < strike ? 1 : Math.pow(1 - (age - strike) / (duration - strike), 2);
  return { stage, age, power, casting, duration, variant: casting ? 0 : (e.attackVariant || 0), angle: casting ? e.castFacing : e.attackFacing };
}

export function drawCombatEffect(renderer, f) {
  const c = renderer.ctx, age = 1 - f.life / f.maxLife, fade = Math.sin(Math.PI * Math.min(1, age * 1.8)) * (1 - age * .5);
  const color = COLORS[f.hero] || f.color || '#d4f5df';
  const a = renderer.project(f.x, f.y, 95), b = renderer.project(f.tx ?? f.x, f.ty ?? f.y, 95);
  const scale = renderer.scale, size = Math.max(18, (f.radius || 130) * scale);
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  if (f.type === 'strike') {
    const angle = Math.atan2(b.y - a.y, b.x - a.x), x = b.x, y = b.y;
    // The strike and damage share the same simulation event and world position.
    c.translate(x, y); c.rotate(angle + (f.variant === 1 ? -.9 : f.variant === 2 ? .65 : 0));
    if (f.variant === 2) c.scale(1.3, 1.3); c.globalAlpha = Math.max(0, 1 - age);
    c.strokeStyle = color; c.fillStyle = color;
    if(f.hero>=4&&![5,7].includes(f.hero)){
      c.beginPath();c.moveTo(-size*.8,0);c.quadraticCurveTo(-size*.2,-size*.25,size*.1,0);c.lineWidth=5*(1-age)+1;c.stroke();
      c.rotate(age*3);c.beginPath();c.moveTo(-size*.15,0);c.lineTo(0,-size*.15);c.lineTo(size*.15,0);c.lineTo(0,size*.15);c.closePath();c.fill();
    } else if (f.hero === 1) {
      for (let j = 0; j < 2; j++) { c.beginPath(); c.ellipse(-8 + age * 12, (j ? 1 : -1) * size * .16, size * (.2 + age * .35), size * .22, j ? .6 : -.6, j ? 0 : Math.PI, j ? Math.PI : TAU); c.lineWidth = (1 - age) * 8 + 1; c.stroke(); }
    } else if (f.hero === 2) {
      const orb = c.createRadialGradient(0, 0, 1, 0, 0, size * .5); orb.addColorStop(0, '#fff7c8'); orb.addColorStop(.3, '#ffc176c0'); orb.addColorStop(1, '#c77c3b00'); c.fillStyle = orb; c.fillRect(-size, -size, size * 2, size * 2);
      c.rotate(age * 2); c.strokeStyle = color; c.lineWidth = 2; c.strokeRect(-size * .21, -size * .21, size * .42, size * .42);
    } else {
      const cuts = f.hero === 3 ? 3 : 2;
      for (let i = 0; i < cuts; i++) { c.beginPath(); const dy = (i - (cuts - 1) / 2) * 9; c.moveTo(-size * .55, -size * .4 + dy); c.quadraticCurveTo(size * .6, -size * .05 + dy, -size * .1, size * .55 + dy); c.lineWidth = 8 * (1 - age) + 1; c.stroke(); c.strokeStyle = '#fffde5'; c.lineWidth = 2 * (1 - age); c.stroke(); c.strokeStyle = color; }
    }
    if (f.variant === 1) { c.strokeStyle = color; c.lineWidth = 3 * (1 - age); c.beginPath(); c.arc(0, 0, size * (.3 + age * .3), -.6, 4); c.stroke(); }
    if (f.variant === 2) { c.strokeStyle = '#fff7d1'; c.lineWidth = 4 * (1 - age); c.beginPath(); c.ellipse(0, 0, size * (.15 + age * .65), size * (.1 + age * .3), 0, 0, TAU); c.stroke(); }
    // Directional fragments travel away from contact, with short bright cores.
    for (let j = 0; j < 9; j++) {
      const theta = j * 2.399 + (f.hero || 0), travel = size * (.12 + age * .85), px = Math.cos(theta) * travel, py = Math.sin(theta) * travel * .7;
      c.strokeStyle = j % 3 ? color : '#fff9e1'; c.lineWidth = (1 - age) * 3 + .5; c.beginPath(); c.moveTo(px * .65, py * .65); c.lineTo(px, py + age * age * 15); c.stroke();
    }
  } else if (f.type === 'spell') {
    const p = renderer.project(f.x, f.y, 18); c.translate(p.x, p.y); c.scale(1, .64);
    c.globalAlpha = Math.max(0, 1 - age); const radius = size * (.25 + age * .85);
    c.strokeStyle=color;c.fillStyle=color;c.lineWidth=3+(1-age)*3;
    const angle=f.angle||0;c.rotate(angle);
    if(f.hero>=4){drawLegendSpell(c,f.hero,f.slot,radius,age,color);}
    else if(f.hero===0){
      if(f.slot===1){for(let j=-3;j<=3;j++){c.save();c.rotate(j*.28);c.beginPath();c.moveTo(radius*.2,-5);c.quadraticCurveTo(radius*.55,-20,radius,0);c.quadraticCurveTo(radius*.55,17,radius*.2,5);c.stroke();c.restore();}}
      else if(f.slot===2){c.rotate(-angle);c.beginPath();c.moveTo(-radius*.55,0);c.quadraticCurveTo(0,-radius*.48,radius*.55,0);c.quadraticCurveTo(0,radius*.48,-radius*.55,0);c.stroke();c.beginPath();c.arc(0,0,radius*.14,0,TAU);c.fill();}
      else {if(f.slot===3){c.fillStyle='#10132999';c.beginPath();c.arc(0,0,radius,0,TAU);c.fill();}for(let j=0;j<12;j++){const t=j/12*TAU+age;c.save();c.translate(Math.cos(t)*radius,Math.sin(t)*radius);c.rotate(t);c.fillStyle=j%2?'#7565a9':'#cbbce8';c.beginPath();c.moveTo(-15,-6);c.quadraticCurveTo(0,-24*Math.sin(age*18+j),15,-6);c.lineTo(0,6);c.fill();c.restore();}}
    } else if(f.hero===1){
      if(f.slot===2){c.beginPath();c.arc(0,0,radius,-1.25,1.25);c.stroke();for(let j=0;j<5;j++){const t=-1+j*.5;c.beginPath();c.moveTo(Math.cos(t)*radius*.7,Math.sin(t)*radius*.7);c.lineTo(Math.cos(t)*radius*1.1,Math.sin(t)*radius*1.1);c.stroke();}}
      else if(f.slot===1||f.slot===3){c.beginPath();for(let j=0;j<=100;j++){const t=j/100*TAU*2.5,r=radius*j/100;const x=Math.cos(t-age*9)*r,y=Math.sin(t-age*9)*r;j?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();}
      else for(let j=0;j<3;j++){c.beginPath();c.arc(j*25,0,radius*(1-j*.2),-.8,.8);c.stroke();}
    } else if(f.hero===2){
      if(f.slot===0){c.beginPath();for(let j=0;j<6;j++){const t=j/6*TAU;j?c.lineTo(Math.cos(t)*radius,Math.sin(t)*radius):c.moveTo(radius,0);}c.closePath();c.stroke();}
      else if(f.slot===1){for(let j=0;j<8;j++){const t=j/8*TAU;c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(Math.cos(t+.4)*radius*.5,Math.sin(t+.4)*radius*.5,Math.cos(t)*radius,Math.sin(t)*radius);c.stroke();}}
      else if(f.slot===2){c.strokeStyle='#dcb1ff';c.setLineDash([8,9]);c.beginPath();c.arc(0,0,radius,0,TAU);c.stroke();}
      else{c.beginPath();c.arc(0,0,radius,0,TAU);c.stroke();for(let j=-1;j<=1;j+=2){c.save();c.translate(j*radius*.27,0);c.rotate(-angle);c.strokeRect(-12,-26,24,52);c.restore();}}
    } else {
      c.strokeStyle='#ff8e79';
      if(f.slot===2){for(let j=-1;j<=1;j++){c.beginPath();c.moveTo(radius*.15,-radius*.4+j*20);c.quadraticCurveTo(radius,radius*.15+j*20,radius*.2,radius*.6+j*20);c.stroke();}}
      else if(f.slot===1){for(let j=0;j<3;j++){c.beginPath();c.arc(0,0,radius*(1-j*.18),0,TAU);c.stroke();}}
      else if(f.slot===3){c.rotate(-angle);c.fillStyle='#c1434777';c.beginPath();c.arc(0,0,radius*.7,.6,TAU-.6);c.quadraticCurveTo(-radius*.6,0,radius*.7*Math.cos(.6),radius*.7*Math.sin(.6));c.fill();}
      else{c.beginPath();for(let j=0;j<16;j++){const t=j/16*TAU,r=radius*(j%2?.75:1);j?c.lineTo(Math.cos(t)*r,Math.sin(t)*r):c.moveTo(r,0);}c.closePath();c.stroke();}
    }
  } else if(f.type==='mortar'){
    const t=Math.min(1,age),x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t-Math.sin(t*Math.PI)*100*scale;
    c.globalAlpha=1;c.fillStyle='#f1cf91';c.shadowColor='#d58bff';c.shadowBlur=15;c.beginPath();c.arc(x,y,9*scale+3,0,TAU);c.fill();
  } else if (f.tx !== undefined) {
    c.globalAlpha = 1 - age; c.strokeStyle = color;
    const t = Math.min(1, age * 2), x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t - Math.sin(t * Math.PI) * 22;
    c.lineWidth = 5 * (1 - age) + 1; c.beginPath(); c.moveTo(a.x + (x - a.x) * .55, a.y + (y - a.y) * .55); c.quadraticCurveTo((a.x + x) / 2, Math.min(a.y, y) - 25, x, y); c.stroke();
    c.fillStyle = '#fffbe4'; c.beginPath(); c.arc(x, y, 3 + 3 * (1 - age), 0, TAU); c.fill();
  } else {
    c.globalAlpha = fade; c.strokeStyle = f.color; c.lineWidth = f.type === 'ultimate' ? 5 : 2;
    c.beginPath(); c.ellipse(a.x, a.y + 70 * scale, size * (.25 + age), size * (.25 + age) * .55, 0, 0, TAU); c.stroke();
  }
  c.restore();
}

export function drawSkillZone(r,z,time){
  const c=r.ctx,p=r.project(z.x,z.y,8),radius=z.radius*r.scale;
  c.save();c.translate(p.x,p.y);c.scale(1,.64);c.lineWidth=2.5;
  if(z.legend){
    const color=COLORS[z.hero];c.strokeStyle=color+'99';c.fillStyle=color+'18';c.setLineDash(time<(z.armed||0)?[6,7]:[]);c.beginPath();c.arc(0,0,radius,0,TAU);c.fill();c.stroke();c.setLineDash([]);c.globalAlpha=.45;drawLegendSpell(c,z.hero,z.type==='decoy'?0:3,radius*.8,(time*.3)%1,color);
  }else if(z.type==='witchfire'){
    const warning=time<z.armed;c.strokeStyle=warning?'#edb3ff':'#ffb075';c.fillStyle=warning?'#a346c41a':'#b34d4b35';
    c.beginPath();c.arc(0,0,radius,0,TAU);c.fill();c.setLineDash(warning?[6,7]:[]);c.stroke();
    if(!warning)for(let j=0;j<9;j++){const a=j*2.399,rr=radius*(.25+(j%3)*.22),x=Math.cos(a)*rr,y=Math.sin(a)*rr;c.fillStyle=j%2?'#ffcd83aa':'#c78bff99';c.beginPath();c.moveTo(x-7,y);c.quadraticCurveTo(x+12,y-24-Math.sin(time*8+j)*8,x,y-37);c.quadraticCurveTo(x-13,y-20,x+7,y);c.fill();}
  }else if(z.type==='maelstrom'){
    c.fillStyle='#46bcb82b';c.strokeStyle='#a1f5dd9f';c.beginPath();c.arc(0,0,radius,0,TAU);c.fill();
    for(let arm=0;arm<3;arm++){c.beginPath();for(let j=0;j<60;j++){const t=j/60,a=t*TAU*1.5-time*2+arm*TAU/3,rr=radius*t;j?c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):c.moveTo(0,0);}c.stroke();}
  }else{c.strokeStyle=z.type==='water'?'#8febd999':'#efd48c88';c.beginPath();c.arc(0,0,radius,0,TAU);c.stroke();}
  c.restore();
}
function drawLegendSpell(c,hero,slot,radius,age,color){
 c.strokeStyle=color;c.fillStyle=color;
 const count=slot===3?9:5;
 for(let j=0;j<count;j++){
  const a=j/count*TAU+age*(hero===6?3:1),r=radius*(.45+age*.55),x=Math.cos(a)*r,y=Math.sin(a)*r;
  c.save();c.translate(x,y);c.rotate(a);
  if(hero===4){c.beginPath();c.moveTo(-r*.35,0);c.bezierCurveTo(-r*.3,-r*.6,r*.4,-r*.7,r*.3,0);c.quadraticCurveTo(r*.05,r*.15,0,0);c.stroke();}
  if(hero===5){c.beginPath();c.moveTo(-6,0);c.lineTo(0,-15-age*16);c.lineTo(7,0);c.closePath();c.stroke();}
  if(hero===6){c.beginPath();c.moveTo(-6,0);c.quadraticCurveTo(0,-20,7,0);c.quadraticCurveTo(0,10,-6,0);c.fill();}
  if(hero===7){c.beginPath();c.moveTo(-r*.3,0);c.lineTo(0,-10);c.lineTo(r*.1,7);c.lineTo(r*.25,-3);c.stroke();}
  if(hero===8){c.beginPath();c.ellipse(0,0,8,15,0,Math.PI,TAU);c.lineTo(8,16);c.lineTo(0,9);c.lineTo(-8,16);c.closePath();c.stroke();}
  if(hero===9){c.beginPath();c.moveTo(-8,7);c.quadraticCurveTo(-11,-10,0,-26);c.quadraticCurveTo(2,-7,8,-12);c.quadraticCurveTo(14,12,-8,7);c.fill();}
  if(hero===10){c.beginPath();c.moveTo(-10,0);c.quadraticCurveTo(0,-16,12,0);c.quadraticCurveTo(0,16,-10,0);c.fill();c.strokeStyle='#0b222a';c.lineWidth=1;c.beginPath();c.moveTo(-7,0);c.lineTo(8,0);c.stroke();}
  if(hero===11){c.beginPath();c.moveTo(-17,0);c.bezierCurveTo(-5,-15,2,15,17,0);c.stroke();c.beginPath();c.arc(17,0,3,0,TAU);c.fill();}
  c.restore();
 }
 if(slot===3){c.beginPath();c.arc(0,0,radius,0,TAU);c.stroke();}
}
