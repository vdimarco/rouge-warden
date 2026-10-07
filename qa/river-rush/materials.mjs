import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const sharp=createRequire(new URL('../../higgsfield/package.json',import.meta.url))('sharp');
const root=new URL('../../games/river-rush/public/art/',import.meta.url);
async function raw(name){return sharp(new URL(name,root).pathname).ensureAlpha().raw().toBuffer({resolveWithObject:true});}
const results=[];
for(const name of ['rock','wood','ground','water']){
 const {data,info}=await raw(`surface-${name}.webp`);assert.equal(info.width,1024);assert.equal(info.height,1024);
 let min=255,max=0;
 for(let i=0;i<data.length;i+=4){min=Math.min(min,data[i]);max=Math.max(max,data[i]);assert.equal(data[i+3],255);}
 assert.ok(max-min>40,`${name} must contain visible detail`);
 let seamError=0;for(let i=0;i<1024;i++)for(let c=0;c<3;c++){seamError+=Math.abs(data[(i*1024)*4+c]-data[(i*1024+1023)*4+c]);seamError+=Math.abs(data[i*4+c]-data[((1023*1024)+i)*4+c]);}
 assert.ok(seamError/(1024*6)<4,`${name} encoded border difference must remain below 4/255`);
 if(name!=='water'){const normal=await raw(`surface-${name}-normal.png`);assert.equal(normal.info.width,512);assert.equal(normal.info.height,512);}
 results.push({material:name,size:1024,seamlessBorders:true,detailRange:max-min});
}
function bounds(data,width,height){let y0=height,y1=0,x0=width,x1=0;for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>32){y0=Math.min(y0,y);y1=Math.max(y1,y);x0=Math.min(x0,x);x1=Math.max(x1,x);}return{height:y1-y0+1,width:x1-x0+1,foot:y1};}
const duck=await raw('rider-low-duck.png');assert.equal(duck.info.width,512);assert.equal(duck.info.height,704);
const jump=await sharp(new URL('rider-downstream.png',root).pathname).extract({left:0,top:704,width:512,height:704}).ensureAlpha().raw().toBuffer();
const a=bounds(duck.data,512,704),b=bounds(jump,512,704);assert.ok(a.height/b.height<=.45);assert.equal(a.foot,684);assert.ok(a.width>a.height*1.7);assert.equal(b.foot,684);
console.log(JSON.stringify({passed:true,materials:results,duck:a,jump:b,duckToJumpHeight:a.height/b.height}));
