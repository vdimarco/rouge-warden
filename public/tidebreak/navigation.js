import { OBSTACLES, SIZE, distance, clamp } from './world.js';

const graphs = new Map();
function crosses(a, b, r) {
  let lo = 0, hi = 1;
  for (const [v, d, min, max] of [[a.x,b.x-a.x,r.x-r.w/2,r.x+r.w/2],[a.y,b.y-a.y,r.y-r.h/2,r.y+r.h/2]]) {
    if (Math.abs(d) < 1e-8) { if (v < min || v > max) return false; }
    else { const u=(min-v)/d, w=(max-v)/d; lo=Math.max(lo,Math.min(u,w));hi=Math.min(hi,Math.max(u,w));if(hi<lo)return false; }
  }
  return true;
}
function graph(phase, radius) {
  const key=`${phase}:${radius}`;if(graphs.has(key))return graphs.get(key);
  const walls=OBSTACLES[phase].map(r=>({...r,w:r.w+radius*2+8,h:r.h+radius*2+8}));
  const clear=(a,b)=>!walls.some(r=>crosses(a,b,r));
  const nodes=walls.flatMap(r=>[-1,1].flatMap(x=>[-1,1].map(y=>({x:r.x+x*(r.w/2+3),y:r.y+y*(r.h/2+3)}))))
    .filter(p=>p.x>=200&&p.x<=SIZE-200&&p.y>=180&&p.y<=SIZE-180&&clear(p,p));
  const edges=nodes.map(()=>[]);
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)if(clear(nodes[i],nodes[j])){const cost=distance(nodes[i],nodes[j]);edges[i].push([j,cost]);edges[j].push([i,cost]);}
  const result={nodes,edges,clear};graphs.set(key,result);return result;
}
// Builds the route graphs for both realm phases once, so the first route in play does not stall a frame.
export function warmRoutes(radius = 22) { for (const phase of Object.keys(OBSTACLES)) graph(+phase, radius); }
export function route(s, e, destination) {
  const goal={x:clamp(destination.x,200,SIZE-200),y:clamp(destination.y,180,SIZE-180)};
  const g=graph(s.phase,e.radius||22);if(g.clear(e,goal))return [goal];
  const nodes=[...g.nodes,{x:e.x,y:e.y},goal], start=nodes.length-2, end=start+1;
  const edges=g.edges.map(list=>[...list]);edges.push([],[]);
  for(const index of [start,end])for(let i=0;i<start;i++)if(g.clear(nodes[index],nodes[i])){const cost=distance(nodes[index],nodes[i]);edges[index].push([i,cost]);edges[i].push([index,cost]);}
  const costs=nodes.map(()=>Infinity),previous=[],open=new Set([start]);costs[start]=0;
  while(open.size){let at=-1;for(const i of open)if(at<0||costs[i]+distance(nodes[i],goal)<costs[at]+distance(nodes[at],goal))at=i;
    open.delete(at);if(at===end){const path=[];for(let i=end;i!==start;i=previous[i])path.unshift(nodes[i]);return path;}
    for(const [next,cost] of edges[at])if(costs[at]+cost<costs[next]){costs[next]=costs[at]+cost;previous[next]=at;open.add(next);}
  }
  return [];
}
export function followOrder(s,e,destination){
  if(!e.orderRoute||e.routePhase!==s.phase||s.time>=(e.routeAt||0)||distance(e.routeGoal,destination)>80){e.orderRoute=route(s,e,destination);e.routeGoal={...destination};e.routePhase=s.phase;e.routeAt=s.time+.6;}
  while(e.orderRoute.length&&distance(e,e.orderRoute[0])<2.1)e.orderRoute.shift();
  return e.orderRoute[0]||null;
}
