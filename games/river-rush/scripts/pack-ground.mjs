// Seamless local color tile and subtle derived detail normal, not measured PBR.
// Usage: node scripts/pack-ground.mjs downloaded-ground.png
import sharp from 'sharp';
const size=1024,source=process.argv[2];if(!source)throw new Error('Pass the fal ground image.');
const raw=await sharp(source).resize(size,size).removeAlpha().raw().toBuffer();
for(const axis of [0,1])for(let p=0;p<size;p++)for(let k=0;k<48;k++){
 const a=((axis?p:k)*size+(axis?k:p))*3,b=((axis?p:size-1-k)*size+(axis?size-1-k:p))*3,w=.5*(1-k/48)**2;
 for(let c=0;c<3;c++){const x=raw[a+c],y=raw[b+c];raw[a+c]=Math.round(x*(1-w)+y*w);raw[b+c]=Math.round(y*(1-w)+x*w);}
}
const output=new URL('../public/art/surface-ground.webp',import.meta.url);await sharp(raw,{raw:{width:size,height:size,channels:3}}).webp({quality:90,effort:6}).toFile(output.pathname);
const n=512,gray=await sharp(raw,{raw:{width:size,height:size,channels:3}}).resize(n,n).greyscale().raw().toBuffer(),normal=Buffer.alloc(n*n*3);
const sample=(x,y)=>gray[((y+n)%n)*n+(x+n)%n];
for(let y=0;y<n;y++)for(let x=0;x<n;x++){const dx=(sample(x-1,y)-sample(x+1,y))/255*1.2,dy=(sample(x,y-1)-sample(x,y+1))/255*1.2,inv=1/Math.hypot(dx,dy,1),k=(y*n+x)*3;normal[k]=Math.round((dx*inv*.5+.5)*255);normal[k+1]=Math.round((dy*inv*.5+.5)*255);normal[k+2]=Math.round((inv*.5+.5)*255);}
await sharp(normal,{raw:{width:n,height:n,channels:3}}).png({compressionLevel:9}).toFile(new URL('../public/art/surface-ground-normal.png',import.meta.url).pathname);
