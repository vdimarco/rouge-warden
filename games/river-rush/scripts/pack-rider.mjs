// Register the fal cutout to one deck anchor without stretching action poses.
// Usage: node scripts/pack-rider.mjs /path/to/fal-cutout.png
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {RIDER_SIZE} from '../src/game/rider.js';
const sharp=createRequire(new URL('../../../higgsfield/package.json',import.meta.url))('sharp');
const source=process.argv[2];if(!source)throw new Error('Pass the downloaded RGBA fal atlas.');
const metadata=await sharp(source).metadata();if(metadata.width!==2528||metadata.height!==1696||!metadata.hasAlpha)throw new Error('Expected 2528×1696 transparent atlas.');
const {width,height,foot}=RIDER_SIZE,scale=.72,baseline=[770,770,770,770,790,775,788,796],cells=[];
for(let i=0;i<8;i++){
  const buffer=await sharp(source).extract({left:i%4*632,top:Math.floor(i/4)*848,width:632,height:848}).resize({width:455,height:611,fit:'fill'}).png().toBuffer();
  const cell=await sharp({create:{width,height,channels:4,background:'#00000000'}}).composite([{input:buffer,left:Math.round(width/2-350*scale),top:Math.round(foot-baseline[i]*scale)}]).png().toBuffer();
  cells.push({input:cell,left:i%4*width,top:Math.floor(i/4)*height});
}
await sharp({create:{width:width*4,height:height*2,channels:4,background:'#00000000'}}).composite(cells).png({compressionLevel:9}).toFile(fileURLToPath(new URL('../public/art/rider-downstream.png',import.meta.url)));
