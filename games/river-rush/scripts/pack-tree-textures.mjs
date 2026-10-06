// Pack fal albedo and white-background foliage. Normal is derived detail, not measured PBR.
import sharp from 'sharp';
const [bark,foliage]=process.argv.slice(2);if(!bark||!foliage)throw Error('Pass bark.png and foliage.png');
const output=name=>new URL(`../public/art/${name}`,import.meta.url).pathname;
const n=1024,raw=await sharp(bark).resize(n,n).removeAlpha().raw().toBuffer();
for(const axis of [0,1])for(let p=0;p<n;p++)for(let k=0;k<48;k++){
 const a=((axis?p:k)*n+(axis?k:p))*3,b=((axis?p:n-1-k)*n+(axis?n-1-k:p))*3,w=.5*(1-k/48)**2;
 for(let c=0;c<3;c++){const x=raw[a+c],y=raw[b+c];raw[a+c]=Math.round(x*(1-w)+y*w);raw[b+c]=Math.round(y*(1-w)+x*w);}
}
await sharp(raw,{raw:{width:n,height:n,channels:3}}).webp({quality:88,effort:6}).toFile(output('tree-bark.webp'));
const size=512,gray=await sharp(raw,{raw:{width:n,height:n,channels:3}}).resize(size,size).greyscale().raw().toBuffer(),normal=Buffer.alloc(size*size*3),sample=(x,y)=>gray[((y+size)%size)*size+(x+size)%size];
for(let y=0;y<size;y++)for(let x=0;x<size;x++){const dx=(sample(x-1,y)-sample(x+1,y))/255*1.5,dy=(sample(x,y-1)-sample(x,y+1))/255*1.5,inv=1/Math.hypot(dx,dy,1),k=(y*size+x)*3;normal[k]=Math.round((dx*inv*.5+.5)*255);normal[k+1]=Math.round((dy*inv*.5+.5)*255);normal[k+2]=Math.round((inv*.5+.5)*255);}
await sharp(normal,{raw:{width:size,height:size,channels:3}}).webp({lossless:true,effort:6}).toFile(output('tree-bark-normal.webp'));
const {data,info}=await sharp(foliage).removeAlpha().raw().toBuffer({resolveWithObject:true}),rgba=Buffer.alloc(info.width*info.height*4);
for(let i=0;i<info.width*info.height;i++){const rgb=data.subarray(i*3,i*3+3),a=Math.min(1,Math.max(0,(250-Math.min(...rgb))/110));for(let c=0;c<3;c++)rgba[i*4+c]=a?Math.max(0,Math.min(255,(rgb[c]-(1-a)*255)/a)):0;rgba[i*4+3]=Math.round(a*255);}
await sharp(rgba,{raw:{width:info.width,height:info.height,channels:4}}).resize(size,size).webp({quality:90,alphaQuality:100,effort:6}).toFile(output('tree-foliage.webp'));
