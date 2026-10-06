// Register the standalone low brace; rotate its top-down deck heading away
// from the camera, then scale uniformly. No anatomical image compression.
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {RIDER_SIZE} from '../src/game/rider.js';
const sharp=createRequire(new URL('../../../higgsfield/package.json',import.meta.url))('sharp');
const source=process.argv[2];if(!source)throw new Error('Pass the downloaded transparent duck cutout.');
const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
let x0=info.width,y0=info.height,x1=0,y1=0;
for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>32){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
const crop={left:x0,top:y0,width:x1-x0+1,height:y1-y0+1};
// Finish extraction first: Sharp can otherwise rotate before extracting and
// apply the original rectangle to the wrong part of the image.
const extracted=await sharp(source).extract(crop).png().toBuffer();
const resized=await sharp(extracted).rotate(180).resize({width:448}).png().toBuffer();const meta=await sharp(resized).metadata();
if(meta.height>246)throw new Error('Ducking silhouette exceeds 45% of the registered 548px jumping silhouette.');
const {width,height,foot}=RIDER_SIZE;
await sharp({create:{width,height,channels:4,background:'#00000000'}}).composite([{input:resized,left:(width-meta.width)/2,top:foot-meta.height+1}]).png({compressionLevel:9}).toFile(fileURLToPath(new URL('../public/art/rider-low-duck.png',import.meta.url)));
console.log(JSON.stringify({sourceBounds:crop,registered:{width:meta.width,height:meta.height,deck:foot},jumpHeight:548,ratio:meta.height/548}));
