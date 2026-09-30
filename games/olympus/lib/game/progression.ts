export type Relic='vitality'|'reach'|'spark';
export type Legacy={embers:number;runs:number;best:number;bestRealm:number;relics:Record<Relic,number>};
export const freshLegacy=():Legacy=>({embers:0,runs:0,best:0,bestRealm:0,relics:{vitality:0,reach:0,spark:0}});
export const relics:{id:Relic;name:string;description:string;symbol:string}[]=[
 {id:'vitality',name:'Heart of the Titan',description:'+5 starting health per rank.',symbol:'♡'},
 {id:'reach',name:'Charon’s lantern',description:'+6 soul collection range per rank.',symbol:'✧'},
 {id:'spark',name:'Stolen fire',description:'+3% weapon damage per rank.',symbol:'♨'},
];
export const relicCost=(rank:number)=>4+rank*5;
export const levelCost=(level:number)=>6+Math.round((level-1)*5+(level-1)**1.45*2);
export const runReward=(seconds:number,bosses:number)=>Math.floor(seconds/30)+bosses*4;
export function readLegacy():Legacy{const blank=freshLegacy();try{const raw=JSON.parse(localStorage.getItem('olympus-legacy-v2')||'null');if(!raw)return {...blank,best:Number(localStorage.getItem('olympus-best'))||0};const n=(x:unknown,max=1e7)=>Math.min(max,Math.max(0,Math.floor(Number(x)||0)));return {embers:n(raw.embers),runs:n(raw.runs),best:n(raw.best),bestRealm:n(raw.bestRealm,100),relics:{vitality:n(raw.relics?.vitality,5),reach:n(raw.relics?.reach,5),spark:n(raw.relics?.spark,5)}}}catch{return blank}}
export function saveLegacy(value:Legacy){try{localStorage.setItem('olympus-legacy-v2',JSON.stringify(value));return true}catch{return false}}
export function phaseAt(time:number,boss:boolean){if(boss)return {name:'GUARDIAN',spawn:1.25};const t=time%30;return t<4?{name:'GATHER',spawn:.7}:t<20?{name:'HUNT',spawn:.48}:t<26?{name:'ONSLAUGHT',spawn:.3}:{name:'RECOVER',spawn:1.2}}
