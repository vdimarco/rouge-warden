import {LANE_SPACING,laneToX} from './lanes.js';
import {terrainKindAt} from './course-sections.js';

// Forks share the section grid, but never replace a promised wave train. One
// non-wave landscape after each wave train becomes an island adventure. There
// is no retained map history and no geometry-dependent gameplay randomness.
const mod=(n,m)=>((n%m)+m)%m;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=n=>{const u=clamp(n,0,1);return u*u*(3-2*u);};
const seedOf=profile=>mod(profile?.seed??137,251);
function hash(n,seed){const k=mod(n,251);return mod(k*k*17+k*137+seed*29,251)/250;}
const THEMES=Object.freeze(['crocodile-run','canopy-cut','rapids-gates']);
export const FORK_ENTRY=86;
export const FORK_EXIT=90;
// Conservative bound for scenery whose entire rotated footprint must stay
// outside every channel, including both overlapping headland envelopes.
export const MAX_FORK_FAN_OFFSET=7.4+1.2+2.2+.8;

function grid(profile){
 const seed=seedOf(profile),map=clamp(profile?.mapIndex??0,0,2);
 return{seed,offset:260+hash(181,seed)*40,span:600-map*20+hash(199,seed)*40};
}
function bounds(cell,profile,layout=grid(profile)){
 if(!(profile?.length>0)||cell<1)return null;
 const {seed,offset,span}=layout,kind=terrainKindAt(cell,seed);
 if(kind===1||(cell!==1&&terrainKindAt(cell-1,seed)!==1))return null;
 const start=offset+cell*span+12,end=offset+(cell+1)*span-12;
 if(end>profile.length-150)return null;
 // The live finite maps have at most twelve section cells. Count the preceding
 // eligible episodes rather than alternating absolute cells: irregular gaps
 // must not accidentally make the same bank optimal for an entire run.
 let ordinal=0;
 for(let previous=1;previous<cell;previous++)if(terrainKindAt(previous,seed)!==1&&(previous===1||terrainKindAt(previous-1,seed)===1))ordinal++;
 const map=clamp(profile.mapIndex??0,0,2),riskSide=mod(ordinal+Math.floor(hash(241,seed)*2)+map,2)===0?-1:1;
 const themeOffset=mod(Math.floor(hash(233,seed)*3)+map,3),themeStep=hash(239,seed)<.5?-1:1;
 return{id:cell,start,splitStart:start+FORK_ENTRY,splitEnd:end-FORK_EXIT,end,
  ordinal,safeSide:-riskSide,riskSide,theme:THEMES[mod(themeOffset+ordinal*themeStep,3)],
  spread:7.4+hash(cell+247,seed)*1.2,seed};
}
function sample(distance,b){
 const strength=smooth((distance-b.start)/FORK_ENTRY)*(1-smooth((distance-b.splitEnd)/FORK_EXIT));
 // Broad, unequal shoulders give each island a headland, a waist and a second
 // bend. These are seeded shapes along one finite island, rather than repeating
 // sine waves or a straight median. Both streams follow the same physical bend.
 const along=(distance-b.start)/(b.end-b.start),a=hash(b.id+225,b.seed),c=hash(b.id+231,b.seed);
 const head=smooth((along-.12)/.20)*(1-smooth((along-.34-a*.08)/.23));
 const tail=smooth((along-.48-c*.05)/.16)*(1-smooth((along-.76)/.15));
 const fanOffset=strength*(b.spread+2.2*head+.8*tail);
 const sign=hash(b.id+257,b.seed)<.5?-1:1;
 const islandCenter=sign*strength*(head*(1.4+a*.7)-tail*(.7+a*.5));
 const islandHalfWidth=strength*(5.5+head*(3.4+a)+tail*(2+c));
 return{...b,strength,fanOffset,islandCenter,islandHalfWidth,channels:[
  {side:-1,lanes:[0,1],center:islandCenter-LANE_SPACING*1.5-fanOffset,width:LANE_SPACING*2},
  {side:1,lanes:[3,4],center:islandCenter+LANE_SPACING*1.5+fanOffset,width:LANE_SPACING*2}
 ]};
}
export function riverFork(distance,profile){
 if(!(profile?.length>0))return null;
 const layout=grid(profile),cell=Math.floor((distance-layout.offset)/layout.span),b=bounds(cell,profile,layout);
 return b&&distance>=b.start&&distance<=b.end?sample(distance,b):null;
}
// A preview is a core-strength sample. Its immutable distance bounds, identity
// and route roles can schedule encounters before the nose enters the view.
export function nextRiverFork(distance,profile){
 if(!(profile?.length>0)||distance>=profile.length-150)return null;
 const layout=grid(profile),first=Math.max(1,Math.floor((distance-layout.offset)/layout.span));
 const last=Math.ceil((profile.length-layout.offset)/layout.span);
 for(let cell=first;cell<last;cell++){
  const b=bounds(cell,profile,layout);if(b&&b.end>=distance)return sample((b.splitStart+b.splitEnd)/2,b);
 }
 return null;
}
export function forkLaneCross(lane,distance,profile){
 const fork=riverFork(distance,profile);if(!fork)return laneToX(lane);
 // Each two-lane stream retains 3.8m spacing. Only the unrideable interval
 // through lane2 expands, continuously, into the actual island footprint.
 const side=lane<=1?-1:lane>=3?1:2*smooth((lane-1)/2)-1;
 return laneToX(lane)+fork.islandCenter+side*fork.fanOffset;
}
export function islandContains(cross,distance,profile,raftRadius=0){
 const fork=riverFork(distance,profile);
 return !!fork&&fork.islandHalfWidth>.035&&Math.abs(cross-fork.islandCenter)<=fork.islandHalfWidth+Math.max(0,raftRadius);
}
export function islandHeight(cross,distance,profile){
 const fork=riverFork(distance,profile);if(!fork||fork.islandHalfWidth<=.035)return 0;
 const along=Math.abs(cross-fork.islandCenter)/fork.islandHalfWidth;if(along>1)return 0;
 const crown=smooth(1-along),ridge=2.4+hash(fork.id+227,fork.seed)*1.3;
 return .08+ridge*fork.strength*crown;
}

// rHash, rSmooth, rSectionKind and course uniforms precede this source in
// COURSE_GLSL. Float arithmetic uses the same small integer seed/hash grid.
export const FORK_GLSL=`
vec4 rFork(float d){
 if(uCourseLength<=0.)return vec4(0.);
 float offset=260.+rHash(181.)*40.,span=600.-clamp(uCourseMap,0.,2.)*20.+rHash(199.)*40.;
 float cell=floor((d-offset)/span),start=offset+cell*span+12.,end=offset+(cell+1.)*span-12.;
 if(cell<1.||rSectionKind(cell)==1.||(cell!=1.&&rSectionKind(cell-1.)!=1.)||end>uCourseLength-150.||d<start||d>end)return vec4(0.);
 float strength=rSmooth((d-start)/${FORK_ENTRY.toFixed(1)})*(1.-rSmooth((d-end+${FORK_EXIT.toFixed(1)})/${FORK_EXIT.toFixed(1)}));
 float along=(d-start)/(end-start),a=rHash(cell+225.),c=rHash(cell+231.);
 float head=rSmooth((along-.12)/.20)*(1.-rSmooth((along-.34-a*.08)/.23));
 float tail=rSmooth((along-.48-c*.05)/.16)*(1.-rSmooth((along-.76)/.15));
 float spread=strength*(7.4+rHash(cell+247.)*1.2+2.2*head+.8*tail);
 float sign=rHash(cell+257.)<.5?-1.:1.;
 float center=sign*strength*(head*(1.4+a*.7)-tail*(.7+a*.5));
 float width=strength*(5.5+head*(3.4+a)+tail*(2.+c));
 return vec4(strength,width,center,spread);
}
float rForkLaneCross(float lane,float d){vec4 fork=rFork(d);float side=lane<=1.?-1.:lane>=3.?1.:2.*rSmooth((lane-1.)/2.)-1.;return (lane-2.)*${LANE_SPACING.toFixed(4)}+fork.z+side*fork.w;}
float rForkLand(float cross,float d){vec4 fork=rFork(d);return fork.y>.035&&abs(cross-fork.z)<=fork.y?1.:0.;}
float rForkIslandHeight(float cross,float d){vec4 fork=rFork(d);if(fork.y<=.035)return 0.;float along=abs(cross-fork.z)/fork.y;if(along>1.)return 0.;float offset=260.+rHash(181.)*40.,span=600.-clamp(uCourseMap,0.,2.)*20.+rHash(199.)*40.,cell=floor((d-offset)/span);return .08+(2.4+rHash(cell+227.)*1.3)*fork.x*rSmooth(1.-along);}
`;
