import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const current=readFileSync(new URL('../../public/vr/js/main.js',import.meta.url),'utf8'),baseline=readFileSync(new URL('./fixtures/goon-pose-before.js',import.meta.url),'utf8');
const fields=['phase','poseT','stride','yaw','bp','br','lift','delay','x','y','z','shirt','pants','skin','height'];
function run(source,mode,flat){
 const funcs=['streetFrame','goonOnThrees'].map(n=>source.match(new RegExp('function '+n+'\\([^\\n]*\\) \\{[\\s\\S]*?\\n\\}'))[0]).join('\n');
 let calls=0,frames=[],modeState=mode;const G={time:0,state:'play'},goons=Array.from({length:10},(_,i)=>({on:true,pose:1,state:'walk',...Object.fromEntries(fields.map(k=>[k,i]))}));
 const figures={begin(){frames.push([])},add(g){frames.at(-1).push({...g})},end(){}};
 const noop=()=>{};const names=['isXR','STREET','street','P','HERO_SEEN','actionOn','cars','STREET_HAZARDS','figures','camera','CAMW','G','streetView','combat','jobs','actionView','worldVisible','audio','GOON_VIEW','verseMode','flatOn','VERSE','Math'];
 const vals=[()=>false,{max:30,maxXR:10},{update:noop,crowd:0},{pos:{},vel:{x:0,y:0,z:0}}, {},()=>true,{hazards:noop},[],figures,{getWorldPosition:noop},{},G,{update:noop},{goons},{people:[]},{setVisible:noop,update:noop},true,{setCrowd:noop},new Map(),()=>modeState,flat,{goons:8},{floor(v){calls++;return Math.floor(v)}}];
 const api=Function(...names,funcs+';return {streetFrame,goonOnThrees};')(...vals);
 for(let f=0;f<60;f++){G.time=f/60;if(f===20)modeState=mode==="off"?"full":"off";if(f===40)modeState=mode;for(let i=0;i<goons.length;i++){const g=goons[i];g.x+=.1;g.phase+=.03;g.poseT+=.02;if(f%11===0)g.pose++;if(f%17===0)g.state=g.state==='walk'?'hit':'walk';}api.streetFrame(1/60,true);}
 return{calls,frames,debug:goons.map(g=>({...api.goonOnThrees(g)}))};
}
for(const mode of ['full','calm','off'])for(const flat of [true,false]){const a=run(baseline,mode,flat),b=run(current,mode,flat);assert.deepEqual(b.frames,a.frames);assert.deepEqual(b.debug,a.debug);assert.ok(b.calls<=70,'at most one pose tick per street frame plus diagnostic calls');console.log(`PASS ${mode}/flat=${flat}: equivalent frames/diagnostics; ticks ${a.calls}->${b.calls}`);}
