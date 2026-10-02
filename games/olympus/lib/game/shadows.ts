import {project,type Point,type View} from './camera';
type Mask={cast:HTMLCanvasElement;contact:HTMLCanvasElement;foot:Point};
export function alphaFootprint(data:Uint8ClampedArray,width:number,height:number){
 const rows=new Uint32Array(height);let widest=0;
 for(let y=0;y<height;y++){for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>48)rows[y]++;widest=Math.max(widest,rows[y])}
 if(!widest)return null;
 let bottom=height-1;while(bottom>=0&&rows[bottom]<Math.max(1,widest*.06))bottom--;
 const band=Math.max(2,Math.round(height*.06)),top=Math.max(0,bottom-band+1);let sum=0,count=0;
 for(let y=top;y<=bottom;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>48){sum+=x+.5;count++}
 return {x:sum/count/width,y:(bottom+1)/height,contactTop:top/height};
}
export class SpriteShadows {
 private masks=new WeakMap<HTMLImageElement,Mask|null>();
 private mask(im:HTMLImageElement){
  if(!im?.complete||!im.naturalWidth)return null;
  const cached=this.masks.get(im);if(cached!==undefined)return cached;
  const cast=document.createElement('canvas'),ratio=im.naturalWidth/im.naturalHeight;
  cast.width=Math.round(ratio>1?128:128*ratio);cast.height=Math.round(ratio>1?128/ratio:128);
  const ctx=cast.getContext('2d')!;ctx.drawImage(im,0,0,cast.width,cast.height);
  const base=alphaFootprint(ctx.getImageData(0,0,cast.width,cast.height).data,cast.width,cast.height);if(!base){this.masks.set(im,null);return null}
  ctx.globalCompositeOperation='source-in';ctx.fillStyle='#061820';ctx.fillRect(0,0,cast.width,cast.height);
  const contact=document.createElement('canvas');contact.width=cast.width;contact.height=cast.height;
  const cc=contact.getContext('2d')!;cc.drawImage(cast,0,0);cc.clearRect(0,0,cast.width,Math.floor(base.contactTop*cast.height));
  const mask={cast,contact,foot:{x:base.x,y:base.y}};this.masks.set(im,mask);return mask;
 }
 draw(c:CanvasRenderingContext2D,im:HTMLImageElement,foot:Point,view:View,size:number,height:number,flip=false,opacity=.28,length=.65,rotation=0,sx=1,sy=1,hover=0){
  const mask=this.mask(im);if(!mask)return;
  const ratio=im.naturalWidth/im.naturalHeight,iw=ratio>1?size:size*ratio,ih=ratio>1?size/ratio:size;
  const fx=(mask.foot.x-.5)*iw,fy=(mask.foot.y-.5)*ih,cos=Math.cos(rotation),sin=Math.sin(rotation),mirror=flip?-1:1;
  const a=cos*mirror*sx,b=sin*mirror*sx,cc=-sin*sy,d=cos*sy;
  const baseX=a*fx+cc*fy,baseY=b*fx+d*fy;
  const light=project({x:1,y:.65},view),n=Math.hypot(light.x,light.y),lx=light.x/n,ly=light.y/n;
  const lift=Math.max(hover,height-baseY),anchor={x:foot.x+baseX+lx*lift*.45,y:foot.y+Math.max(0,baseY-height)+ly*lift*.45};
  c.save();c.globalAlpha=opacity/(1+lift*.035);c.translate(anchor.x,anchor.y);
  // The vertical sprite silhouette lays down along the light; the base stays anchored.
  c.transform(.86*a-lx*length*b,.08*a-ly*length*b,.86*cc-lx*length*d,.08*cc-ly*length*d,0,0);
  c.drawImage(mask.cast,-iw/2-fx,-ih/2-fy,iw,ih);c.restore();
  c.save();c.globalAlpha=opacity*(hover? .45:1.3)/(1+lift*.12);c.translate(foot.x+baseX,foot.y+Math.max(0,baseY-height));
  c.transform(.92*a,.08*a,.92*cc,.13*d,0,0);c.drawImage(mask.contact,-iw/2-fx,-ih/2-fy,iw,ih);c.restore();
 }
}
