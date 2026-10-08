import {CENTER_LANE,LANE_COUNT} from './lanes.js';

// World coordinates, not screen-space particles: every patch shares course speed.
// `done` means the crossing was scored, not that the physical hazard vanished.
// A dodged rock or jumped log still has to pass the raft and leave the camera.
export function worldEntityVisible(entity,distance,view){
  const ahead=entity.d-distance,pickup=entity.type==='coin'||entity.type==='magnet'||entity.type==='shield'||entity.type==='target';
  return ahead<=view&&ahead>(pickup?-5:-16)&&!(pickup?entity.collected:entity.destroyed);
}
export function bankScenery(distance,view=140){
  const first=Math.floor((distance-22)/14),last=Math.ceil((distance+view)/14),items=[];
  for(let n=first;n<=last;n++)for(const side of [-1,1]){
    const hash=((Math.imul(n,1597334677)^Math.imul(side,3812015801))>>>0)/4294967296;
    const z=n*14+(side===1?7:0)-distance;
    if(z<=-18||z>=view)continue;
    items.push({id:`${n}:${side}`,z,lane:CENTER_LANE+side*(CENTER_LANE+2.1+hash*.45),kind:Math.abs(n+(side===1?2:0))%3,variant:Math.abs(n)%3,size:1.2+hash*.7});
  }
  return items.sort((a,b)=>b.z-a.z);
}
export function rapids(distance,view=140){
  const first=Math.floor((distance-12)/5.5),last=Math.ceil((distance+view)/5.5),items=[];
  for(let n=first;n<=last;n++){
    const z=n*5.5-distance;
    if(z<=-10||z>=view)continue;
    items.push({z,lane:CENTER_LANE+Math.sin(n*2.399)*(LANE_COUNT/2-.35),width:.65+(Math.sin(n*1.73)+1)*.28,variant:Math.abs(n)%3});
  }
  return items;
}
// Analytic spring is stable and gives the same trajectory at any refresh rate.
export function laneSpring(position,velocity,target,dt){
  // A short carving glide: immediate input, gradual first movement and no
  // discontinuity when reversing. Reaches 95% in about 132 ms.
  const omega=36,offset=position-target,coefficient=velocity+omega*offset,decay=Math.exp(-omega*dt);
  return{position:target+(offset+coefficient*dt)*decay,velocity:(velocity-omega*coefficient*dt)*decay};
}
export function duckCompression(action,actionTime,seconds=.6){
  if(action!=='duck')return 0;
  return Math.min(1,actionTime/.075,(seconds-actionTime)/.09);
}

export function prepareWorldArt(){
  const make=(w,h,paint)=>{const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;paint(canvas.getContext('2d'));return canvas;};
  const foam=[0,1,2].map(v=>make(384,72,ctx=>{
    ctx.lineCap='round';
    for(let j=0;j<9;j++){
      ctx.strokeStyle=j<3?'#ddffef90':'#f0fffbbb';ctx.lineWidth=j<3?9:2;
      ctx.beginPath();const x=12+j*34,y=26+Math.sin(j*2.4+v)*12;
      ctx.moveTo(x,y);ctx.quadraticCurveTo(x+18,y+18,x+45,y+3);ctx.stroke();
    }
  }));
  return{foam};
}
