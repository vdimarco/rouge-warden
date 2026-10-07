// Shared finite adventure definition. Renderer themes never decide collisions.
export const LEVELS = Object.freeze([
 Object.freeze({index:0,id:'canopy',name:'Canopy Run',subtitle:'Sunlit jungle · Find your flow',difficulty:'FLOW',length:1400,startSpeed:42,maxSpeed:56,acceleration:.42,rowInterval:1.08,minInterval:.98,seedSalt:0,accent:'#79e8b1',sky:'#9fe4e5',fog:'#bce4df',waterDeep:'#063a42',waterEdge:'#148e72',ground:'#7d9e43',stone:'#c3c6a5'}),
 Object.freeze({index:1,id:'canyon',name:'Redstone Rapids',subtitle:'Rocky gorge · Ride the rush',difficulty:'RAPIDS',length:1800,startSpeed:50,maxSpeed:64,acceleration:.34,rowInterval:.99,minInterval:.89,seedSalt:0x7e217c13,accent:'#ffb867',sky:'#efd0a1',fog:'#dcaa85',waterDeep:'#063c59',waterEdge:'#299b9a',ground:'#aa6847',stone:'#d48c5d'}),
 Object.freeze({index:2,id:'ruins',name:'Moonlit Ruins',subtitle:'Dusk temples · Master the river',difficulty:'EXPERT',length:2200,startSpeed:58,maxSpeed:72,acceleration:.38,rowInterval:.91,minInterval:.81,seedSalt:0x3bdba971,accent:'#c0abff',sky:'#302c59',fog:'#665c88',waterDeep:'#132853',waterEdge:'#306f9c',ground:'#58576f',stone:'#a5a1bb'})
]);
export const FINISH_RUNWAY=90;
export const levelAt=index=>LEVELS[Math.max(0,Math.min(LEVELS.length-1,Number.isInteger(index)?index:0))];
export const levelSeed=(seed,index=0)=>((seed>>>0)^levelAt(index).seedSalt)>>>0;
export const levelSpeed=(time,index=0)=>{const level=levelAt(index);return Math.min(level.maxSpeed,level.startSpeed+Math.max(0,time)*level.acceleration);};
export function validProgress(value){return value?.version===1&&Number.isInteger(value.unlocked)&&value.unlocked>=0&&value.unlocked<3&&typeof value.completed==='boolean'&&(!value.completed||value.unlocked===2)?{version:1,unlocked:value.unlocked,completed:value.completed}:null;}
export const freshProgress=()=>({version:1,unlocked:0,completed:false});
export function unlockLevel(progress,index){const value=validProgress(progress)??freshProgress();return{version:1,unlocked:Math.max(value.unlocked,Math.min(2,levelAt(index).index+1)),completed:value.completed||index===2};}
