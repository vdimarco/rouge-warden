// Extract fal's four material tiles, stitch borders and derive detail normals.
// Usage: node scripts/pack-surfaces.mjs /path/to/atlas.png
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const sharp=createRequire(new URL('../../../higgsfield/package.json',import.meta.url))('sharp');
const source=process.argv[2];if(!source)throw new Error('Pass a downloaded four-quadrant atlas.');
const size=1024,meta=await sharp(source).metadata();if(meta.width!==2048||meta.height!==2048)throw new Error('Expected 2048 square atlas.');
const output=name=>fileURLToPath(new URL(`../public/art/surface-${name}.${name.endsWith('-normal')?'png':'webp'}`,import.meta.url));
for(const [i,name] of ['rock','wood','ground','water'].entries()){
 const raw=await sharp(source).extract({left:i%2*size,top:Math.floor(i/2)*size,width:size,height:size}).removeAlpha().raw().toBuffer();
 // Pair opposite edge pixels with a narrow fade. Borders match exactly,
 // without an obvious grid or repeated hard seam during world recycling.
 for(const axis of [0,1])for(let p=0;p<size;p++)for(let k=0;k<48;k++){
  const a=((axis?p:k)*size+(axis?k:p))*3,b=((axis?p:size-1-k)*size+(axis?size-1-k:p))*3,w=.5*(1-k/48)**2;
  for(let c=0;c<3;c++){const x=raw[a+c],y=raw[b+c];raw[a+c]=Math.round(x*(1-w)+y*w);raw[b+c]=Math.round(y*(1-w)+x*w);}
 }
 await sharp(raw,{raw:{width:size,height:size,channels:3}}).webp({quality:90,effort:6}).toFile(output(name));
 if(name==='water')continue;
 const n=512,gray=await sharp(raw,{raw:{width:size,height:size,channels:3}}).resize(n,n).greyscale().raw().toBuffer(),smooth=await sharp(gray,{raw:{width:n,height:n,channels:1}}).blur(2).raw().toBuffer(),normal=Buffer.alloc(n*n*3);
 const sample=(x,y)=>{const k=((y+n)%n)*n+(x+n)%n;return (gray[k]-smooth[k])*.65+gray[k]*.35;};
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const dx=(sample(x-1,y)-sample(x+1,y))/255*3,dy=(sample(x,y-1)-sample(x,y+1))/255*3,inv=1/Math.hypot(dx,dy,1),k=(y*n+x)*3;normal[k]=Math.round((dx*inv*.5+.5)*255);normal[k+1]=Math.round((dy*inv*.5+.5)*255);normal[k+2]=Math.round((inv*.5+.5)*255);}
 await sharp(normal,{raw:{width:n,height:n,channels:3}}).png({compressionLevel:9}).toFile(output(name+'-normal'));
}
