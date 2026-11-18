const fs = require('node:fs');
const path = require('node:path');
const { KIT } = require(process.env.INK_STUDIO_PATH || '@shapeshift-labs/ink-studio').load();
const art = path.resolve(__dirname, '../art');
const layout = require('../art/course.json');
const { dualContour } = KIT.procedural.geometry;
const TAU = Math.PI * 2;

const OUT = ['stone', 'floor', 'glass', 'bronze', 'wood', 'leaf', 'rock', 'snow', 'ice'];
const shades = [
  { stone:0x637783, floor:0x637180, glass:0x72d5d5, bronze:0x827350, rock:0x293c4b },
  { stone:0x8b8f76, floor:0x838568, wood:0x574231, leaf:0x789644, bronze:0x8b6d43, rock:0x445044 },
  { stone:0x647581, floor:0x788898, bronze:0x697277, rock:0x485866, snow:0xc4d5dc, ice:0x6ba7bf },
];

function random(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function roundedBox(x,y,z, half, bevel) {
  const a=Math.abs(x)-half[0]+bevel, b=Math.abs(y)-half[1]+bevel, c=Math.abs(z)-half[2]+bevel;
  return Math.hypot(Math.max(a,0),Math.max(b,0),Math.max(c,0))+Math.min(Math.max(a,b,c),0)-bevel;
}

function colorOf(hex, brightness) {
  return [16,8,0].map(shift => Math.min(1, ((hex >> shift) & 255) / 255 * brightness));
}

function builder(zone) {
  const rng = random(2830+zone);
  const batches = Object.fromEntries(OUT.map(name => [name,{vertices:[], indices:[]}]));
  const boxCache = new Map();
  const rockCache = new Map();
  function ink(field, half, cell) {
    const margin = cell * 1.5;
    return dualContour(field, {min:half.map(v=>-v-margin),max:half.map(v=>v+margin)}, {
      cell, maxCells:500000, maxSamples:7500000,
    });
  }
  function stamp(mesh, kind, position, scale=[1,1,1], angle=0, brightness=1, hex=shades[zone][kind]) {
    const data=batches[kind], offset=data.vertices.length/9, c=Math.cos(angle), s=Math.sin(angle);
    const rgb=colorOf(hex,brightness);
    for (let i=0;i<mesh.points.length;i++) {
      const p=mesh.points[i], n=mesh.normals[i];
      const x=p[0]*scale[0], y=p[1]*scale[1], z=p[2]*scale[2];
      const nx=n[0]/scale[0], ny=n[1]/scale[1], nz=n[2]/scale[2], length=Math.hypot(nx,ny,nz)||1;
      data.vertices.push(position[0]+c*x+s*z,position[1]+y,position[2]-s*x+c*z,
        (c*nx+s*nz)/length,ny/length,(-s*nx+c*nz)/length,...rgb);
    }
    for (const [a,b,c] of mesh.triangles) data.indices.push(offset+a,offset+c,offset+b);
  }
  function box(kind, p, h, angle=0, tone=.88+rng()*.22) {
    const key = h.map(v=>v.toFixed(3)).join('/');
    const work=h.map(v=>Math.max(v,.22));
    if (!boxCache.has(key)) {
      const bevel=Math.min(.105, Math.min(...work)*.58);
      boxCache.set(key, ink((x,y,z)=>roundedBox(x,y,z,work,bevel),work,.205));
    }
    stamp(boxCache.get(key),kind,p,h.map((v,i)=>v/work[i]),angle,tone);
  }
  function rock(p, size, variant, tone=1) {
    if (!rockCache.has(variant)) {
      const mesh = ink((x,y,z)=>{
        const ripples=.12*Math.sin(5.6*x+variant)*Math.sin(4*z-3.3*y) + .055*Math.sin(7*y+5*z+variant);
        const main=Math.hypot(x*.92,y*.95,z*.97)-.91+ripples;
        return Math.max(main, (Math.abs(x+z*.35)-.81)*.83, (Math.abs(z-x*.26)-.85)*.85);
      },[1.3,1.3,1.3],.112);
      rockCache.set(variant,mesh);
    }
    stamp(rockCache.get(variant),'rock',p,size,variant*.67,tone);
  }
  function faces(kind, points, indices, tint, tone=1) {
    const data=batches[kind], start=data.vertices.length/9;
    for (const v of points) data.vertices.push(...v,...colorOf(tint,tone));
    for (const i of indices) data.indices.push(i+start);
  }
  // Segment on a plane in local XY, optionally turned to face the walkway.
  function frame(at, turn) {
    const c=Math.cos(turn), s=Math.sin(turn);
    return (x,y,z)=>[at[0]+x*c+z*s,at[1]+y,at[2]-x*s+z*c];
  }
  function pointedWidth(v, radius, spring) {
    if (v<=spring) return radius;
    const offset=radius*.45, rr=radius+offset;
    return Math.max(0,Math.sqrt(Math.max(0,rr*rr-(v-spring)**2))-offset);
  }
  function arch(at, radius, spring, yaw, {fill=false, tower=false}={}) {
    const toWorld=frame(at,yaw), rim=.30;
    const tip=spring+Math.sqrt((radius*1.45)**2-(radius*.45)**2);
    const inside=(x,y)=>Math.abs(x)-pointedWidth(y,radius,spring);
    const field=(x,y,z)=>{
      const inner=inside(x,y);
      const outer=Math.max(Math.abs(x)-pointedWidth(y,radius+rim,spring+.035),-y,Math.abs(z)-.36);
      return Math.max(outer,-inner, y-tip-.41);
    };
    const ashlar=ink((x,y,z)=>field(x,y+tip*.5,z),[radius+rim+.07,tip*.5+.52,.40],.093);
    stamp(ashlar,'stone',toWorld(0,tip*.5,0),[1,1,1],yaw,1.12);
    // Raised, individually cut stones follow both radii of a Gothic arch.
    const offset=radius*.45;
    const riseAngle=Math.acos(offset/(radius*1.45));
    const voussoirHalf=[.115,Math.max(.135,radius*.078),.063];
    const plate=ink((x,y,z)=>roundedBox(x,y,z,voussoirHalf,.027),voussoirHalf,.048);
    for(const side of [-1,1]) for(let i=0;i<12;i++){
      const theta=(i+.5)*riseAngle/12;
      const outer=radius*1.45+.19;
      const x=(Math.cos(theta)*outer-offset)*side;
      const y=spring+Math.sin(theta)*outer;
      const rotate=side*theta;
      const r=Math.cos(rotate), t=Math.sin(rotate);
      const spun={points:plate.points.map(([x,y,z])=>[r*x-t*y,t*x+r*y,z]),
        normals:plate.normals.map(([x,y,z])=>[r*x-t*y,t*x+r*y,z]),triangles:plate.triangles};
      stamp(spun,'stone',toWorld(x,y,.353),[1,1,1],yaw,.96+rng()*.14);
    }
    for (const x of [-radius-.19,radius+.19]) {
      for(const y of [.16,.32,spring-.10,spring+.035]) box('stone',toWorld(x,y,0),[.34,.075,.47],yaw,1.09);
      if (tower) box('stone',toWorld(x-.26*Math.sign(x),tip*.48,-.55),[.13,tip*.47,.24],yaw,.78);
    }
    if (!fill) return;
    const panes=14;
    function glassPane(corners,tint) {
      const n=[Math.sin(yaw),0,Math.cos(yaw)];
      faces('glass',corners.map(v=>[...toWorld(...v),...n]),[0,2,1,0,3,2],tint);
    }
    for(let row=0;row<panes;row++){
      const low=.43+(tip-.50)*row/panes, high=.43+(tip-.50)*(row+1)/panes;
      const w0=pointedWidth(low,radius,spring)-.042;
      const w1=pointedWidth(high,radius,spring)-.042;
      if(w1<=0) break;
      for(let lane=0;lane<5;lane++){
        const u=lane/2.5-1, v=(lane+1)/2.5-1;
        const tones=[0x5e99a3,0x7ebaca,0x6da6be,0x9ce3d5,0x487b99,0x75aead];
        const col=tones[Math.floor(rng()*tones.length)];
        const ll=u*w0+.016, lr=v*w0-.016, hl=u*w1+.016, hr=v*w1-.016;
        if (hr<=hl) continue;
        const mid=(ll+lr+hl+hr)*.25, cy=(low+high)*.5;
        glassPane([[ll,low+.012,-.13],[lr,low+.012,-.13],[hr,high-.012,-.13],[hl,high-.012,-.13]],col);
        if (lane===2 || (row+lane)%2===0) {
          const spread = Math.min(.086,(hr-hl)*.21);
          glassPane([[mid,low+.037,-.119],[mid+spread,cy,-.119],[mid,high-.037,-.119],[mid-spread,cy,-.119]],
            lane === 2 && row%5===1 ? 0xe3b983 : 0xb8ebdb);
        }
      }
    }
    for(let lane=-2;lane<=2;lane++) {
      const x=lane*radius*.20;
      const height=spring+Math.sqrt((radius*1.45)**2-(Math.abs(x)+radius*.45)**2)-.53;
      box('bronze',toWorld(x,.43+height*.5,-.12),[lane===0?.032:.019,height*.5,.024],yaw,.86);
    }
    // Masonry fills the spandrel while leaving the pointed window cutout open.
    for(let row=0;row<17;row++) {
      const y=.28+row*.46;
      for(let col=0;col<8;col++) {
        const x=(col-3.5)*.61+(row%2 ? .27:0);
        if(y<tip+.18 && (y<spring+.23 ? Math.abs(x)<radius+.27 : inside(x,Math.max(0,y-.23))<.33)) continue;
        box('stone',toWorld(x,y,-.41),[.293,.217,.31],yaw,.70+rng()*.24);
      }
    }
    for(const high of [spring-.17,tip+.50,tip+1.38]) {
      box('stone',toWorld(0,high,-.37),[2.43,.09,.40],yaw,.87);
    }
  }
  function tube(kind, a, b, r0, r1, hex=shades[zone][kind], tone=1, count=9) {
    const sub=(a,b)=>a.map((v,i)=>v-b[i]);
    const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    const norm=v=>v.map(n=>n/(Math.hypot(...v)||1));
    const axis=norm(sub(b,a));
    const u=norm(cross(axis,Math.abs(axis[1])>.8?[1,0,0]:[0,1,0]));
    const v=cross(axis,u), verts=[], ind=[];
    for(let row=0;row<2;row++) for(let j=0;j<count;j++){
      const angle=TAU*j/count, n=u.map((x,i)=>x*Math.cos(angle)+v[i]*Math.sin(angle));
      verts.push([...(row?b:a).map((x,i)=>x+n[i]*(row?r1:r0)),...n]);
    }
    for(let j=0;j<count;j++){
      const n=(j+1)%count;
      ind.push(j,n,j+count,n,n+count,j+count);
    }
    faces(kind,verts,ind,hex,tone);
  }
  function leaf(p,size,yaw,slope,hex) {
    const c=Math.cos(yaw), s=Math.sin(yaw), [x,y,z]=p;
    const positions=[[-.58,0,0],[0,.18,-.36],[.72,slope,0],[0,.19,.36],[0,.25,0]];
    faces('leaf',positions.map(([a,b,d])=>[x+(a*c-d*s)*size,y+b*size,z+(a*s+d*c)*size,0,1,0]),
      [0,1,4,1,2,4,2,3,4,3,0,4],hex,.75+rng()*.38);
  }
  function tree(origin, height, lean, seed) {
    const [x,y,z]=origin;
    const branchPoint=t=>[x+Math.sin(t*2.2)*lean,y+t*height,z+Math.sin(t*3.3+seed)*t*.88];
    const bark=0x635342;
    for(let j=0;j<12;j++) tube('wood',branchPoint(j/12),branchPoint((j+1)/12),
      .57*(1-j/13)**1.14,.57*(1-(j+1)/13)**1.14,bark,.83+j*.012,12);
    for(let root=0;root<7;root++){
      const a=root*TAU/7;
      tube('wood',[x,y+.27,z],[x+Math.cos(a)*1.64,y-.19,z+Math.sin(a)*1.38],.33,.038,bark,.83);
    }
    for(let branch=0;branch<15;branch++){
      const a=branch*2.399+seed, t=.40+branch*.038;
      const base=branchPoint(t), reach=1.72+(1-t)*3.4;
      const mid=[base[0]+Math.cos(a)*reach*.50,base[1]+height*.105,base[2]+Math.sin(a)*reach*.5];
      const end=[base[0]+Math.cos(a)*reach,base[1]+height*(.19-(branch%4)*.026),base[2]+Math.sin(a)*reach];
      tube('wood',base,mid,.22*(1-t)+.075,.109,bark,.83,9);
      tube('wood',mid,end,.11,.014,bark,1,7);
      for(let j=0;j<43;j++){
        const angle=rng()*TAU, dist=Math.sqrt(rng())*2.03;
        const p=[end[0]+Math.cos(angle)*dist, end[1]+(rng()-.5)*1.05,end[2]+Math.sin(angle)*dist];
        leaf(p,.29+rng()*.67,rng()*TAU,(rng()-.5)*.65,[0x718945,0x9bb260,0xb6bd6d,0x526e43,0x84984d][j%5]);
      }
    }
  }
  function fern(x,y,z, size, palette) {
    for(let blade=0;blade<5;blade++){
      const a=blade*TAU/5+rng()*.6;
      for(let j=1;j<5;j++){
        const t=j/5, reach=t*size;
        for (const side of [-1,1]) leaf([x+Math.cos(a)*reach,y+Math.sin(t*2.4)*size*.57,z+Math.sin(a)*reach],
          (.42-.28*t)*size,a+side*.83,.40,palette[(blade+j)%palette.length]);
      }
    }
  }
  function platform(block, index) {
    const [x,y,z,w,h,d]=block, top=y+h/2;
    box('stone',[x,y-.03,z],[w/2-.015,h/2-.03,d/2-.015],0,.68);
    const rows=Math.ceil(d/.94), cols=Math.ceil(w/1.55), stepZ=d/rows, stepX=w/cols;
    for(let row=0;row<rows;row++){
      let edge=-w/2;
      const offset=row%2===0 ? stepX : stepX*.53;
      for(let col=0;edge<w/2-.05;col++) {
        const span=Math.min(col===0?offset:stepX,w/2-edge), centerX=x+edge+span*.5;
        if(span>.12){
          const topY=top-.026+(rng()-.5)*.022;
          box(zone===2 && (row+col*2)%5!==0?'snow':'floor',[centerX,topY,z-d/2+stepZ*(row+.5)],
            [span/2-.021,.061,stepZ/2-.021],0,.88+rng()*.21);
        }
        edge+=span;
      }
    }
    for(const side of [-1,1]){
      const layers=zone===0?3:2;
      for(let row=0;row<layers;row++){
        for(let k=0;k<Math.ceil(w/.83);k++){
          const w2=w/Math.ceil(w/.83), offset=(row%2===0?0:.18);
          if (offset && k===Math.ceil(w/.83)-1) continue;
          box('stone',[x-w/2+w2*(k+.5)+offset,top-.21-row*.37,z+side*(d/2-.04)],
            [w2*.485,.168,.14],0,.67+rng()*.34);
        }
        for(let k=0;k<Math.ceil(d/.84);k++){
          const d2=d/Math.ceil(d/.84);
          box('stone',[x+side*(w/2-.04),top-.22-row*.37,z-d/2+d2*(k+.5)],
            [.14,.159,d2*.482],0,.67+rng()*.36);
        }
      }
    }
    if(zone===0) {
      for (let k=0;k<9;k++){
        const a=k*TAU/9;
        rock([x+Math.cos(a)*w*.43,y-h*.59,z+Math.sin(a)*d*.43],[.69+rng()*.70,.88,.66],k%4,.75);
      }
      if(index===0 || index===3) {
        for (const side of [-1,1]) {
          box('stone',[x+side*(w/2-.16),top+.15,z],[.17,.17,d*.41],0,.86);
          for(let k=0;k<6;k++){
            const t=(k-2.5)/6;
            box('stone',[x+side*(w/2-.18),top+.36,z+t*d*.75],[.21,.122,.16],0,.86);
          }
        }
      }
    } else {
      for (let k=0;k<13;k++){
        const a=k*TAU/13;
        const reach=.48+.035*rng();
        const p=[x+Math.cos(a)*w*reach,y-h*.62,z+Math.sin(a)*d*reach];
        rock(p,[.67+rng()*.72,zone===2?1.5+rng()*1.4:.78+rng(),.61+rng()*.75],k%4,.78+rng()*.25);
      }
      if(zone===2) {
        for(const side of [-1,1]) for(let j=0;j<11;j++){
          const px=x+side*(w*.50+.10), pz=z+((j+.32)/11-.5)*d;
          const stem=.19+rng()*.15, fall=.21+rng()*.71;
          tube('ice',[px,top-stem,pz],[px+side*.07,top-stem-fall,pz+.026],.069+rng()*.068,.006,undefined,.74+rng()*.34,6);
        }
      }
      if(zone===1) for(let i=0;i<33;i++){
        const side=i%2===0?1:-1;
        const px=x+side*(w*.5-.23-rng()*.42), pz=z+(rng()-.5)*d*.94;
        if (i%4===0) fern(px,top,pz,.45+rng()*.48,[0x648154,0x93aa62,0xa3a762]);
        else {
          for(let j=0;j<4;j++) leaf([px+(rng()-.5)*.42,top+.04+rng()*.16,pz],.19+rng()*.37,rng()*TAU,.30,
            [0x607740,0x91ae56,0xa6a366,0x55754b][j]);
        }
      }
    }
  }
  for(const [index,block] of layout.blocks[zone].entries()) platform(block,index);
  if(zone===0){
    // Five tall windows open onto water on the east wall. The west wall is largely collapsed.
    for(const [i,z] of [6.65,1.8,-3.05,-7.9,-12.75].entries()){
      arch([7.1,-.66,z],1.38,4.18,-Math.PI/2,{fill:true,tower:true});
      const jambZ=z-2.22;
      for(let j=0;j<12;j++) box('stone',[6.58,-.54+.71*j,jambZ],[.56,.344,.42],0,.63+rng()*.30);
      for(const y of [-.28,.27,5.18,5.52,7.14]){
        box('stone',[6.58,y,jambZ],[.69,.115,.55],0,.81);
      }
      if(i<4){
        const x=-7.95-i*.22, zz=5-i*5.1;
        const h=[5.8,7.2,4.9,7.4][i];
        for(let j=0;j<Math.floor(h/.55);j++) box('stone',[x,-1.0+.55*j,zz],[.63,.262,.61],.12,.62+rng()*.23);
        for(const y of [-.9,-.45,h-1.9,h-1.62]) box('stone',[x,y,zz],[.78,.13,.76],.12,.66);
        rock([x,-.85,zz],[1.56,1.02,1.94],i,.72);
      }
    }
    arch([-.1,2.11,-11.0],2.05,3.55,0,{tower:true});
    for (const [x,z] of [[-5.8,-12.8],[.0,-15.7],[7.4,-17.2]]) {
      for(let j=0;j<9;j++) box('stone',[x,-.52+j*.69,z],[.48,.326,.48],.04,.52+rng()*.25);
      box('stone',[x,5.93,z],[.64,.148,.58],.04,.71);
    }
    for(let i=0;i<7;i++){
      const x=-9.5-Math.floor(i/3)*2.7;
      box('stone',[x,2.1,-15.5+i*3.85],[.33,4,.47],.10,.49);
    }
  } else if(zone===1){
    for(const [x,y,z,r,s,a] of [
      [-2.95,1.1,-16.4,1.52,4.18,1.29],[-3.85,1.7,-21.6,1.67,4.12,1.39],
      [-7.8,2.7,-26.8,1.62,4.44,1.61],[6.95,3.11,-31,1.62,3.95,-1.02],
      [8.4,3.76,-35.75,1.52,3.91,-1.44],
    ]) arch([x,y,z],r,s,a,{tower:true});
    tree([-3.35,1.4,-15.87],8.9,1.85,2);
    tree([-7.55,2.10,-24.9],10.5,2.70,1.1);
    tree([9.9,1.60,-20.85],11.9,-2.1,3.5);
    tree([7.98,3.6,-33.8],8.9,1.55,4.8);
    tree([-11.0,.1,-32.5],12,3.5,1.4);
    for (const [x,z,lean] of [[-7.8,-38.1,2.1],[12,-34.2,-1.5],[-13.4,-17.7,1.8],[13.5,-26.5,-2.9]]) {
      tree([x,-.8,z],10.0+rng()*3.4,lean,2.4);
    }
    for(let j=0;j<27;j++) {
      const x = j%2===0 ? -9-rng()*5.5 : 9+rng()*6;
      const z = -15-j*.90;
      const height=1.2+rng()*3.7;
      rock([x,height*.54-1.0,z],[1.1+rng()*1.65,height,1.45+rng()],j%4,.78);
      fern(x+.35,height*.86,z,.9,[0x71834a,0x96a953,0x8c9450]);
    }
  } else {
    for(let j=0;j<31;j++){
      const side=j%3===0 ? -1 : 1;
      const x=side*((j<6?11.8:8.7)+rng()*6.8)+.8;
      const z=-39-j*.81;
      const height=3.0+rng()*8.8+(side>0 ? 2.7 : 0);
      rock([x,3.20+height*.27,z],[1.00+rng()*2.2,height,1.50+rng()*2.5],j%4,.80+rng()*.34);
    }
    for(let j=0;j<19;j++){
      const a=-3.21+j*.197;
      const x=Math.cos(a)*(24.4+rng()*9.3),z=-58+Math.sin(a)*23;
      const height=8.1+rng()*16;
      rock([x,3.0+height*.09,z],[2.9+rng()*5.5,height,3.1+rng()*5],j%4,.65+rng()*.30);
    }
    for (const [x,z] of [[-.20,-62.70],[8.25,-62.35]]) {
      for(let j=0;j<11;j++) box('stone',[x,8.6+.56*j,z],[.65,.266,.76],0,.74+rng()*.26);
      for(const top of [8.9,9.14,14.49,14.76]) box('stone',[x,top,z],[.79,.121,.89],0,.87);
      box('snow',[x,14.99,z],[.74,.162,.83],0,1.03);
    }
    arch([4,8.80,-62.58],2.58,4.13,0,{tower:true});
  }
  if(zone<2) {
    const gate=layout.gates[zone];
    arch(gate,1.48,2.77,0,{tower:true});
  }
  return batches;
}

function writeRoom(zone) {
  const batches = builder(zone);
  // Each surface stores interleaved position, normal and RGB floats, then uint32 indices.
  const blocks = [];
  for(const [index,kind] of OUT.entries()) {
    const {vertices,indices}=batches[kind];
    if (!indices.length) continue;
    const bytes=Buffer.alloc(12+(vertices.length+indices.length)*4);
    bytes.writeUInt32LE(index);
    bytes.writeUInt32LE(vertices.length/9,4);
    bytes.writeUInt32LE(indices.length,8);
    for(const [i,f] of vertices.entries()) bytes.writeFloatLE(f,12+i*4);
    const first=12+vertices.length*4;
    for(const [i,n] of indices.entries()) bytes.writeUInt32LE(n,first+i*4);
    blocks.push(bytes);
  }
  const header=Buffer.alloc(4);
  header.writeUInt32LE(blocks.length);
  fs.writeFileSync(path.join(art,`zone-${zone}.meshdata`),Buffer.concat([header,...blocks]));
  console.log(layout.zoneNames[zone], blocks.reduce((sum, b)=>sum+b.length,0),'bytes');
}
for(const zone of process.argv.length>2?process.argv.slice(2).map(Number):[0,1,2]) writeRoom(zone);
