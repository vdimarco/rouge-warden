export type View='isometric'|'top-down';
export type Point={x:number;y:number};
const X=.84,Y=.48;
export function project(p:Point,view:View):Point{return view==='isometric'?{x:(p.x-p.y)*X,y:(p.x+p.y)*Y}:{...p}}
export function unproject(p:Point,view:View):Point{return view==='isometric'?{x:p.x/(2*X)+p.y/(2*Y),y:p.y/(2*Y)-p.x/(2*X)}:{...p}}
export function screenInput(p:Point,view:View):Point{const magnitude=Math.min(1,Math.hypot(p.x,p.y));const world=unproject(p,view),length=Math.hypot(world.x,world.y);return length?{x:world.x/length*magnitude,y:world.y/length*magnitude}:{x:0,y:0}}
export function readView():View{try{return localStorage.getItem('olympus-view-v1')==='top-down'?'top-down':'isometric'}catch{return 'isometric'}}
export function saveView(view:View){try{localStorage.setItem('olympus-view-v1',view)}catch{/* Camera choice is optional; progression has its own storage. */}}
