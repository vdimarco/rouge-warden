import {riverHash} from './river-course.js';
import {riverFork} from './river-forks.js';

// Decoration is a small authored composition around real island geography.
// These world stations never decide steering, contacts, rewards or topology.
export const FORK_PALETTES=Object.freeze([
 Object.freeze({wet:'#425d42',shore:'#c7b17b',earth:'#697e3b',ridge:'#91a854',moss:'#355e32',stone:'#b9bd99',accent:'#ffd991',foam:'#d6f4de',root:'#69513b'}),
 Object.freeze({wet:'#735445',shore:'#ddb78a',earth:'#ae714e',ridge:'#cc9567',moss:'#77744b',stone:'#d4a278',accent:'#ffd88b',foam:'#ddf1ed',root:'#7c604d'}),
 Object.freeze({wet:'#414957',shore:'#b1b1bf',earth:'#686d83',ridge:'#858a9e',moss:'#476f69',stone:'#b0b8c5',accent:'#c9edff',foam:'#ceddf3',root:'#747281'})
]);
export const ISLAND_LANDMARK_CAPACITY=3;
export const ISLAND_SHORE_CLUSTER_CAPACITY=6;
export const ISLAND_SURFACE_TILE_SIZE=256;
export const ISLAND_GROUND_CLUMP_CAPACITY=52;
let surfaceTile;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=n=>{const t=clamp(n,0,1);return t*t*(3-2*t);};
function hash2(x,y,seed){let n=Math.imul(x+seed,374761393)^Math.imul(y+seed*7,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296;}
function tileNoise(u,v,grid,seed){
 const x=((u%1)+1)%1*grid,y=((v%1)+1)%1*grid,ix=Math.floor(x),iy=Math.floor(y),tx=smooth(x-ix),ty=smooth(y-iy);
 const a=hash2(ix,iy,seed),b=hash2((ix+1)%grid,iy,seed),c=hash2(ix,(iy+1)%grid,seed),d=hash2((ix+1)%grid,(iy+1)%grid,seed);
 return(a+(b-a)*tx)*(1-ty)+(c+(d-c)*tx)*ty;
}
// A DOM-independent prepared data tile shared by both renderers. RGBA channels
// contain broad mottle, medium mineral patches, fine grain and opaque alpha;
// they are linear data, not sRGB color. Both axes repeat without a seam.
export function islandSurfaceTile(){
 if(surfaceTile)return surfaceTile;
 const size=ISLAND_SURFACE_TILE_SIZE,data=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=(x+.5)/size,v=(y+.5)/size,warpX=(tileNoise(u,v,4,83)-.5)*.07,warpY=(tileNoise(u,v,4,127)-.5)*.07;
  const broad=tileNoise(u+warpX,v+warpY,4,211)*.58+tileNoise(u,v,8,239)*.3+tileNoise(u,v,16,251)*.12;
  const medium=tileNoise(u,v,16,313)*.7+tileNoise(u,v,32,331)*.3,fine=tileNoise(u,v,64,353)*.7+hash2(x,y,379)*.3,index=(y*size+x)*4;
  data[index]=Math.round(broad*255);data[index+1]=Math.round(medium*255);data[index+2]=Math.round(fine*255);data[index+3]=255;
 }
 return surfaceTile=Object.freeze({width:size,height:size,data});
}
// Additional low coastal clumps are absolute seeded stations, independent of
// visible rows and camera history. Origins stay at least .7m inside the true
// bank; renderers fit the reused sprite/mesh footprint to the remaining land.
export function islandGroundClumps(fork,profile){
 if(!fork)return[];
 const first=Math.ceil((fork.start+50)/23),last=Math.floor((fork.end-50)/23),clumps=[];
 for(let n=first;n<=last;n++)for(const side of [-1,1]){
  const d=n*23+(riverHash(n+side+93,profile)-.5)*11,actual=riverFork(d,profile),margin=actual?Math.max(0,1-.7/actual.islandHalfWidth):0;
  clumps.push({id:`${fork.id}:ground:${n}:${side}`,d,side,crossFraction:side*Math.min(margin,.52+riverHash(n*3+side+107,profile)*.35),
   width:.45+riverHash(n+side+151,profile)*.8,length:3.4+riverHash(n*7+side+173,profile)*4,
   kind:Math.floor(riverHash(n+side+181,profile)*3),turn:riverHash(n+side+199,profile)*Math.PI*2});
 }
 return clumps;
}
const kinds=['root-grove','sandstone-shelf','broken-obelisk'];
export function islandLandmarks(fork,profile){
 if(!fork)return[];
 const span=fork.splitEnd-fork.splitStart,map=Math.max(0,Math.min(2,profile?.mapIndex??0));
 return [.16,.48,.79].map((along,i)=>({
  id:`${fork.id}:landmark:${i}`,type:kinds[map],role:['headland','waist','tail'][i],
  d:fork.splitStart+span*(along+(riverHash(fork.id*13+i+211,profile)-.5)*.045),
  crossFraction:(riverHash(fork.id*17+i+223,profile)-.5)*.52,
  scale:(i===0?1:.72)+riverHash(fork.id*19+i+239,profile)*.16,
  turn:riverHash(fork.id*23+i+251,profile)*Math.PI*2
 }));
}
export function islandShoreClusters(fork,profile){
 if(!fork)return[];
 const span=fork.end-fork.start;
 return [.12,.27,.43,.61,.76,.88].map((along,i)=>{
  const side=(i+(riverHash(fork.id+269,profile)>.5?1:0))%2?1:-1;
  return{id:`${fork.id}:shore:${i}`,d:fork.start+span*(along+(riverHash(fork.id*29+i+277,profile)-.5)*.045),side,
   crossFraction:side*(.77+riverHash(fork.id*31+i+283,profile)*.09),
   scale:.8+riverHash(fork.id*37+i+293,profile)*.38,turn:riverHash(fork.id*41+i+307,profile)*Math.PI*2};
 });
}
