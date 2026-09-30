const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class MouseSword {
  constructor(){this.reset()}
  reset(){this.active=false;this.down=false;this.dragged=false;this.look=false;this.x=.52;this.y=.42;this.tx=this.x;this.ty=this.y;this.last=null;this.stroke=null;this.swing=0;this.swingDirection=1;this.cut={x:1,y:0}}
  move(x,y,w,h){this.active=true;this.tx=clamp(x/w,.025,.975);this.ty=clamp(y/h,.06,.9);const dx=this.last?x-this.last.x:0,dy=this.last?y-this.last.y:0;this.last={x,y};if(Math.hypot(dx,dy)>1)this.cut={x:dx,y:dy};return {x:dx,y:dy}}
  press(x,y){this.down=true;this.dragged=false;this.stroke={x,y}}
  drag(x,y){if(!this.down||!this.stroke)return null;const dx=x-this.stroke.x,dy=y-this.stroke.y;if(Math.hypot(dx,dy)<12)return null;this.stroke={x,y};this.dragged=true;this.cut={x:dx,y:dy};return this.cut}
  release(){const cut=this.down&&!this.dragged?this.cut:null;this.down=false;this.stroke=null;return cut}
  attack(dx){this.swing=.16;this.swingDirection=dx<0?-1:1}
  update(dt){const a=1-Math.exp(-dt/.018);this.x+=(this.tx-this.x)*a;this.y+=(this.ty-this.y)*a;this.swing=Math.max(0,this.swing-dt)}
  blade(w,h,guard=false,overhead=false){const ax=w*.57,ay=h*.81;let bx=w*this.x,by=h*this.y;
    if(guard){const length=Math.min(w,h)*.37;bx=overhead?ax-length:ax-.04*w;by=overhead?ay-.17*h:ay-length;}
    const dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy),minimum=Math.min(w,h)*.17;if(len<minimum){const nx=len>1?dx/len:0,ny=len>1?dy/len:-1;bx=ax+nx*minimum;by=ay+ny*minimum}
    const arc=Math.sin((1-this.swing/.16)*Math.PI)*this.swingDirection*Math.min(w,h)*.09;
    if(this.swing>0&&!guard)bx+=arc;
    return {ax,ay,bx,by};
  }
}
