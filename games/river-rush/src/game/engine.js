// Distance-based river runner. Presentation never decides collisions.
import { laneSpring } from './world.js';
import { LEVELS, FINISH_RUNWAY, levelAt, levelSeed, levelSpeed } from './levels.js';
import { courseAct, courseIntensity } from './course-intensity.js';
import { terrainSection } from './course-sections.js';
import {jumpArcHeight,coinJumpHeight,JUMP_REWARD_LEAD,JUMP_REWARD_OFFSETS,COIN_ARC_HEIGHT_RADIUS} from './jump-rewards.js';
import {entityLane,encounterMotion,encounterGap,TARGET_VALUE,TARGET_CHARGE} from './moving-encounters.js';
import {isBranchSpan,branchLanes,branchSpan,branchOverlap,BRANCH_LANE_RADIUS} from './branch-spans.js';
import {LANES,LANE_COUNT,MIN_LANE,MAX_LANE,CENTER_LANE,LANE_SPACING,clampLane} from './lanes.js';
import {riverHalfWidth} from './river-course.js';
import {riverFork,nextRiverFork,forkLaneCross,islandContains} from './river-forks.js';
import {createAdventure,adventureRoute,streamLanes,innerStreamLane,outerStreamLane,recordAdventureClear,finishAdventureStep,treasurePayout,BANK_COIN_COUNT} from './river-adventures.js';
import {groundCoinLayout} from './coin-layouts.js';
import {chooseGuardedRoute,linkDecisionExit,ORDINARY_COIN_VALUE,GUARDED_COIN_VALUE,SAFE_COIN_OFFSETS,GUARDED_DUCK_OFFSETS} from './risk-reward.js';
export const JUMP_SECONDS = .66;
export const DUCK_SECONDS = .60;
export const VIEW_DISTANCE = 180;
export const BASE_SPEED = LEVELS[0].startSpeed, MAX_SPEED = Math.max(...LEVELS.map(level=>level.maxSpeed)), ACCELERATION = LEVELS[0].acceleration;
// Every pickup needs actual raft-center contact within the same 0.95 m
// tolerance on 3.8 m lanes. Target-lane input is not visible overlap.
export const COIN_LANE_RADIUS = .25;
// A forgiving common hazard core: 2.58 m on 3.8 m lanes. This matches the
// smallest combined raft/rock footprint and leaves action waves continuous.
export const HAZARD_LANE_RADIUS = BRANCH_LANE_RADIUS;
export const hazardTouchesLane=(entity,lane,radius=HAZARD_LANE_RADIUS,profile=null)=>{
 if(!profile)return isBranchSpan(entity)?branchOverlap(entity,lane,radius):Math.abs(entityLane(entity,entity.d)-lane)<=radius;
 const cross=forkLaneCross(lane,entity.d,profile),margin=radius*LANE_SPACING;
 if(isBranchSpan(entity)){const span=branchSpan(entity);return cross>=forkLaneCross(span.minLane,entity.d,profile)-margin&&cross<=forkLaneCross(span.maxLane,entity.d,profile)+margin;}
 return Math.abs(forkLaneCross(entityLane(entity,entity.d),entity.d,profile)-cross)<=margin;
};
// Above this normalized arc height the lifted raft has cleared a low coin.
// Both views use the same jump arc; waves remain presentation/buoyancy detail.
export const COIN_GROUND_MAX_JUMP_HEIGHT = .28;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const emptyInput = () => ({ actions: [] });
export function queueAction(input, action) { if (input.actions.length < 8) input.actions.push(action); }
export const speedAt = (time, levelIndex = 0) => levelSpeed(time, levelIndex);

// Forecast includes Rush ending; a constant current-speed estimate fires
// short actions too early just before the boost expires.
function travelTime(distance,time,levelIndex=0,factor=1){
  const {maxSpeed,acceleration}=levelAt(levelIndex);
  const v=speedAt(time,levelIndex),d=Math.max(0,distance)/factor,capDistance=(maxSpeed*maxSpeed-v*v)/(2*acceleration);
  return d<=capDistance?(Math.sqrt(v*v+2*acceleration*d)-v)/acceleration:(maxSpeed-v)/acceleration+(d-capDistance)/maxSpeed;
}
export function timeToImpact(g,distance){
  const d=Math.max(0,distance-g.distance),rush=g.rush;
  if(!rush)return travelTime(d,g.time,g.levelIndex);
  const {maxSpeed,acceleration}=levelAt(g.levelIndex);
  const v=speedAt(g.time,g.levelIndex),ramp=Math.min(rush,(maxSpeed-v)/acceleration);
  const boosted=((v*ramp+acceleration/2*ramp*ramp)+(rush-ramp)*maxSpeed)*1.32;
  return d<=boosted?travelTime(d,g.time,g.levelIndex,1.32):rush+travelTime(d-boosted,g.time+rush,g.levelIndex);
}

const campaignKeys=['score','coins','distance','jumps','ducks','levelsCleared'];
function cleanCarry(carry){return Object.freeze(Object.fromEntries(campaignKeys.map(key=>[key,Number.isFinite(carry?.[key])&&carry[key]>=0?Math.floor(carry[key]):0])));}
function campaignTotals(g){return {score:g.carry.score+g.score,coins:g.carry.coins+g.coins,distance:g.carry.distance+Math.floor(g.distance),jumps:g.carry.jumps+g.jumps,ducks:g.carry.ducks+g.ducks,levelsCleared:g.carry.levelsCleared+(g.phase==='won'?1:0)};}
export function createGame(seed = Date.now(), levelIndex = 0, carry = null) {
  const level=levelAt(levelIndex),campaignSeed=seed>>>0,mapSeed=levelSeed(campaignSeed,level.index);
  const g = { campaignSeed, levelIndex:level.index, carry:cleanCarry(carry), seed:mapSeed, rng:mapSeed, phase: 'playing', time: 0, distance: 0,
    lane: CENTER_LANE, visualLane: CENTER_LANE, laneVelocity: 0, speed: level.startSpeed, action: '', actionTime: 0, buffered: '', bufferTime: 0,
    coins: 0, score: 0, bonus: 0, streak: 0, multiplier: 1, lastCoin: -10,
    charge: 0, rush: 0, magnet: 0, shield: true, grace: 0,
    jumps: 0, ducks: 0, dodges: 0, shieldsUsed: 0, rowsPassed: 0,
    goalsCleared: 0, goal: { kind: 'tricks', start: 0, target: 3 },
    entities: [], nextRow: level.startSpeed*(68/42), row: 0, nextId: 1, patternsSeen:[], runwayGenerated:false,
    motifDeck:[], episode:null, episodeIndex:0, routeLane:CENTER_LANE,rewardLane:CENTER_LANE,coinPatternIndex:0,coinPatternsSeen:[],coinLanesSeen:0,branchWidthsSeen:0,routeDirection:mapSeed&1?1:-1,
    terrainProfile:Object.freeze({seed:mapSeed,length:level.length,mapIndex:level.index}),terrainCombo:{section:null,count:0,claimed:false},
    terrainBeat:null,rowsSinceRequired:0,requiredJump:false,requiredDuck:false,lastRequiredType:null,requiredTypeRun:0,lastFormation:null,formationRun:0,
    encounters:{lastRow:-99,nextEnemyRow:7+mapSeed%3,enemyIndex:0,lowEnemyIndex:0,lastEnemyType:null,targetIndex:0,nextTargetRow:11+mapSeed%4},lastJumpRewardD:null,
    decisions:[],lastDecisionRow:-99,pendingDecisionExit:null,adventures:[],islandReboundSide:null,
    event: '', eventId: 0, effects: [], notice: level.index===0?'Jump logs · Duck branches · Dodge rocks':`${level.name} · ${level.difficulty}`, noticeUntil: 4, reason: '' };
  for (let d = 7; d <= 32; d += 5) add(g, 'coin', CENTER_LANE, d,{coinPattern:'opening',primaryRoute:true});
  generateAhead(g); return g;
}
export function restartLevel(g){return createGame(g.campaignSeed,g.levelIndex,g.carry);}
export function nextLevel(g){return g.phase==='won'&&g.levelIndex<LEVELS.length-1?createGame(g.campaignSeed,g.levelIndex+1,campaignTotals(g)):null;}
function random(g) { g.rng = (Math.imul(g.rng, 1664525) + 1013904223) >>> 0; return g.rng / 4294967296; }
function add(g, type, lane, d, extra = {}) { g.entities.push({ id: g.nextId++, type, lane, d, done: false,...(type==='coin'?{coinValue:ORDINARY_COIN_VALUE}:{}), ...extra });if(type==='coin')g.coinLanesSeen|=1<<lane; }
function emit(g, type, text = '', lane = g.lane, detail = {}) {
  g.event = type; g.eventId++;
  g.effects.push({ type, time: g.time, lane, id: g.eventId, distance: g.distance, playerLane: g.lane, ...detail });
  if (g.effects.length > 24) g.effects.shift();
  if (text) { g.notice = text; g.noticeUntil = g.time + 1.35; }
}
const motifs=['slalom','coin-zigzag','mixed-hazards','jump-waves','low-canopy','split-current'];
function nextEpisode(g,act){
  if(!g.motifDeck.length){
    g.motifDeck=[...motifs];
    for(let i=g.motifDeck.length-1;i>0;i--){const j=Math.floor(random(g)*(i+1));[g.motifDeck[i],g.motifDeck[j]]=[g.motifDeck[j],g.motifDeck[i]];}
    if(g.motifDeck.at(-1)===g.episode?.motif)[g.motifDeck[0],g.motifDeck[g.motifDeck.length-1]]=[g.motifDeck.at(-1),g.motifDeck[0]];
  }
  return{index:g.episodeIndex++,motif:g.motifDeck.pop(),act,length:3+Math.floor(random(g)*4),step:0};
}
function rowPattern(g,row,d){
  const level=levelAt(g.levelIndex),act=courseAct(d,level.length),intensity=courseIntensity(d,level.length,g.levelIndex),terrain=terrainSection(d,g.terrainProfile);
  if(row<3){
    g.routeLane=g.rewardLane=row<2?CENTER_LANE:CENTER_LANE+1;
    return{motif:'tutorial',safe:row<2?CENTER_LANE-1:CENTER_LANE+1,hazards:[{lane:CENTER_LANE,type:['log','branch','rock'][row]}],coinLane:g.rewardLane,act,episode:-1,beat:row,recovery:false,intensity,terrain};
  }
  if(!g.episode||g.episode.step>=g.episode.length||g.episode.act!==act)g.episode=nextEpisode(g,act);
  const episode=g.episode,step=episode.step++,motif=episode.motif;
  if(g.terrainBeat?.id!==terrain.id)g.terrainBeat={id:terrain.id,step:0,logs:0,mixed:false,rested:false};
  const sectionBeat=g.terrainBeat;
  let recovery=terrain.phase==='recovery'||step===episode.length-1;
  const activeTerrain=terrain.phase==='active';
  if(activeTerrain&&terrain.type==='wave-train'&&sectionBeat.logs>=3&&sectionBeat.mixed&&!sectionBeat.rested){recovery=true;sectionBeat.rested=true;}
  // Route choices include holds and adjacent moves. A short direction bias
  // changes at episode boundaries; edges never force an endless ping-pong.
  if(step===0)g.routeDirection=random(g)<.5?-1:1;
  if(!recovery&&random(g)<.42+.18*intensity){
    const choices=[g.routeLane];
    if(g.routeLane>MIN_LANE)choices.push(g.routeLane-1);
    if(g.routeLane<MAX_LANE)choices.push(g.routeLane+1);
    const preferred=g.routeLane+g.routeDirection;
    g.routeLane=choices.includes(preferred)&&random(g)<.48?preferred:choices[Math.floor(random(g)*choices.length)];
  }
  const safe=g.routeLane,occupied=LANES.filter(lane=>lane!==safe);
  if(random(g)<.5)occupied.reverse();
  let types=['rock','rock'];
  if(motif==='coin-zigzag'||motif==='mixed-hazards')types=random(g)<.5?['log','branch']:['branch','log'];
  else if(motif==='jump-waves')types=['rock','log'];
  else if(motif==='low-canopy')types=['branch','rock'];
  else if(motif==='split-current')types=random(g)<.5?['branch','log']:['rock','branch'];
  if(activeTerrain&&random(g)<.66)types=terrain.type==='narrows'?['rock','rock']:terrain.type==='wave-train'?['log','rock']:['branch','rock'];
  let mandatory=null;
  if(!g.requiredJump)mandatory='log';
  else if(row>=5&&!g.requiredDuck)mandatory='branch';
  // Every advertised wave train contains three real jumps and one different
  // beat in its first four active rows, even at the fastest row spacing.
  if(activeTerrain&&terrain.type==='wave-train'&&terrain.comboAvailable&&(sectionBeat.logs<3||!sectionBeat.mixed)){
    if(mandatory==='branch')sectionBeat.mixed=true;
    else if(sectionBeat.logs>=3&&!sectionBeat.mixed){mandatory='branch';sectionBeat.mixed=true;}
    else mandatory='log';
  }else if(!mandatory&&!recovery&&random(g)<.13+.32*intensity+g.levelIndex*.025){
    mandatory=activeTerrain&&terrain.type==='low-canopy'?'branch':activeTerrain&&terrain.type==='wave-train'?'log':random(g)<.5?'log':'branch';
  }
  // Dodging alone cannot avoid actions for a long stretch. The random beats
  // remain different between seeds, with a hard drought bound as a backstop.
  if(!mandatory&&g.rowsSinceRequired>=3){
    mandatory=activeTerrain&&terrain.type==='wave-train'?'log':activeTerrain&&terrain.type==='low-canopy'?'branch':random(g)<.5?'log':'branch';
  }
  if(mandatory&&g.requiredTypeRun>=2&&mandatory===g.lastRequiredType&&!(activeTerrain&&terrain.type==='wave-train'&&sectionBeat.logs<3))mandatory=mandatory==='log'?'branch':'log';
  // A canopy beat on the approach gives the upcoming three-wave chain its
  // own silhouette run; a fourth identical log wall would force a late break.
  if(mandatory==='log'&&g.requiredJump&&terrain.type==='wave-train'&&terrain.phase==='approach'&&terrain.comboAvailable)mandatory='branch';
  if(mandatory==='log'&&g.formationRun>=3&&g.lastFormation===`${LANE_COUNT}:log`){
    mandatory='branch';if(activeTerrain&&terrain.type==='wave-train')sectionBeat.mixed=true;
  }
  if(mandatory)recovery=false;
  const pair=!recovery&&random(g)<.28+.54*intensity+g.levelIndex*.05;
  const count=pair?2+(intensity>.55&&(Math.imul(g.seed^row,0x45d9f3b)>>>0)&1?1:0):1;
  let hazards=mandatory?LANES.map(lane=>({lane,type:mandatory})):occupied.slice(0,count).map((lane,i)=>({lane,type:types[(i+step)%types.length]}));
  const encounter=g.encounters;
  const reserveTarget=recovery&&hazards.length===1&&(encounter.enemyIndex>0||encounter.adventureEnemySeen)&&encounter.targetIndex===0&&row>=encounter.nextTargetRow&&row-encounter.lastRow>=3;
  if(reserveTarget&&hazards[0].type==='log')hazards[0].type='rock';
  // A single occupied lane always leaves a readable dodge route. Full-width
  // action walls and the promised wave-chain beats keep their original art.
  const enemyType=encounter.lastEnemyType?encounter.lastEnemyType==='log'?'branch':'log':'log';
  const enemyReady=!reserveTarget&&hazards.length===1&&row>=encounter.nextEnemyRow&&row-encounter.lastRow>=3&&g.requiredJump&&g.requiredDuck&&!(activeTerrain&&terrain.type==='wave-train'&&terrain.comboAvailable)&&!(g.formationRun>=3&&g.lastFormation===`1:${enemyType}`);
  if(enemyReady)hazards[0].type=enemyType;
  let formation=hazards.every(h=>h.type===hazards[0].type)?`${hazards.length}:${hazards[0].type}`:'mixed';
  // Change the obstacle silhouette after at most three equal formations.
  if(!mandatory&&g.formationRun>=3&&formation===g.lastFormation){
    if(formation==='mixed'){hazards=hazards.map(h=>({...h,type:hazards[1].type}));formation=`${hazards.length}:${hazards[0].type}`;}
    else{hazards[0].type=reserveTarget?(hazards[0].type==='rock'?'branch':'rock'):enemyReady?(hazards[0].type==='log'?'branch':'log'):hazards[0].type==='rock'?'branch':hazards[0].type==='branch'?'log':'rock';formation=hazards.length===1?`1:${hazards[0].type}`:'mixed';}
  }
  if(enemyReady){
    hazards[0].enemy=hazards[0].type==='log'?(encounter.lowEnemyIndex++%2===0?'crocodile':'fish'):'bird';
    encounter.lastRow=row;encounter.enemyIndex++;encounter.lastEnemyType=hazards[0].type;
    encounter.nextEnemyRow=row+encounterGap(g.seed,encounter.enemyIndex,g.levelIndex);
  }
  g.formationRun=formation===g.lastFormation?g.formationRun+1:1;g.lastFormation=formation;
  if(mandatory){
    g.rowsSinceRequired=0;g.requiredJump ||= mandatory==='log';g.requiredDuck ||= mandatory==='branch';
    g.requiredTypeRun=mandatory===g.lastRequiredType?g.requiredTypeRun+1:1;g.lastRequiredType=mandatory;
  }else g.rowsSinceRequired++;
  if(activeTerrain){sectionBeat.step++;if(mandatory==='log')sectionBeat.logs++;}
  // A single coherent reward path: either clear water, a jump arc over its
  // actual log, or low gold under the branch. Never point at a different lane.
  const reward=mandatory?hazards.find(h=>h.lane===safe):hazards.find(h=>h.enemy&&h.type==='log')??hazards.find(h=>h.type==='log'&&(motif==='jump-waves'||terrain.type==='wave-train'))??(activeTerrain&&terrain.type==='low-canopy'?hazards.find(h=>h.type==='branch'):null);
  const preferred=reward?.lane??safe,previous=g.rewardLane??CENTER_LANE;
  const reachable=LANES.filter(lane=>Math.abs(lane-previous)<=1&&!hazards.some(h=>h.lane===lane&&h.type==='rock'));
  let coinLane=reachable.sort((a,b)=>Math.abs(a-preferred)-Math.abs(b-preferred)||Math.abs(a-previous)-Math.abs(b-previous))[0];
  if(coinLane===undefined){
    coinLane=clampLane(previous+Math.sign(safe-previous));
    hazards=hazards.map(h=>h.lane===coinLane&&h.type==='rock'?{...h,type:'log'}:h);
  }
  g.rewardLane=coinLane;
  hazards=spanBranches(hazards,safe,coinLane,g.seed,row,g.branchWidthsSeen);
  const decision=chooseGuardedRoute({seed:g.seed,row,levelIndex:g.levelIndex,intensity,previousLane:previous,safe,coinLane,hazards,recovery,terrain,lastDecisionRow:g.lastDecisionRow,touches:hazardTouchesLane});
  if(decision){coinLane=decision.safeLane;g.rewardLane=coinLane;g.lastDecisionRow=row;}
  return{motif,safe,hazards,coinLane,decision,act,episode:episode.index,beat:step,recovery,intensity,terrain,activeTerrain};
}
// Integrate the same capped acceleration and known Rush remainder used by
// timeToImpact. Gold stays attached to a temporal jump arc at every map speed.
function forecastTravel(g,seconds){
  const level=levelAt(g.levelIndex);
  const integrate=(start,duration)=>{const initial=speedAt(start,g.levelIndex),ramp=Math.min(duration,Math.max(0,(level.maxSpeed-initial)/level.acceleration));return initial*ramp+level.acceleration*ramp*ramp/2+(duration-ramp)*level.maxSpeed;};
  const boost=Math.min(Math.max(0,seconds),g.rush);
  return integrate(g.time,boost)*1.32+integrate(g.time+boost,Math.max(0,seconds-boost));
}
function spanBranches(hazards,safe,coinLane,seed,row,widthsSeen=0){
  const hash=Math.imul((seed^Math.imul(row+1,0x45d9f3b))>>>0,0x27d4eb2d)>>>0;
  const wood=hazards.filter(isBranchSpan);
  if(!wood.length)return hazards;
  // The planner already chose its reward, route and action. Branch anatomy
  // consumes no generation RNG and never turns an airborne log arc into duck gold.
  if(wood.length===LANE_COUNT){
    const groups=hash&1?[[0,1,2],[3,4]]:[[0,1],[2,3,4]];
    return groups.map((lanes,index)=>{const representative=lanes.includes(coinLane)?coinLane:lanes.reduce((best,lane)=>Math.abs(lane-coinLane)<Math.abs(best-coinLane)?lane:best,lanes[0]);return{...wood.find(h=>h.lane===representative),branchLanes:lanes,branchSide:index===0?-1:1,fullRiver:true,canopyLead:index===0};});
  }
  const spans=[],replacements=[];
  let needsSingle=row>=3&&!(widthsSeen&(1<<1));
  for(const source of wood){
    let branch=source;
    // The wider corridor places many planned limbs in interior lanes. Reserve
    // a real bank-rooted single limb before later rows resume seeded widths.
    // Keep the original safe route and any airborne reward clear.
    if(needsSingle){
      const banks=[MIN_LANE,MAX_LANE].filter(lane=>lane!==safe&&!hazards.some(h=>h.type==='log'&&h.lane===coinLane&&lane===coinLane));
      if(banks.length){const lane=banks[hash%banks.length];spans.push({...branch,lane,branchLanes:[lane]});needsSingle=false;continue;}
    }
    const candidates=[1,2,3].flatMap(width=>[LANES.slice(0,width),LANES.slice(LANE_COUNT-width)]).filter(lanes=>lanes.includes(branch.lane)&&!lanes.includes(safe));
    if(!candidates.length){replacements.push({...branch,type:branch.lane===coinLane?'log':'rock'});continue;}
    const desired=1+(hash+branch.lane)%3,lanes=candidates.sort((a,b)=>Math.abs(a.length-desired)-Math.abs(b.length-desired))[0];
    if(hazards.some(h=>h.type==='log'&&h.lane===coinLane&&lanes.includes(h.lane))){replacements.push({...branch,type:'rock'});continue;}
    spans.push({...branch,branchLanes:lanes});
  }
  // Adjacent planned branch parts are one connected bank tree. Opposite bank
  // single-lane boughs remain independent, with the middle route still open.
  for(let i=0;i<spans.length;i++)for(let j=i+1;j<spans.length;){
    const merged=[...new Set([...spans[i].branchLanes,...spans[j].branchLanes])].sort();
    if(merged.length<=3&&merged.every((lane,n)=>n===0||lane===merged[n-1]+1)){
      spans[i]={...spans[i],lane:merged.includes(coinLane)?coinLane:spans[i].lane,branchLanes:merged};spans.splice(j,1);
    }else j++;
  }
  const coverage=new Set(spans.flatMap(h=>h.branchLanes));
  return[...hazards.filter(h=>!isBranchSpan(h)&&!coverage.has(h.lane)),...replacements.filter(h=>!coverage.has(h.lane)),...spans];
}
function generateAdventureNode(g,packet,node,maxRushSpeed){
 if(node.kind==='stash'||node.kind==='counterpart'){
  const choice=packet.choices.find(item=>item.id===node.choiceId);
  add(g,node.kind==='stash'?'stash':node.type,node.lane,node.d,{value:node.value,coinCount:node.coinCount??0,groundedContact:true,motif:packet.theme,adventureId:packet.id,adventureStep:node.step,routeSide:node.side,routeRole:choice.routeRole,
   choiceId:choice.id,choiceFamily:choice.family,choiceRole:node.choiceRole,guardId:choice.guardId,returnLane:choice.exitLane,returnD:choice.exitD,sourceGuardD:choice.sourceGuardD??null});
  return;
 }
 const row=g.row++,terrain=terrainSection(node.d,g.terrainProfile),common={row,motif:packet.theme,act:courseAct(node.d,levelAt(g.levelIndex).length),episode:-2,beat:node.step??3,recovery:node.kind==='treasure',adventureId:packet.id,adventureStep:node.step??null,sectionId:terrain.id,sectionType:terrain.type,sectionPhase:terrain.phase,terrainActive:terrain.phase==='active'};
 if(!g.patternsSeen.includes(packet.theme))g.patternsSeen.push(packet.theme);
 if(node.kind==='treasure'){
  const route=adventureRoute(packet,node.side);
  add(g,'treasure',node.lane,node.d,{...common,routeSide:node.side,routeRole:route.role,theme:packet.theme,treasureBase:route.basePoints,treasureCleanBonus:route.maxPoints-route.basePoints,requiredClears:route.totalClears,primaryRoute:route.role==='safe'});
  return;
 }
 const risk=packet.riskSide,safe=packet.safeSide,branch=node.guard==='branch'||node.guard==='bird',type=branch?'branch':'log',enemy=['crocodile','fish','bird'].includes(node.guard)?node.guard:null;
 const guardChoice=packet.choices.find(choice=>choice.family==='wildlife-bank'&&choice.step===node.step);
 const guardMeta={...common,guardId:node.guardId,...(guardChoice?{choiceId:guardChoice.id,choiceFamily:guardChoice.family,choiceRole:'guard'}:{}),adventureStep:node.step,adventureRequired:true,adventureRouteLane:node.riskLane,routeSide:risk,streamSide:risk,routeRole:'risk',riskAction:branch?'duck':'jump'};
 const motion=enemy?encounterMotion(node.riskLane,node.d,maxRushSpeed,enemy,g.seed^row,g.levelIndex,streamLanes(risk),enemy==='bird'?(risk*(riverHalfWidth(node.d,g.terrainProfile)+2)-risk*(riverFork(node.d,g.terrainProfile)?.fanOffset??0)-(riverFork(node.d,g.terrainProfile)?.islandCenter??0))/LANE_SPACING+CENTER_LANE:null):null;
 if(enemy){g.encounters.adventureEnemySeen=true;add(g,type,node.riskLane,node.d,{...guardMeta,enemy,motion});}
 else if(branch){add(g,'branch',node.riskLane,node.d,{...guardMeta,branchLanes:streamLanes(risk),branchSide:risk,localWall:true});g.branchWidthsSeen|=1<<2;}
 else for(const lane of streamLanes(risk))add(g,'log',lane,node.d,{...guardMeta,localWall:true});
 const blocked=streamLanes(safe).find(lane=>lane!==node.safeLane),snatchChoice=packet.choices.find(choice=>choice.family==='boulder-snatch'&&choice.step===node.step),rockChoice=snatchChoice?{choiceId:snatchChoice.id,choiceFamily:snatchChoice.family}:{};
 add(g,'rock',blocked,node.d,{...common,...rockChoice,choiceRole:snatchChoice?'guard':null,guardId:`rock-${g.levelIndex}-${packet.id}-${node.step}`,routeSide:safe,streamSide:safe,routeRole:'safe',adventureRouteLane:node.safeLane});
 // A single clue at the safe rock opening. The larger stream reward is earned
 // by the required action itself, with two or three height-matched tokens.
 add(g,'coin',node.safeLane,node.d,{...common,...rockChoice,choiceRole:snatchChoice?'hold':null,guardId:`rock-${g.levelIndex}-${packet.id}-${node.step}`,routeSide:safe,routeRole:'safe',coinPattern:'shelter',primaryRoute:true});
 const rewardChoice=guardChoice?{choiceId:guardChoice.id,choiceFamily:guardChoice.family,choiceRole:'guard'}:{};
 const predicted=timeToImpact(g,node.d),at=relative=>g.distance+forecastTravel(g,predicted+relative);
 if(!branch){
  g.lastJumpRewardD=node.d;
  for(const offset of [-.04,0,.04])add(g,'coin',node.riskLane,at(offset),{...common,...rewardChoice,guardId:node.guardId,routeSide:risk,routeRole:'risk',coinValue:GUARDED_COIN_VALUE,primaryRoute:false,coinPattern:'jump-arc',high:true,jumpHeight:jumpArcHeight(JUMP_REWARD_LEAD+offset),jumpOffset:offset});
 }else for(const offset of [-.035,.055])add(g,'coin',node.riskLane,node.d+maxRushSpeed*offset,{...common,...rewardChoice,guardId:node.guardId,routeSide:risk,routeRole:'risk',coinValue:GUARDED_COIN_VALUE,primaryRoute:false,coinPattern:'low-passage'});
 g.rewardLane=node.safeLane;g.routeLane=node.safeLane;
}
export function generateAhead(g) {
  if(g.phase!=='playing')return;
  const level=levelAt(g.levelIndex),limit=level.length-FINISH_RUNWAY,visibleTo=g.distance+VIEW_DISTANCE+45;
  while (g.nextRow < visibleTo && g.nextRow < limit) {
    let d=g.nextRow;
    const maxRushSpeed=level.maxSpeed*1.32,fork=nextRiverFork(d,g.terrainProfile);
    if(fork&&d>=fork.start-maxRushSpeed*.90&&d<fork.start){g.nextRow=fork.start;continue;}
    if(fork&&d>=fork.start&&d<fork.end){
      let packet=g.adventures.find(item=>item.id===fork.id);
      if(!packet){packet=createAdventure(fork,maxRushSpeed,g.levelIndex);g.adventures.push(packet);}
      while(packet.nextNode<packet.nodes.length&&packet.nodes[packet.nextNode].d<visibleTo){generateAdventureNode(g,packet,packet.nodes[packet.nextNode++],maxRushSpeed);}
      if(packet.nextNode<packet.nodes.length){g.nextRow=packet.nodes[packet.nextNode].d;break;}
      g.nextRow=fork.end+maxRushSpeed*.48;g.rewardLane=packet[packet.safeSide<0?'left':'right'].cacheLane;g.routeLane=g.rewardLane;g.pendingDecisionExit=null;g.rowsSinceRequired=0;continue;
    }
    const row=g.row;
    // Preview only bounded generator state. A future earned Rush must not
    // compress two rewarded jumps into one still-running jump animation.
    // Plan the new station at its final distance before emitting any entities;
    // sections, chain counters and seeded motifs therefore remain coherent.
    const planAt=distance=>{
      const plan={...g,motifDeck:[...g.motifDeck],episode:g.episode?{...g.episode}:null,terrainBeat:g.terrainBeat?{...g.terrainBeat}:null,encounters:{...g.encounters}};
      return{plan,pattern:rowPattern(plan,row,distance)};
    };
    let planned=planAt(d);
    // A relocation can cross a section boundary and change a duck decision
    // into a jump. Recompute from its final pattern; distance only increases
    // and the two possible minimums make this a bounded planning operation.
    for(let pass=0;pass<3;pass++){
      const jumpReward=planned.pattern.decision?.action==='jump'||planned.pattern.hazards.some(h=>h.type==='log'&&h.lane===planned.pattern.coinLane);
      const jumpSpacing=jumpReward ? .90 : planned.pattern.decision ? .75 : 0;
      if(!jumpSpacing||!Number.isFinite(g.lastJumpRewardD)||d-g.lastJumpRewardD>=maxRushSpeed*jumpSpacing-1e-7)break;
      d=g.lastJumpRewardD+maxRushSpeed*jumpSpacing;
      if(d>=limit)break;
      planned=planAt(d);
    }
    if(d>=limit){g.nextRow=limit;break;}
    if(fork&&d>=fork.start-maxRushSpeed*.90){g.nextRow=fork.start;continue;}
    for(const key of ['rng','routeLane','rewardLane','routeDirection','episode','episodeIndex','motifDeck','terrainBeat','encounters','rowsSinceRequired','requiredJump','requiredDuck','lastRequiredType','requiredTypeRun','lastFormation','formationRun','lastDecisionRow'])g[key]=planned.plan[key];
    g.row++;g.nextRow=d;
    const predictedTime = g.time + timeToImpact(g,d);
    const {motif,safe,hazards:plannedHazards,coinLane,decision,act,episode,beat,recovery,intensity,terrain,activeTerrain}=planned.pattern;
    const hazards=motif==='tutorial'?spanBranches(plannedHazards,safe,coinLane,g.seed,row):plannedHazards;
    if(!g.patternsSeen.includes(motif))g.patternsSeen.push(motif);
    const section={sectionId:terrain.id,sectionType:terrain.type,sectionPhase:terrain.phase,terrainActive:!!activeTerrain,terrainComboAvailable:terrain.comboAvailable};
    for(const h of hazards.filter(isBranchSpan))g.branchWidthsSeen|=1<<branchLanes(h).length;
    hazards.forEach(h => add(g, h.type, h.lane, d, { row, motif,act,episode,beat,recovery,...section,
      ...(decision&&hazardTouchesLane(h,decision.riskLane)?{decisionId:`choice-${g.levelIndex}-${row}`,riskAction:decision.action}:{}),
      ...(h.branchLanes?{branchLanes:h.branchLanes,...(h.branchSide?{branchSide:h.branchSide}:{}),...(h.fullRiver?{fullRiver:true,canopyLead:h.canopyLead}:{})}:{}),...(h.enemy?{enemy:h.enemy,motion:encounterMotion(h.lane,d,maxRushSpeed,h.enemy,g.seed^row,g.levelIndex)}:{}) }));
    // Every spacing stays above the existing per-map safety floor, with
    // seeded variation and longer pauses after brief challenge bursts.
    const interval=row<3?1.05-Math.min(1,predictedTime/95)*.19:Math.max(level.minInterval,level.rowInterval+.16*(1-intensity)-.1*intensity+(random(g)-.5)*.22)+(recovery ? .30+.20*intensity : 0);
    const rewardHazard=hazards.find(h=>hazardTouchesLane(h,coinLane));
    const at=relative=>g.distance+forecastTravel(g,predictedTime-g.time+relative);
    if(decision){
      const id=`choice-${g.levelIndex}-${row}`,metadata={decisionId:id,row,riskAction:decision.action,riskEnemy:decision.enemy,...section};
      const packet={...decision,id,row,d,startD:Infinity,endD:-Infinity,exitLane:null,exitD:null};
      const addChoiceCoin=(lane,distance,routeRole,extra={})=>{
        packet.startD=Math.min(packet.startD,distance);packet.endD=Math.max(packet.endD,distance);
        add(g,'coin',lane,distance,{...metadata,motif,coinPattern:routeRole==='risk'&&decision.action==='jump'?'jump-arc':'guarded-fork',routeRole,
          coinValue:routeRole==='risk'?GUARDED_COIN_VALUE:ORDINARY_COIN_VALUE,primaryRoute:routeRole==='safe',...extra});
      };
      for(const offset of SAFE_COIN_OFFSETS)addChoiceCoin(decision.safeLane,d+maxRushSpeed*offset,'safe');
      if(decision.action==='jump'){
        g.lastJumpRewardD=d;
        for(const offset of JUMP_REWARD_OFFSETS)addChoiceCoin(decision.riskLane,at(offset),'risk',{high:true,jumpHeight:jumpArcHeight(JUMP_REWARD_LEAD+offset),jumpOffset:offset});
      }else for(const offset of GUARDED_DUCK_OFFSETS)addChoiceCoin(decision.riskLane,d+maxRushSpeed*offset,'risk');
      g.decisions.push(packet);
    }else if(rewardHazard?.type==='log'){
      g.lastJumpRewardD=d;
      for(const offset of JUMP_REWARD_OFFSETS)add(g,'coin',coinLane,at(offset),{high:true,jumpHeight:jumpArcHeight(JUMP_REWARD_LEAD+offset),jumpOffset:offset,row,motif,coinPattern:'jump-arc',primaryRoute:true,...section});
      // Keep the shown route entirely airborne. Approach/landing ground
      // coins cannot remain fair if a newly triggered Rush compresses it.
      // They also leave too little time to change lane into the next ribbon.
    }else{
      const clearLanes=hazards.every(h=>h.fullRiver)?LANES:LANES.filter(lane=>!hazards.some(h=>hazardTouchesLane(h,lane)));
      const layout=groundCoinLayout({seed:g.seed,row,lane:coinLane,clearLanes,unvisitedLanes:LANES.filter(lane=>!(g.coinLanesSeen&(1<<lane))),index:g.coinPatternIndex,recovery,guardType:rewardHazard?.type,allowCarve:!Number.isFinite(g.lastJumpRewardD)||d-g.lastJumpRewardD>=maxRushSpeed*.75});
      if(layout.advance)g.coinPatternIndex++;
      if(!g.coinPatternsSeen.includes(layout.pattern))g.coinPatternsSeen.push(layout.pattern);
      for(const coin of layout.coins)add(g,'coin',coin.lane,d+maxRushSpeed*coin.offset,{row,motif,coinPattern:layout.pattern,primaryRoute:coin.primaryRoute,...section});
      g.rewardLane=layout.endLane;
    }
    // The return cue names the next real ribbon, never an invented exit. It is
    // normally resolved while both rows are still ahead in the bounded horizon.
    const firstPrimary=g.entities.find(e=>e.row===row&&e.type==='coin'&&e.primaryRoute!==false);
    if(g.pendingDecisionExit)linkDecisionExit(g.decisions.find(packet=>packet.id===g.pendingDecisionExit),firstPrimary);
    g.pendingDecisionExit=decision?`choice-${g.levelIndex}-${row}`:null;
    // A relic is an optional clear-water choice at an existing recovery beat,
    // rather than a squeeze between a jump's airborne gold and the next wall.
    const encounter=g.encounters;
    if(!decision&&recovery&&plannedHazards.length===1&&!plannedHazards[0].enemy&&rewardHazard?.type!=='log'&&(encounter.enemyIndex>0||encounter.adventureEnemySeen)&&row>=encounter.nextTargetRow&&row-encounter.lastRow>=3){
      const clear=LANES.filter(lane=>!hazards.some(h=>hazardTouchesLane(h,lane)));
      const targetLane=clear.find(lane=>lane!==coinLane&&Math.abs(lane-coinLane)===1)??(clear.includes(coinLane)?coinLane:clear[0]);
      if(clear.includes(targetLane)){
        add(g,'target',targetLane,d,{row,motif,recovery:true,...section,motion:encounterMotion(targetLane,d,maxRushSpeed,'target',g.seed^row),value:TARGET_VALUE});
        encounter.lastRow=row;encounter.targetIndex++;
        encounter.nextTargetRow=row+7+encounterGap(g.seed,encounter.targetIndex,g.levelIndex);
      }
    }
    if (row % 13 === 6) add(g, 'magnet', safe, d - 8);
    if (row % 17 === 11) add(g, 'shield', safe, d - 8);
    g.nextRow += Math.max(speedAt(predictedTime,g.levelIndex)*interval,decision?maxRushSpeed*decision.returnSeconds:0);
    if(fork&&g.nextRow>fork.start&&d<fork.start)g.nextRow=fork.start;
  }
  if(!g.runwayGenerated&&visibleTo>limit){
    g.runwayGenerated=true;
    // Late jumps have landed before the gold line, including earned Rush.
    for(let d=level.length-90;d<=level.length-15;d+=5)add(g,'coin',CENTER_LANE,d,{motif:'finish-runway',coinPattern:'finish',primaryRoute:true});
  }
  g.entities.sort((a, b) => a.d - b.d || a.id - b.id);
}
export function jumpHeight(g) {
  return jumpHeightAt(g.action,g.actionTime);
}
function jumpHeightAt(action,time){return action==='jump'?jumpArcHeight(time):0;}
// Reward a timely tap on the launch frame, before the arc reaches full height.
function jumpClearsAt(action,time){return action==='jump'&&time<JUMP_SECONDS&&(time<=.06||jumpHeightAt(action,time)>COIN_GROUND_MAX_JUMP_HEIGHT);}
export function coinHeightTouches(high,action,time){return high?jumpClearsAt(action,time):jumpHeightAt(action,time)<=COIN_GROUND_MAX_JUMP_HEIGHT;}
export function coinTouchesAtHeight(entity,action,time){
 const height=coinJumpHeight(entity);
 if(height===null)return coinHeightTouches(!!entity.high,action,time);
 if(action!=='jump'||time>=JUMP_SECONDS)return false;
 return entity.jumpOffset===0&&time<=.06||Math.abs(jumpArcHeight(time)-height)<=COIN_ARC_HEIGHT_RADIUS;
}
function crossingAction(frame,elapsed){
  const duration=frame.action==='jump'?JUMP_SECONDS:DUCK_SECONDS;
  if(!frame.action||frame.actionTime+elapsed<duration)return{action:frame.action,time:frame.actionTime+elapsed};
  const remaining=elapsed-(duration-frame.actionTime);
  // updateGame starts a queued action before decrementing its buffer timer.
  // Use the same decision here when landing and crossing share one frame.
  return frame.buffered&&frame.bufferTime>0?{action:frame.buffered,time:remaining}:{action:'',time:0};
}
function beginAction(g, action) {
  g.action = action; g.actionTime = 0; g.buffered = ''; g.bufferTime = 0;
  emit(g, action);
}
export function applyAction(g, action) {
  if (g.phase !== 'playing') return;
  if (action === 'left' || action === 'right') {
    const lane = clampLane(g.lane + (action === 'left' ? -1 : 1));
    if (lane !== g.lane) { g.lane = lane; emit(g, 'swap'); }
  } else if (action === 'jump' || action === 'duck') {
    if (g.action === action) { g.buffered = action; g.bufferTime = .2; }
    else beginAction(g, action); // Down cancels jump; up cancels duck, immediately.
  } else if (action === 'rush' && g.charge >= 100 && !g.rush) {
    g.charge = 0; g.rush = 4; emit(g, 'rush', 'RUSH! Smash through everything');
  }
}
export const ISLAND_RAFT_RADIUS=.90;
// Find the first land contact along the analytic trajectory, not just the end
// of a frame. Small sweep intervals plus bisection preserve crossing at 30Hz.
function islandContact(g,frame,previous,end,dt,frameBaseSpeed,boostedSeconds){
 const at=t=>{
  const lane=laneSpring(frame.position,frame.velocity,frame.target,t).position;
  const d=Math.min(end,previous+frameBaseSpeed*(Math.min(t,boostedSeconds)*1.32+Math.max(0,t-boostedSeconds))),cross=forkLaneCross(lane,d,g.terrainProfile);
  return{lane,d,cross,inside:islandContains(cross,d,g.terrainProfile,ISLAND_RAFT_RADIUS)};
 };
 const first=at(0),last=at(dt),fork=riverFork(previous,g.terrainProfile)||riverFork(end,g.terrainProfile);
 if(!fork)return null;
 const recovering=first.inside&&g.islandReboundSide!==null&&Math.sign(frame.target-CENTER_LANE)===g.islandReboundSide;
 if(first.inside&&!recovering)return{elapsed:0,...first};
 if(recovering)return null;
 const coefficient=frame.velocity+36*(frame.position-frame.target),turning=coefficient?frame.velocity/(36*coefficient):-1;
 const turn=turning>0&&turning<dt?at(turning):null;
 if(!first.inside&&!last.inside&&!turn?.inside&&Math.sign(first.cross-fork.islandCenter)===Math.sign(last.cross-fork.islandCenter)&&(!turn||Math.sign(turn.cross-fork.islandCenter)===Math.sign(first.cross-fork.islandCenter))&&Math.abs(frame.position-CENTER_LANE)>1&&Math.abs(frame.target-CENTER_LANE)>1)return null;
 const samples=Math.max(8,Math.min(96,Math.ceil(Math.abs(last.cross-first.cross)/.22)+8));let lo=0;
 const times=Array.from({length:samples},(_,index)=>dt*(index+1)/samples);
 // A shallow reversal can touch land only at the known analytic extremum,
 // between every uniform sample. Keep that witness as a bisection bracket.
 if(turn)times.push(turning);
 times.sort((a,b)=>a-b);
 for(const hi of times){
  const point=at(hi);
  if(point.inside){let a=lo,b=hi;for(let pass=0;pass<18;pass++){const middle=(a+b)/2;if(at(middle).inside)b=middle;else a=middle;}return{elapsed:b,...at(b)};}
  lo=hi;
 }
 return null;
}
function collide(g, obstacle, contact, protectedAtCrossing) {
  const adventure=g.adventures.find(packet=>contact.distance>=packet.start&&contact.distance<=packet.end);
  if(adventure&&(Math.sign(contact.playerLane-CENTER_LANE)===adventure.riskSide||obstacle.type==='island'))adventureRoute(adventure,adventure.riskSide).cleanEligible=false;
  g.terrainCombo.count=0;
  if (protectedAtCrossing) { obstacle.destroyed = true; emit(g, 'smash', '', contact.playerLane, contact); return 'protected'; }
  if (g.shield) {
    obstacle.destroyed = true;
    g.shield = false; g.shieldsUsed++;
    g.streak = 0; g.multiplier = 1;
    emit(g, 'hit', 'Shield saved you! Next hit ends the run', contact.playerLane, contact); return 'shield';
  }
  g.phase = 'lost';
  g.reason = obstacle.type==='island'?'Island hit. Choose a stream before the split.':obstacle.enemy==='crocodile'?'Crocodile hit. Jump over it or switch lanes.':obstacle.enemy==='bird'?'Bird hit. Duck under it or switch lanes.':obstacle.enemy==='fish'?'Leaping fish hit. Jump over it or switch lanes.':obstacle.type === 'rock' ? 'Rock hit. Switch lanes to dodge boulders.' : obstacle.type === 'log' ? 'Log hit. Jump as it reaches your raft.' : 'Branch hit. Duck as it reaches your raft.';
  emit(g, 'lose', 'WIPEOUT', contact.playerLane, contact); return 'lost';
}
export function updateGame(g, input, dt) {
  if (g.phase !== 'playing') return;
  dt = clamp(dt, 0, .05);
  const taps = input.actions.splice(0);
  taps.forEach(action => applyAction(g, action));
  const frame={time:g.time,position:g.visualLane,velocity:g.laneVelocity,target:g.lane,action:g.action,actionTime:g.actionTime,buffered:g.buffered,bufferTime:g.bufferTime,magnet:g.magnet,rush:g.rush,grace:g.grace};
  const sectionAtFrame=terrainSection(g.distance,g.terrainProfile);
  if(g.terrainCombo.section!==sectionAtFrame.id)g.terrainCombo={section:sectionAtFrame.id,count:0,claimed:false};
  g.time += dt;
  if (g.action) {
    g.actionTime += dt;
    if (g.actionTime >= (g.action === 'jump' ? JUMP_SECONDS : DUCK_SECONDS)) {
      if (g.action === 'jump') emit(g, 'land');
      g.action = ''; g.actionTime = 0;
      if (g.bufferTime > 0) beginAction(g, g.buffered);
    }
  }
  g.bufferTime = Math.max(0, g.bufferTime - dt);
  const frameBaseSpeed=speedAt(g.time,g.levelIndex),boostedSeconds=Math.min(frame.rush,dt),boostedDistance=frameBaseSpeed*1.32*boostedSeconds;
  g.rush = Math.max(0, frame.rush - dt);if(g.rush<1e-9)g.rush=0;
  g.speed = frameBaseSpeed * (g.rush > 0 ? 1.32 : 1);
  const steering=laneSpring(g.visualLane,g.laneVelocity,g.lane,dt);
  g.visualLane=steering.position;g.laneVelocity=steering.velocity;
  const previous = g.distance;
  const level=levelAt(g.levelIndex);
  g.distance = Math.min(level.length,g.distance+boostedDistance+frameBaseSpeed*(dt-boostedSeconds));
  if (g.time - g.lastCoin > 2.8) { g.streak = 0; g.multiplier = 1; }
  // Generated courses are ordered, but processing the crossed subset in
  // physical order also guarantees a coin boost cannot enhance an earlier coin.
  const crossed=g.entities.filter(e=>!e.done&&e.d<=g.distance&&e.d>previous).sort((a,b)=>a.d-b.d||a.id-b.id);
  const land=islandContact(g,frame,previous,g.distance,dt,frameBaseSpeed,boostedSeconds);
  if(land)crossed.push({id:`island-${g.eventId}`,type:'island',lane:land.lane,d:land.d,landElapsed:land.elapsed,done:false});
  crossed.sort((a,b)=>a.d-b.d||Number(b.type==='island')-Number(a.type==='island')||a.id-b.id);
  let rebound=null;
  const steeringAt=t=>rebound&&t>=rebound.elapsed?laneSpring(rebound.position,rebound.velocity,rebound.target,t-rebound.elapsed):laneSpring(frame.position,frame.velocity,frame.target,t);
  let boostUntil=frame.magnet;
  let graceUntil=frame.grace;
  const clearedRows=new Set(),canopyContacts=new Set(),passedCanopies=new Set();
  const waveRows=new Map(crossed.filter(e=>e.type==='log'&&e.terrainActive&&e.sectionType==='wave-train').map(e=>[Number.isInteger(e.row)?`row:${e.row}`:`entity:${e.id}`,e.sectionId]));
  let fatalContact=null,lastContactCoinTime=null;
  let coinGoalDuringRush=false;
  // A pouch uses exactly the same per-coin economics as a touched token;
  // only the aggregate presentation receipt differs.
  const awardCoin=(coinValue,boosted,elapsed)=>{
    g.coins++;g.streak++;g.lastCoin=g.time;lastContactCoinTime=frame.time+elapsed;
    if(g.goal.kind==='coins'&&g.coins-g.goal.start>=g.goal.target&&frame.rush>elapsed)coinGoalDuringRush=true;
    g.multiplier=Math.min(5,1+Math.floor(g.streak/8));
    const value=coinValue*g.multiplier*(boosted?2:1);
    g.bonus+=value;if(frame.rush<=elapsed)g.charge=Math.min(100,g.charge+2);
    return value;
  };
  for (const e of crossed) {
    e.done = true;
    // Sample the same analytic trajectory for coins and powers at their exact
    // crossing. Powers cannot activate while the visible raft is still beside
    // them, including when steering is reversed or a frame spans several items.
    const travelled=e.d-previous;
    const elapsed=e.type==='island'?e.landElapsed:clamp(travelled<=boostedDistance?travelled/(frameBaseSpeed*1.32):boostedSeconds+(travelled-boostedDistance)/frameBaseSpeed,0,dt);
    const steeringAtCrossing=steeringAt(elapsed);
    const lane=steeringAtCrossing.position;
    const obstacleLane=entityLane(e,e.d);
    const overlap=Math.abs(forkLaneCross(obstacleLane,e.d,g.terrainProfile)-forkLaneCross(lane,e.d,g.terrainProfile))<=COIN_LANE_RADIUS*LANE_SPACING;
    if (e.type === 'coin') {
      const action=crossingAction(frame,elapsed);
      const boosted=boostUntil>elapsed;
      if (overlap&&coinTouchesAtHeight(e,action.action,action.time)) {
        e.collected=true;
        const coinValue=e.coinValue===GUARDED_COIN_VALUE?GUARDED_COIN_VALUE:ORDINARY_COIN_VALUE;
        const value=awardCoin(coinValue,boosted,elapsed);
        emit(g, 'coin', g.streak % 8 === 0 ? `COIN STREAK ×${g.multiplier}` : '', e.lane, { entityId:e.id,high: !!e.high,jumpHeight:coinJumpHeight(e),coinPattern:e.coinPattern??null,primaryRoute:e.primaryRoute!==false,
          coinValue,choiceId:e.choiceId??null,choiceFamily:e.choiceFamily??null,choiceRole:e.choiceRole??null,guardId:e.guardId??null,adventureId:e.adventureId??null,adventureStep:e.adventureStep??null,routeSide:e.routeSide??null,decisionId:e.decisionId??null,row:e.row??null,routeRole:e.routeRole??null,riskAction:e.riskAction??null,riskEnemy:e.riskEnemy??null,
          distance:e.d, playerLane:lane, playerHeight:jumpHeightAt(action.action,action.time),attracted:false,boosted,value,streak:g.streak,multiplier:g.multiplier,contactTime:frame.time+elapsed });
      }
    } else if(e.type==='stash'){
      const action=crossingAction(frame,elapsed);
      if(overlap&&coinHeightTouches(false,action.action,action.time)){
        const coinCount=e.choiceFamily==='wildlife-bank'&&e.coinCount===BANK_COIN_COUNT?BANK_COIN_COUNT:0,boosted=boostUntil>elapsed;
        const coinValues=Array.from({length:coinCount},()=>awardCoin(ORDINARY_COIN_VALUE,boosted,elapsed));
        const value=coinCount?coinValues.reduce((sum,points)=>sum+points,0):e.value===200?200:120;e.collected=true;if(!coinCount)g.bonus+=value;
        const packet=g.adventures.find(item=>item.id===e.adventureId),choice=packet?.choices.find(item=>item.id===e.choiceId);
        if(choice){choice.collected=true;choice.earned=value;choice.outcome='stash';}
        emit(g,'stash',coinCount?`${coinCount} COINS · +${value}`:`GOLD STASH +${value}`,obstacleLane,{entityId:e.id,value,coinCount,coinValues,coinValue:coinCount?ORDINARY_COIN_VALUE:null,boosted:coinCount&&boosted,streak:g.streak,multiplier:g.multiplier,choiceId:e.choiceId,choiceFamily:e.choiceFamily,choiceRole:e.choiceRole,
          adventureId:e.adventureId,adventureStep:e.adventureStep,routeSide:e.routeSide,routeRole:e.routeRole,guardId:e.guardId,returnLane:e.returnLane,returnD:e.returnD,
          distance:e.d,playerLane:lane,playerHeight:jumpHeightAt(action.action,action.time),contactTime:frame.time+elapsed});
      }
    } else if(e.type==='treasure'){
      const action=crossingAction(frame,elapsed),packet=g.adventures.find(item=>item.id===e.adventureId);
      if(overlap&&coinHeightTouches(false,action.action,action.time)){
        const payout=treasurePayout(packet,e);e.collected=true;Object.assign(e,payout);g.bonus+=payout.value;
        const route=packet?adventureRoute(packet,e.routeSide):null;if(route){route.collected=true;route.earned=payout.value;}
        emit(g,'treasure',`${payout.clean&&e.treasureCleanBonus?'CLEAN RUN · ':''}TREASURE +${payout.value}`,obstacleLane,{entityId:e.id,adventureId:e.adventureId,routeSide:e.routeSide,routeRole:e.routeRole,requiredClears:e.requiredClears,...payout,distance:e.d,playerLane:lane,playerHeight:jumpHeightAt(action.action,action.time),contactTime:frame.time+elapsed});
      }
    } else if(e.type==='island'){
      const action=crossingAction(frame,elapsed),contact={entityId:e.id,obstacle:'island',distance:e.d,playerLane:lane,playerHeight:jumpHeightAt(action.action,action.time),action:action.action,actionTime:action.time,contactTime:frame.time+elapsed};
      const outcome=collide(g,e,contact,frame.rush>elapsed||graceUntil>elapsed);
      if(outcome==='lost')fatalContact={elapsed,distance:e.d,steering:steeringAtCrossing,action};
      else{
        const physical=forkLaneCross(lane,e.d,g.terrainProfile),island=riverFork(e.d,g.terrainProfile),side=Math.sign(physical-(island?.islandCenter??0))||g.islandReboundSide||-1;
        g.islandReboundSide=side;g.lane=innerStreamLane(side);
        // The impact stops the inward momentum at contact, then the accepted
        // spring carries the raft back into its water during the frame remainder.
        rebound={elapsed,position:lane,velocity:0,target:g.lane};
        if(outcome==='shield')graceUntil=elapsed+1.1;
      }
    } else if(e.type==='target'){
      const action=crossingAction(frame,elapsed);
      if(overlap&&coinHeightTouches(false,action.action,action.time)){
        e.collected=true;g.bonus+=TARGET_VALUE;
        const charge=frame.rush>elapsed?0:Math.min(TARGET_CHARGE,100-g.charge);
        g.charge+=charge;
        emit(g,'target',`RELIC +${TARGET_VALUE}`,obstacleLane,{entityId:e.id,value:TARGET_VALUE,charge,distance:e.d,playerLane:lane,playerHeight:jumpHeightAt(action.action,action.time),contactTime:frame.time+elapsed});
      }
    } else if (e.type === 'magnet' || e.type === 'shield') {
      const action=crossingAction(frame,elapsed);
      if (overlap&&(!e.groundedContact||coinHeightTouches(false,action.action,action.time))) {
        e.collected=true;
        const shieldAlreadyHeld=e.type==='shield'&&g.shield;
        if (e.type === 'magnet') boostUntil=elapsed+8; else g.shield = true;
        const packet=g.adventures.find(item=>item.id===e.adventureId),choice=packet?.choices.find(item=>item.id===e.choiceId);
        if(choice){choice.counterpartCollected=true;choice.counterpartEarned=e.type==='magnet'?8:shieldAlreadyHeld?0:1;choice.outcome='counterpart';choice.shieldAlreadyHeld=shieldAlreadyHeld;}
        emit(g, 'power', e.type === 'magnet' ? 'GOLD BOOST ×2! Touch coins for double points' : shieldAlreadyHeld?'SHIELD ALREADY HELD':'SHIELD! One free hit', e.lane, {entityId:e.id,power:e.type,duration:e.type==='magnet'?8:0,shieldAlreadyHeld,choiceId:e.choiceId??null,choiceFamily:e.choiceFamily??null,choiceRole:e.choiceRole??null,adventureId:e.adventureId??null,adventureStep:e.adventureStep??null,routeSide:e.routeSide??null,routeRole:e.routeRole??null,guardId:e.guardId??null,returnLane:e.returnLane??null,returnD:e.returnD??null,distance:e.d,playerLane:lane,playerHeight:jumpHeightAt(action.action,action.time),contactTime:frame.time+elapsed});
      }
    } else {
      if(!(e.fullRiver||e.localWall)||!passedCanopies.has(e.row))g.rowsPassed++;
      if(e.fullRiver||e.localWall)passedCanopies.add(e.row);
      const rushAtCrossing=frame.rush>elapsed;
      if (hazardTouchesLane(e,lane,HAZARD_LANE_RADIUS,g.terrainProfile)) {
        if((e.fullRiver||e.localWall)&&canopyContacts.has(e.row))continue;
        if(e.fullRiver||e.localWall)canopyContacts.add(e.row);
        const action=crossingAction(frame,elapsed);
        const contact={entityId:e.id,guardId:e.guardId??null,choiceId:e.choiceId??null,choiceFamily:e.choiceFamily??null,choiceRole:e.choiceRole??null,adventureId:e.adventureId??null,adventureStep:e.adventureStep??null,routeSide:e.routeSide??null,row:e.row??null,decisionId:e.decisionId??null,obstacle:e.type,enemy:e.enemy??null,obstacleLane,...(isBranchSpan(e)?{branchLanes:branchLanes(e),spanWidth:branchSpan(e).width}:{}),distance:e.d,playerLane:lane,playerHeight:jumpHeightAt(action.action,action.time),action:action.action,actionTime:action.time,contactTime:frame.time+elapsed};
        const cleared = (e.type === 'log' && jumpClearsAt(action.action,action.time)) || (e.type === 'branch' && action.action === 'duck');
        if (cleared && !rushAtCrossing && graceUntil<=elapsed) {
          // Between lanes a raft can overlap two parts of one action wave.
          // Both clear, but the row is one trick and receives one reward.
          const rowKey=Number.isInteger(e.row)?`row:${e.row}`:`entity:${e.id}`;
          if(clearedRows.has(rowKey))continue;
          clearedRows.add(rowKey);
          const type = e.type === 'log' ? 'jump' : 'duck';
          g[type === 'jump' ? 'jumps' : 'ducks']++;
          g.bonus += 100 * g.multiplier; g.charge = Math.min(100, g.charge + 12);
          emit(g, 'perfect', `PERFECT ${type.toUpperCase()} +${100 * g.multiplier}`, lane, contact);
          if(e.adventureRequired)recordAdventureClear(g.adventures.find(item=>item.id===e.adventureId),e.routeSide,e.adventureStep);
          if(e.terrainActive&&e.terrainComboAvailable&&e.sectionType==='wave-train'&&type==='jump'&&graceUntil<=elapsed){
            if(g.terrainCombo.section!==e.sectionId)g.terrainCombo={section:e.sectionId,count:0,claimed:false};
            g.terrainCombo.count=Math.min(3,g.terrainCombo.count+1);
            if(g.terrainCombo.count===3&&!g.terrainCombo.claimed){
              g.terrainCombo.claimed=true;g.bonus+=350;
              emit(g,'terrain-combo','WAVE CHAIN! 3 perfect jumps +350',lane,{...contact,sectionId:e.sectionId,value:350});
            }
          }
        } else {
          const outcome=collide(g,e,contact,rushAtCrossing||graceUntil>elapsed);
          if(e.fullRiver&&outcome!=='lost')for(const sibling of g.entities)if(sibling.fullRiver&&sibling.row===e.row){sibling.destroyed=true;sibling.done=true;}
          if(outcome==='shield')graceUntil=elapsed+1.1;
          else if(outcome==='lost')fatalContact={elapsed,distance:e.d,steering:steeringAtCrossing,action};
        }
      } else if(!e.fullRiver){ g.dodges++; if (!rushAtCrossing&&graceUntil<=elapsed) g.charge = Math.min(100, g.charge + 2); }
    }
    if (g.phase !== 'playing') break;
  }
  for(const e of crossed)if(e.adventureRequired&&e.done&&(!fatalContact||e.d<=fatalContact.distance))finishAdventureStep(g.adventures.find(item=>item.id===e.adventureId),e.routeSide,e.adventureStep);
  for(const packet of g.adventures)for(const choice of packet.choices)if(choice.outcome==='pending'&&choice.choiceD<=(fatalContact?.distance??g.distance))choice.outcome='missed';
  if(rebound&&!fatalContact){const result=steeringAt(dt);g.visualLane=result.position;g.laneVelocity=result.velocity;}
  if(g.islandReboundSide!==null&&!islandContains(forkLaneCross(g.visualLane,g.distance,g.terrainProfile),g.distance,g.terrainProfile,ISLAND_RAFT_RADIUS))g.islandReboundSide=null;
  // A bypassed wave or a powered smash breaks the optional jump chain. Parts
  // of one full-width wave share a row, so passing its other lanes is harmless.
  for(const [row,sectionId] of waveRows)if(!clearedRows.has(row)&&g.terrainCombo.section===sectionId)g.terrainCombo.count=0;
  // A wipeout freezes at actual contact. Keeping the remainder of the frame's
  // steering would show the stopped raft beside the rock that just hit it.
  const advanced=fatalContact?.elapsed??dt;
  if(fatalContact){
    g.time=frame.time+advanced;g.distance=fatalContact.distance;
    g.visualLane=fatalContact.steering.position;g.laneVelocity=fatalContact.steering.velocity;
    g.action=fatalContact.action.action;g.actionTime=fatalContact.action.time;
    const duration=frame.action==='jump'?JUMP_SECONDS:DUCK_SECONDS;
    const bufferConsumed=frame.action&&frame.actionTime+advanced>=duration;
    g.buffered=bufferConsumed?'':frame.buffered;g.bufferTime=bufferConsumed?0:Math.max(0,frame.bufferTime-advanced);
    g.rush=Math.max(0,frame.rush-advanced);g.speed=speedAt(g.time,g.levelIndex)*(g.rush>0?1.32:1);
    if(lastContactCoinTime!==null)g.lastCoin=lastContactCoinTime;
    g.effects=g.effects.filter(e=>e.time<=g.time||Number.isFinite(e.contactTime)&&e.contactTime<=g.time);
    for(const effect of g.effects)if(Number.isFinite(effect.contactTime))effect.time=Math.min(effect.time,effect.contactTime);
  }
  g.magnet=Math.max(0,boostUntil-advanced);
  g.grace=Math.max(0,graceUntil-advanced);
  if (g.phase === 'playing') {
    const totals = { tricks: g.jumps + g.ducks, coins: g.coins, distance: g.distance };
    if (totals[g.goal.kind] - g.goal.start >= g.goal.target) {
      g.goalsCleared++; g.bonus += 500;
      // A coin challenge completed during Rush is still a powered reward,
      // even if Rush expires before this frame's goal bookkeeping runs.
      if (!g.rush&&!coinGoalDuringRush) g.charge = Math.min(100, g.charge + 20);
      emit(g, 'goal', 'CHALLENGE CLEARED +500');
      const kind = ['tricks', 'coins', 'distance'][g.goalsCleared % 3];
      g.goal = { kind, start: totals[kind], target: kind === 'tricks' ? 3 + Math.min(5, g.goalsCleared) : kind === 'coins' ? 40 : 500 };
    }
  }
  if(g.phase==='playing'&&g.distance>=level.length){
    g.phase='won';g.bonus+=1000*(g.levelIndex+1);
    g.action='';g.actionTime=0;g.buffered='';g.bufferTime=0;g.rush=0;
    emit(g,'finish',g.levelIndex===LEVELS.length-1?'ADVENTURE COMPLETE!':`${level.name.toUpperCase()} CLEAR!`);
  }
  g.score = Math.floor(g.distance * 2) + g.bonus;
  g.effects = g.effects.filter(e => g.time - e.time < .75);
  g.entities = g.entities.filter(e => e.d > g.distance - 16);
  g.decisions=g.decisions.filter(packet=>packet.endD>g.distance-16);
  g.adventures=g.adventures.filter(packet=>packet.end>g.distance-16);
  if (g.phase === 'playing') generateAhead(g);
}
export function snapshot(g) {
  const level=levelAt(g.levelIndex);
  const terrain=terrainSection(g.distance,g.terrainProfile),sameCombo=g.terrainCombo.section===terrain.id;
  const next = g.entities.find(e => !e.done && hazardTouchesLane(e,g.lane,HAZARD_LANE_RADIUS,g.terrainProfile) && ['rock', 'log', 'branch'].includes(e.type));
  const currentFork=riverFork(g.distance,g.terrainProfile),availableLanes=currentFork&&currentFork.islandHalfWidth>.035?streamLanes(g.visualLane<CENTER_LANE?-1:1):LANES;
  const impendingFork=nextRiverFork(g.distance,g.terrainProfile);
  const islandAhead=impendingFork&&g.lane>CENTER_LANE-.8&&g.lane<CENTER_LANE+.8&&g.distance<impendingFork.splitStart&&timeToImpact(g,impendingFork.start+12)<.9?{id:`island-${impendingFork.id}`,type:'island',enemy:null,fullRiver:false,lane:CENTER_LANE,destinationLane:CENTER_LANE,in:timeToImpact(g,impendingFork.start+12),safeLane:innerStreamLane(impendingFork.safeSide)}:null;
  const adventure=g.phase==='playing'?g.adventures.find(packet=>packet.end>g.distance&&timeToImpact(g,packet.start)<=4.2):null;
  const choiceSide=g.visualLane<1.5?-1:g.visualLane>2.5?1:null;
  let choice=adventure?.choices.filter(item=>(choiceSide===null||item.routeSide===choiceSide)&&(item.choiceD>=g.distance||(item.collected||item.counterpartCollected)&&item.exitD>g.distance)&&timeToImpact(g,item.choiceD)<=2.6).sort((a,b)=>Math.max(g.distance,a.choiceD)-Math.max(g.distance,b.choiceD)||a.choiceD-b.choiceD)[0]??null;
  if((choice?.collected||choice?.counterpartCollected)&&choice.family==='landing-detour'){
    const bank=adventure.choices.find(item=>item.family==='wildlife-bank'&&item.guardId===choice.guardId&&!item.collected&&item.choiceD>=g.distance);
    if(bank)choice={...bank,returnFromChoiceId:choice.id,returnFromValue:choice.earned,returnFromCounterpart:choice.counterpartCollected?choice.counterpartType:null};
  }else if(choice?.collected&&choice.family==='wildlife-bank'){
    // A following detour shares this bank's pending exit. Show its fresh offer
    // and then its actual return, rather than keeping the older bank receipt.
    const detour=adventure.choices.find(item=>item.family==='landing-detour'&&item.sourceGuardId===choice.guardId&&item.exitD===choice.exitD&&(item.choiceD>=g.distance||(item.collected||item.counterpartCollected)&&item.exitD>g.distance)&&timeToImpact(g,item.choiceD)<=2.6);
    if(detour)choice={...detour,returnFromChoiceId:choice.id,returnFromValue:choice.earned};
  }
  const routeSnapshot=route=>({name:route.name,role:route.role,basePoints:route.basePoints,maxPoints:route.maxPoints,cleanClears:route.cleanClears,totalClears:route.totalClears,cleanEligible:route.cleanEligible,cacheLane:route.cacheLane,cacheD:route.cacheD,collected:route.collected,earned:route.earned});
  const decision=g.phase==='playing'&&!adventure?g.decisions.find(packet=>packet.endD>g.distance&&timeToImpact(g,packet.startD)<=2.8):null;
  return { phase: g.phase,laneCount:LANE_COUNT,coinPatterns:[...g.coinPatternsSeen], time: g.time, distance: Math.floor(g.distance), lane: g.lane, visualLane: g.visualLane, actionTime: g.actionTime,
    action: g.action, coins: g.coins, score: g.score, streak: g.streak, multiplier: g.multiplier,
    charge: g.charge, rush: g.rush, magnet: g.magnet, shield: g.shield, speed: g.speed, streakTime: g.streak ? Math.max(0, 2.8 - (g.time - g.lastCoin)) : 0,
    jumps: g.jumps, ducks: g.ducks, dodges: g.dodges, reason: g.reason,
    level:{index:level.index,id:level.id,name:level.name,length:level.length,remaining:Math.max(0,Math.ceil(level.length-g.distance)),progress:clamp(g.distance/level.length,0,1),final:level.index===LEVELS.length-1,difficulty:level.difficulty},
    campaign:campaignTotals(g),
    terrain:{...terrain,comboProgress:terrain.comboAvailable&&sameCombo?g.terrainCombo.count:0,comboClaimed:terrain.comboAvailable&&sameCombo&&g.terrainCombo.claimed},
    goalsCleared: g.goalsCleared, goal: { ...g.goal, progress: Math.min(g.goal.target, Math.floor((g.goal.kind === 'tricks' ? g.jumps + g.ducks : g.goal.kind === 'coins' ? g.coins : g.distance) - g.goal.start)) },
    notice: g.time < g.noticeUntil ? g.notice : '',
    rewardChoice:choice?{...choice,heldShield:g.shield,activeBoost:g.magnet,in:timeToImpact(g,choice.choiceD),guardIn:timeToImpact(g,choice.guardD),exitIn:timeToImpact(g,choice.exitD),expired:g.distance>choice.choiceD&&!choice.collected&&!choice.counterpartCollected,cleanBonusAtRisk:choice.routeRole==='risk'&&adventureRoute(adventure,choice.routeSide).cleanEligible?400:0}:null,
    adventure:adventure?{phrase:adventure.phrase,safePhrase:adventure.safePhrase,id:adventure.id,name:adventure.name,theme:adventure.theme,in:timeToImpact(g,adventure.start),phase:g.distance<adventure.splitStart?'approach':g.distance>adventure.splitEnd?'rejoin':'split',riskSide:adventure.riskSide,safeSide:adventure.safeSide,selectedSide:g.visualLane<1.5?-1:g.visualLane>2.5?1:null,requiredClears:3,left:routeSnapshot(adventure.left),right:routeSnapshot(adventure.right)}:null,
    decision:decision?{id:decision.id,in:timeToImpact(g,decision.d),action:decision.action,enemy:decision.enemy,safeLane:decision.safeLane,riskLane:decision.riskLane,
      exitLane:decision.exitLane,safeBasePoints:decision.safeBasePoints,riskBasePoints:decision.riskBasePoints,skillBasePoints:decision.skillBasePoints,
      variant:decision.variant,entryWidth:decision.entryWidth,exitWidth:decision.exitWidth??null,
      committed:Math.abs(g.visualLane-decision.riskLane)<=COIN_LANE_RADIUS&&timeToImpact(g,decision.d)<.8}:null,
    hint: islandAhead??(next && next.d - g.distance < g.speed*(next.enemy?1.6:1.1) ? { id: next.id,guardId:next.guardId??null,localWall:!!next.localWall,fullStreamGate:!!next.localWall&&!!currentFork, type: next.type, enemy:next.enemy??null,fullRiver:!!next.fullRiver, lane:isBranchSpan(next)?branchSpan(next).centerLane:entityLane(next,g.distance),destinationLane:isBranchSpan(next)?branchSpan(next).centerLane:entityLane(next,next.d),...(isBranchSpan(next)?{spanLanes:branchLanes(next),spanWidth:branchSpan(next).width}:{}),in: timeToImpact(g,next.d), safeLane: availableLanes.find(lane => !g.entities.some(e => e.row === next.row && hazardTouchesLane(e,lane,HAZARD_LANE_RADIUS,g.terrainProfile) && ['rock','log','branch'].includes(e.type))) } : null) };
}
export function validBest(value) {
  return value?.version===3&&Number.isSafeInteger(value.score)&&value.score>0
    &&Number.isSafeInteger(value.distance)&&value.distance>=0
    &&Number.isSafeInteger(value.coins)&&value.coins>=0
    &&Number.isInteger(value.levelsCleared)&&value.levelsCleared>=0&&value.levelsCleared<=LEVELS.length?value:null;
}
