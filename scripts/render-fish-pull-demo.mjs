// Deterministic explanatory diagram. The power meter uses the game's actual pull model.
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { PullStrength } from '../public/fish/js/pull.js';
const sharp = createRequire(import.meta.url)('sharp');
const OUT = process.env.PULL_DEMO_OUT || fileURLToPath(new URL('../public/fish/clips/', import.meta.url));
mkdirSync(OUT, { recursive: true });
const W=720,H=1280,FPS=30,DURATION=24;
const C={bg:'#092229',panel:'#10343d',ink:'#f6efd9',muted:'#b9c9c4',gold:'#e8b64a',red:'#ff7866',green:'#9cdbaf'};
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x)};
const tween=(t,a,b,x,y)=>x+(y-x)*ease((t-a)/(b-a));
const f=x=>Number(x).toFixed(2);
const text=(x,y,s,size=24,color=C.ink,weight=500,extra='')=>`<text x="${x}" y="${y}" fill="${color}" font-family="DejaVu Sans, sans-serif" font-size="${size}" font-weight="${weight}" ${extra}>${s}</text>`;
const stages=[
 {at:0,end:4,n:'01',lines:['Reel with','your thumb.'],sub:'Keep the crank turning.'},
 {at:4,end:10,n:'02',lines:['Tip the','phone back.'],sub:'Bring the top edge toward you.'},
 {at:10,end:15,n:'03',lines:['Hold.','Keep reeling.'],sub:'A small tilt adds up to 35% power.'},
 {at:15,end:20,n:'04',lines:['Ease off','a tight line.'],sub:'Lower the phone. Stop reeling.'},
 {at:20,end:24,n:'↺',lines:['Pull back','as you reel.'],sub:'Use a small, smooth movement.'}
];
const power=new PullStrength();
const states=[];let fishX=565,crankAngle=0;
for(let i=0;i<DURATION*FPS;i++){
 const t=i/FPS;
 let tilt=t<4?0:t<7?tween(t,4.7,7,0,33):t<15?33:t<18?tween(t,15.2,18,33,0):t<20.5?0:tween(t,20.5,22.7,0,33);
 const crank=t<.65||t>=15&&t<20?0:.75;
 const tension=t<14?tween(t,4,12,.34,.58):t<15.5?tween(t,14,15.5,.58,.91):t<19?tween(t,16,19,.91,.37):.37;
 const p=power.step(1/FPS,{theta:70+tilt,enabled:true,active:true,crank,tension,session:1});
 crankAngle+=crank*9;
 if(crank)fishX-=.16*(1+p*.35);
 states.push({t,tilt,p,crank,tension,fishX,crankAngle});
}
function headline(t){
 return stages.map((s,i)=>{
  const enter=ease((t-s.at)/.45),leave=i===stages.length-1?1:1-ease((t-s.end)/.38);
  const alpha=enter*leave;if(alpha<=0)return '';
  return `<g opacity="${f(alpha)}" transform="translate(0 ${f(14*(1-enter))})">${text(54,82,`REEL IT IN  /  ${s.n}`,18,C.gold,700,'letter-spacing="3"')}${text(50,159,s.lines[0],62,C.ink,700)}${text(50,229,s.lines[1],62,C.ink,700)}${text(54,278,s.sub,25,C.muted)}</g>`;
 }).join('');
}
function phone(angle,ghost=false,crankAngle=0,t=0){
 const rot=-angle;
 if(ghost)return `<g transform="translate(471 658) rotate(0)" opacity=".22"><rect x="-77" y="-270" width="154" height="284" rx="25" fill="none" stroke="${C.ink}" stroke-width="3" stroke-dasharray="9 9"/></g>`;
 return `<g transform="translate(471 658) rotate(${f(rot)})">
  <rect x="-77" y="-269" width="160" height="290" rx="27" fill="#03161c" stroke="#527b80" stroke-width="2"/>
  <rect x="-82" y="-276" width="156" height="290" rx="26" fill="#d8e1d4"/>
  <rect x="-76" y="-270" width="144" height="278" rx="21" fill="#092a33"/>
  <rect x="-58" y="-246" width="108" height="216" rx="8" fill="#164751"/>
  <path d="M-58-201Q-23-218 10-204T50-202V-246H-58Z" fill="#8cafaa"/>
  <path d="M-56-196Q-4-211 50-194M-56-187Q-4-202 50-185" fill="none" stroke="#b3cbc1" stroke-width="2"/>
  <rect x="-24" y="-262" width="40" height="5" rx="2.5" fill="#507377"/>
  <rect x="-24" y="-15" width="40" height="4" rx="2" fill="#638489"/>
  <circle cx="-4" cy="-119" r="48" fill="#092c36" stroke="#668886" stroke-width="3"/>
  <circle cx="-4" cy="-119" r="32" fill="none" stroke="${C.gold}" stroke-opacity=".4" stroke-width="2" stroke-dasharray="4 6"/>
  <g transform="rotate(${f(crankAngle)} -4 -119)"><path d="M-4-119L24-148" stroke="${C.gold}" stroke-width="8" stroke-linecap="round"/><circle cx="24" cy="-148" r="12" fill="${C.red}"/><circle cx="24" cy="-148" r="20" fill="${C.red}" opacity=".18"/><circle cx="24" cy="-148" r="7" fill="#ffdec0" stroke="${C.ink}" stroke-width="2"/></g>
  <circle cx="-4" cy="-119" r="7" fill="${C.gold}"/>
  <path d="M38-163Q62-131 39-86m0-14 0 14 13-3" fill="none" stroke="${C.ink}" stroke-width="3" stroke-linecap="round"/>
  ${text(-4,-48,'REEL',13,C.ink,700,'text-anchor="middle" letter-spacing="2"')}
  <path d="M-59 18L-76-25Q-88-57-73-62Q-63-65-51-33L-44-18L-35-41Q-31-52-23-49L21-29Q42-20 38 2L29 40H-31Z" fill="#dba983" stroke="#f2cbae" stroke-width="3"/>
  <path d="M-49-8L-42 11M-25-30L-31-12M-5-20L-13-4M15-11L9 3" stroke="#9d6852" stroke-width="3" fill="none" stroke-linecap="round"/>
 </g>`;
}
function render(st){
 const {t,tilt,p,crank,tension,fishX,crankAngle}=st;
 const warning=tension>.7;
 const color=warning?C.red:C.green;
 const arrowVisible=ease((t-4.2)/.5)*(t<15?1:t<20?0:1);
 const tipX=471-270*Math.sin(tilt*Math.PI/180),tipY=658-270*Math.cos(tilt*Math.PI/180);
 const u=(t*.5)%1,ax=(1-u)**2*466+2*(1-u)*u*364+u*u*309,ay=(1-u)**2*365+2*(1-u)*u*316+u*u*403;
 const num=Math.round(p*35);
 const fillw=568*p;
 const ambient=Math.sin(t*1.2)*4;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 720 1280">
 <defs><radialGradient id="glow"><stop stop-color="#1b5157" stop-opacity=".7"/><stop offset="1" stop-color="#092229" stop-opacity="0"/></radialGradient><linearGradient id="power"><stop stop-color="#95c5aa"/><stop offset="1" stop-color="${C.gold}"/></linearGradient><clipPath id="lake"><rect x="48" y="996" width="624" height="178" rx="20"/></clipPath></defs>
 <rect width="720" height="1280" fill="${C.bg}"/>
 <ellipse cx="435" cy="508" rx="335" ry="300" fill="url(#glow)"/>
 <path d="M52 307H668" stroke="#2c5055"/>
 ${headline(t)}
 ${text(54,342,'YOUR MOVEMENT',15,C.muted,700,'letter-spacing="2.5"')}
 ${text(608,342,'SIDE VIEW',13,C.muted,500,'text-anchor="end"')}
 <!-- A person facing the phone. The arm ends at the wrist pivot. -->
 <g opacity=".88">
  <path d="M83 725L83 589Q77 548 112 525L151 519Q190 532 205 573L232 725Z" fill="#23505a"/>
  <path d="M115 520V488H157V530" fill="#b78970"/>
  <path d="M105 480Q80 468 89 433Q79 405 101 387Q123 370 152 385Q174 400 171 425L186 444Q190 450 173 453L170 476Q167 494 143 495Z" fill="#d3a88c"/>
  <path d="M89 435Q79 416 92 395Q116 365 151 384Q175 394 172 416L148 402L109 411L104 436Z" fill="#31484a"/>
  <path d="M159 425h4M166 464h8" stroke="#694f43" stroke-width="3" stroke-linecap="round"/>
  <path d="M173 571Q225 644 301 661L436 678" fill="none" stroke="#d3a88c" stroke-width="41" stroke-linecap="round"/>
  <path d="M169 568Q188 607 225 628" fill="none" stroke="#2a5962" stroke-width="58" stroke-linecap="round"/>
 </g>
 ${text(84,557,'YOU',16,C.muted,700,'letter-spacing="2"')}
 ${phone(0,true)}
 <g opacity="${f(arrowVisible)}"><path d="M466 365Q364 316 309 403" stroke="${C.gold}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M310 380L309 403L333 399" fill="none" stroke="${C.gold}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${f(ax)}" cy="${f(ay)}" r="7" fill="${C.ink}"/></g>
 ${phone(tilt,false,crankAngle,t)}
 <circle cx="471" cy="658" r="9" fill="${C.gold}" stroke="${C.bg}" stroke-width="4"/>
 <path d="M486 671L555 702H632" fill="none" stroke="#7fa09c" stroke-width="2"/>
 ${text(632,727,'SMALL WRIST TILT',14,C.muted,700,'text-anchor="end"')}
 <!-- The same meter used in the game, enlarged to make cause and effect clear. -->
 <rect x="48" y="766" width="624" height="194" rx="24" fill="${C.panel}" stroke="#2c5055"/>
 ${text(75,806,'PULL STRENGTH',19,C.muted,700,'letter-spacing="2"')}
 ${text(639,818,`+${num}%`,49,num>0?C.gold:C.muted,700,'text-anchor="end"')}
 <rect x="76" y="843" width="568" height="22" rx="11" fill="#061c24"/>
 ${fillw>0?`<rect x="76" y="843" width="${f(Math.max(1,fillw))}" height="22" rx="11" fill="url(#power)"/>`:''}
 ${text(76,893,crank?(p>.03?'More power while you reel':'Turn the crank, then tip back'):'Reel paused',20,C.ink,600)}
 ${text(76,935,'LINE TENSION',13,warning?C.red:C.muted,700,'letter-spacing="1.2"')}
 <rect x="247" y="923" width="235" height="10" rx="5" fill="#061c24"/><rect x="247" y="923" width="${f(235*tension)}" height="10" rx="5" fill="${color}"/>
 ${text(640,935,warning?'EASE OFF':'STEADY',15,color,700,'text-anchor="end"')}
 ${text(54,986,'IN THE GAME',14,C.muted,700,'letter-spacing="2"')}
 <g clip-path="url(#lake)"><rect x="48" y="996" width="624" height="178" fill="#123c49"/>
  <path d="M48 1040Q135 ${1035+ambient} 228 1041T414 1041T672 1041V1174H48Z" fill="#1b5463"/>
  <path d="M48 1043Q135 ${1038+ambient} 228 1044T414 1044T672 1044M60 1132Q139 1126 216 1132T371 1132T526 1132T681 1132" fill="none" stroke="#427985" stroke-width="2"/>
  <path d="M79 1078L129 1019Q174 ${1002-tilt*.2} 225 ${1032-tilt*.32}" fill="none" stroke="${C.gold}" stroke-width="5" stroke-linecap="round"/>
  <path d="M225 ${1032-tilt*.32}Q${f((225+fishX)*.5)} ${1078+warning*10} ${f(fishX-31)} 1094" stroke="${warning?C.red:C.ink}" fill="none" stroke-width="2.5"/>
  <g transform="translate(${f(fishX)} ${f(1095+Math.sin(t*4)*3)})"><path d="M-39 0Q-13-28 30-11L55-28L49 0L55 28L30 11Q-13 28-39 0Z" fill="${C.gold}"/><path d="M-4-18L12-33L21-13M-1 18L17 29L23 14" fill="#ae8434"/><circle cx="-25" cy="-4" r="3.5" fill="#143640"/><path d="M-12-12Q-23 0-12 12" fill="none" stroke="#ba8c39" stroke-width="2"/></g>
  ${crank?`<path d="M${f(fishX+90)} 1100h-25m8-7-8 7 8 7" fill="none" stroke="#9ecabf" stroke-width="3" opacity="${f(.45+.4*Math.sin(t*4)**2)}"/>`:''}
 </g>
 ${text(360,1212,warning?'Give the line time to relax.':p>.1?'Extra reel power brings the fish closer.':'The phone acts as your fishing rod.',21,C.ink,500,'text-anchor="middle"')}
 <rect x="48" y="1244" width="624" height="4" rx="2" fill="#284b50"/><rect x="48" y="1244" width="${f(624*t/DURATION)}" height="4" rx="2" fill="${C.gold}"/>
 </svg>`;
}
await sharp(Buffer.from(render(states[9*FPS]))).resize(360,640).webp({quality:80}).toFile(OUT+'/pull-back-poster.webp');
if(process.argv.includes('--preview')) {
const frames=[2,6,9,12.5,16,22.8];
const tiles=[];
for(const t of frames){
 const svg=render(states[Math.round(t*FPS)]);
 const png=await sharp(Buffer.from(svg)).png().toBuffer();
 writeFileSync(`${OUT}/pull-frame-${t}.png`,png);
 tiles.push({input:await sharp(png).resize(270,480).toBuffer(),left:tiles.length%3*270,top:Math.floor(tiles.length/3)*480});
}
await sharp({create:{width:810,height:960,channels:3,background:C.bg}}).composite(tiles).png().toFile(OUT+'/pull-demo-storyboard.png');
process.exit(0);
}
const ff=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate',String(FPS),'-i','-','-an','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',OUT+'/pull-back-demo.mp4'],{stdio:['pipe','inherit','inherit']});
const done=once(ff,'close');
for(let i=0;i<states.length;i++){
 const png=await sharp(Buffer.from(render(states[i]))).png().toBuffer();
 if(!ff.stdin.write(png))await once(ff.stdin,'drain');
 if(i%180===0)console.log(`Rendered ${i/FPS}s / ${DURATION}s`);
}
ff.stdin.end();const [code]=await done;if(code!==0)throw Error(`ffmpeg: ${code}`);
console.log('Created '+OUT+'/pull-back-demo.mp4');
