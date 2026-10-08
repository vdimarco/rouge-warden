// Distance-based river runner. Presentation never decides collisions.
import { laneSpring } from './world.js';
import { LEVELS, FINISH_RUNWAY, levelAt, levelSeed, levelSpeed } from './levels.js';
import { courseAct, courseIntensity } from './course-intensity.js';
import { terrainSection } from './course-sections.js';
import {jumpArcHeight,coinJumpHeight,JUMP_REWARD_LEAD,JUMP_REWARD_OFFSETS,COIN_ARC_HEIGHT_RADIUS} from './jump-rewards.js';
import {entityLane,encounterMotion,encounterGap,TARGET_VALUE,TARGET_CHARGE} from './moving-encounters.js';
import {isBranchSpan,branchLanes,branchSpan,branchOverlap,BRANCH_LANE_RADIUS} from './branch-spans.js';
import {LANES,LANE_COUNT,MIN_LANE,MAX_LANE,CENTER_LANE,clampLane} from './lanes.js';
import {groundCoinLayout} from './coin-layouts.js';
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
export const hazardTouchesLane=(entity,lane,radius=HAZARD_LANE_RADIUS)=>isBranchSpan(entity)?branchOverlap(entity,lane,radius):Math.abs(entityLane(entity,entity.d)-lane)<=radius;
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
    event: '', eventId: 0, effects: [], notice: level.index===0?'Jump logs · Duck branches · Dodge rocks':`${level.name} · ${level.difficulty}`, noticeUntil: 4, reason: '' };
  for (let d = 7; d <= 32; d += 5) add(g, 'coin', CENTER_LANE, d,{coinPattern:'opening',primaryRoute:true});
  generateAhead(g); return g;
}
export function restartLevel(g){return createGame(g.campaignSeed,g.levelIndex,g.carry);}
export function nextLevel(g){return g.phase==='won'&&g.levelIndex<LEVELS.length-1?createGame(g.campaignSeed,g.levelIndex+1,campaignTotals(g)):null;}
function random(g) { g.rng = (Math.imul(g.rng, 1664525) + 1013904223) >>> 0; return g.rng / 4294967296; }
function add(g, type, lane, d, extra = {}) { g.entities.push({ id: g.nextId++, type, lane, d, done: false, ...extra });if(type==='coin')g.coinLanesSeen|=1<<lane; }
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
  const reserveTarget=recovery&&hazards.length===1&&encounter.enemyIndex>0&&encounter.targetIndex===0&&row>=encounter.nextTargetRow&&row-encounter.lastRow>=3;
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
  return{motif,safe,hazards,coinLane,act,episode:episode.index,beat:step,recovery,intensity,terrain,activeTerrain};
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
export function generateAhead(g) {
  if(g.phase!=='playing')return;
  const level=levelAt(g.levelIndex),limit=level.length-FINISH_RUNWAY,visibleTo=g.distance+VIEW_DISTANCE+45;
  while (g.nextRow < visibleTo && g.nextRow < limit) {
    let d=g.nextRow;
    const row=g.row,maxRushSpeed=level.maxSpeed*1.32;
    // Preview only bounded generator state. A future earned Rush must not
    // compress two rewarded jumps into one still-running jump animation.
    // Plan the new station at its final distance before emitting any entities;
    // sections, chain counters and seeded motifs therefore remain coherent.
    const planAt=distance=>{
      const plan={...g,motifDeck:[...g.motifDeck],episode:g.episode?{...g.episode}:null,terrainBeat:g.terrainBeat?{...g.terrainBeat}:null,encounters:{...g.encounters}};
      return{plan,pattern:rowPattern(plan,row,distance)};
    };
    let planned=planAt(d);
    if(planned.pattern.hazards.some(h=>h.type==='log'&&h.lane===planned.pattern.coinLane)&&Number.isFinite(g.lastJumpRewardD)&&d-g.lastJumpRewardD<maxRushSpeed*.90){
      d=g.lastJumpRewardD+maxRushSpeed*.90;
      if(d>=limit){g.nextRow=limit;break;}
      planned=planAt(d);
    }
    for(const key of ['rng','routeLane','rewardLane','routeDirection','episode','episodeIndex','motifDeck','terrainBeat','encounters','rowsSinceRequired','requiredJump','requiredDuck','lastRequiredType','requiredTypeRun','lastFormation','formationRun'])g[key]=planned.plan[key];
    g.row++;g.nextRow=d;
    const predictedTime = g.time + timeToImpact(g,d);
    const {motif,safe,hazards:plannedHazards,coinLane,act,episode,beat,recovery,intensity,terrain,activeTerrain}=planned.pattern;
    const hazards=motif==='tutorial'?spanBranches(plannedHazards,safe,coinLane,g.seed,row):plannedHazards;
    if(!g.patternsSeen.includes(motif))g.patternsSeen.push(motif);
    const section={sectionId:terrain.id,sectionType:terrain.type,sectionPhase:terrain.phase,terrainActive:!!activeTerrain,terrainComboAvailable:terrain.comboAvailable};
    for(const h of hazards.filter(isBranchSpan))g.branchWidthsSeen|=1<<branchLanes(h).length;
    hazards.forEach(h => add(g, h.type, h.lane, d, { row, motif,act,episode,beat,recovery,...section,...(h.branchLanes?{branchLanes:h.branchLanes,...(h.branchSide?{branchSide:h.branchSide}:{}),...(h.fullRiver?{fullRiver:true,canopyLead:h.canopyLead}:{})}:{}),...(h.enemy?{enemy:h.enemy,motion:encounterMotion(h.lane,d,maxRushSpeed,h.enemy,g.seed^row,g.levelIndex)}:{}) }));
    // Every spacing stays above the existing per-map safety floor, with
    // seeded variation and longer pauses after brief challenge bursts.
    const interval=row<3?1.05-Math.min(1,predictedTime/95)*.19:Math.max(level.minInterval,level.rowInterval+.16*(1-intensity)-.1*intensity+(random(g)-.5)*.22)+(recovery ? .30+.20*intensity : 0);
    const rewardHazard=hazards.find(h=>hazardTouchesLane(h,coinLane));
    const at=relative=>g.distance+forecastTravel(g,predictedTime-g.time+relative);
    if(rewardHazard?.type==='log'){
      g.lastJumpRewardD=d;
      for(const offset of JUMP_REWARD_OFFSETS)add(g,'coin',coinLane,at(offset),{high:true,jumpHeight:jumpArcHeight(JUMP_REWARD_LEAD+offset),jumpOffset:offset,row,motif,coinPattern:'jump-arc',primaryRoute:true,...section});
      // Keep the shown route entirely airborne. Approach/landing ground
      // coins cannot remain fair if a newly triggered Rush compresses it.
      // They also leave too little time to change lane into the next ribbon.
    }else{
      const clearLanes=hazards.every(h=>h.fullRiver)?LANES:LANES.filter(lane=>!hazards.some(h=>hazardTouchesLane(h,lane)));
      const layout=groundCoinLayout({seed:g.seed,row,lane:coinLane,clearLanes,unvisitedLanes:LANES.filter(lane=>!(g.coinLanesSeen&(1<<lane))),index:g.coinPatternIndex,recovery,allowCarve:!Number.isFinite(g.lastJumpRewardD)||d-g.lastJumpRewardD>=maxRushSpeed*.75});
      if(layout.advance)g.coinPatternIndex++;
      if(!g.coinPatternsSeen.includes(layout.pattern))g.coinPatternsSeen.push(layout.pattern);
      for(const coin of layout.coins)add(g,'coin',coin.lane,d+maxRushSpeed*coin.offset,{row,motif,coinPattern:layout.pattern,primaryRoute:coin.primaryRoute,...section});
      g.rewardLane=layout.endLane;
    }
    // A relic is an optional clear-water choice at an existing recovery beat,
    // rather than a squeeze between a jump's airborne gold and the next wall.
    const encounter=g.encounters;
    if(recovery&&plannedHazards.length===1&&!plannedHazards[0].enemy&&rewardHazard?.type!=='log'&&encounter.enemyIndex>0&&row>=encounter.nextTargetRow&&row-encounter.lastRow>=3){
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
    g.nextRow += speedAt(predictedTime,g.levelIndex) * interval;
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
function collide(g, obstacle, contact, protectedAtCrossing) {
  g.terrainCombo.count=0;
  if (protectedAtCrossing) { obstacle.destroyed = true; emit(g, 'smash', '', contact.playerLane, contact); return 'protected'; }
  if (g.shield) {
    obstacle.destroyed = true;
    g.shield = false; g.shieldsUsed++;
    g.streak = 0; g.multiplier = 1;
    emit(g, 'hit', 'Shield saved you! Next hit ends the run', contact.playerLane, contact); return 'shield';
  }
  g.phase = 'lost';
  g.reason = obstacle.enemy==='crocodile'?'Crocodile hit. Jump over it or switch lanes.':obstacle.enemy==='bird'?'Bird hit. Duck under it or switch lanes.':obstacle.enemy==='fish'?'Leaping fish hit. Jump over it or switch lanes.':obstacle.type === 'rock' ? 'Rock hit. Switch lanes to dodge boulders.' : obstacle.type === 'log' ? 'Log hit. Jump as it reaches your raft.' : 'Branch hit. Duck as it reaches your raft.';
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
  let boostUntil=frame.magnet;
  let graceUntil=frame.grace;
  const clearedRows=new Set(),canopyContacts=new Set(),passedCanopies=new Set();
  const waveRows=new Map(crossed.filter(e=>e.type==='log'&&e.terrainActive&&e.sectionType==='wave-train').map(e=>[Number.isInteger(e.row)?`row:${e.row}`:`entity:${e.id}`,e.sectionId]));
  let fatalContact=null,lastContactCoinTime=null;
  let coinGoalDuringRush=false;
  for (const e of crossed) {
    e.done = true;
    // Sample the same analytic trajectory for coins and powers at their exact
    // crossing. Powers cannot activate while the visible raft is still beside
    // them, including when steering is reversed or a frame spans several items.
    const travelled=e.d-previous;
    const elapsed=clamp(travelled<=boostedDistance?travelled/(frameBaseSpeed*1.32):boostedSeconds+(travelled-boostedDistance)/frameBaseSpeed,0,dt);
    const steeringAtCrossing=laneSpring(frame.position,frame.velocity,frame.target,elapsed);
    const lane=steeringAtCrossing.position;
    const obstacleLane=entityLane(e,e.d);
    const overlap=Math.abs(obstacleLane-lane)<=COIN_LANE_RADIUS;
    if (e.type === 'coin') {
      const action=crossingAction(frame,elapsed);
      const boosted=boostUntil>elapsed;
      if (overlap&&coinTouchesAtHeight(e,action.action,action.time)) {
        e.collected=true;
        g.coins++; g.streak++; g.lastCoin = g.time;lastContactCoinTime=frame.time+elapsed;
        if(g.goal.kind==='coins'&&g.coins-g.goal.start>=g.goal.target&&frame.rush>elapsed)coinGoalDuringRush=true;
        g.multiplier = Math.min(5, 1 + Math.floor(g.streak / 8));
        const value=10*g.multiplier*(boosted?2:1);
        g.bonus += value; if (frame.rush<=elapsed) g.charge = Math.min(100, g.charge + 2);
        emit(g, 'coin', g.streak % 8 === 0 ? `COIN STREAK ×${g.multiplier}` : '', e.lane, { entityId:e.id,high: !!e.high,jumpHeight:coinJumpHeight(e),coinPattern:e.coinPattern??null,primaryRoute:e.primaryRoute!==false, distance:e.d, playerLane:lane, playerHeight:jumpHeightAt(action.action,action.time),attracted:false,boosted,value,streak:g.streak,multiplier:g.multiplier,contactTime:frame.time+elapsed });
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
      if (overlap) {
        e.collected=true;
        if (e.type === 'magnet') boostUntil=elapsed+8; else g.shield = true;
        emit(g, 'power', e.type === 'magnet' ? 'GOLD BOOST ×2! Touch coins for double points' : 'SHIELD! One free hit', e.lane, {power:e.type,distance:e.d,playerLane:lane,contactTime:frame.time+elapsed});
      }
    } else {
      if(!e.fullRiver||!passedCanopies.has(e.row))g.rowsPassed++;
      if(e.fullRiver)passedCanopies.add(e.row);
      const rushAtCrossing=frame.rush>elapsed;
      if (hazardTouchesLane(e,lane)) {
        if(e.fullRiver&&canopyContacts.has(e.row))continue;
        if(e.fullRiver)canopyContacts.add(e.row);
        const action=crossingAction(frame,elapsed);
        const contact={entityId:e.id,obstacle:e.type,enemy:e.enemy??null,obstacleLane,...(isBranchSpan(e)?{branchLanes:branchLanes(e),spanWidth:branchSpan(e).width}:{}),distance:e.d,playerLane:lane,playerHeight:jumpHeightAt(action.action,action.time),action:action.action,actionTime:action.time,contactTime:frame.time+elapsed};
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
  if (g.phase === 'playing') generateAhead(g);
}
export function snapshot(g) {
  const level=levelAt(g.levelIndex);
  const terrain=terrainSection(g.distance,g.terrainProfile),sameCombo=g.terrainCombo.section===terrain.id;
  const next = g.entities.find(e => !e.done && hazardTouchesLane(e,g.lane) && ['rock', 'log', 'branch'].includes(e.type));
  return { phase: g.phase,laneCount:LANE_COUNT,coinPatterns:[...g.coinPatternsSeen], time: g.time, distance: Math.floor(g.distance), lane: g.lane, visualLane: g.visualLane, actionTime: g.actionTime,
    action: g.action, coins: g.coins, score: g.score, streak: g.streak, multiplier: g.multiplier,
    charge: g.charge, rush: g.rush, magnet: g.magnet, shield: g.shield, speed: g.speed, streakTime: g.streak ? Math.max(0, 2.8 - (g.time - g.lastCoin)) : 0,
    jumps: g.jumps, ducks: g.ducks, dodges: g.dodges, reason: g.reason,
    level:{index:level.index,id:level.id,name:level.name,length:level.length,remaining:Math.max(0,Math.ceil(level.length-g.distance)),progress:clamp(g.distance/level.length,0,1),final:level.index===LEVELS.length-1,difficulty:level.difficulty},
    campaign:campaignTotals(g),
    terrain:{...terrain,comboProgress:terrain.comboAvailable&&sameCombo?g.terrainCombo.count:0,comboClaimed:terrain.comboAvailable&&sameCombo&&g.terrainCombo.claimed},
    goalsCleared: g.goalsCleared, goal: { ...g.goal, progress: Math.min(g.goal.target, Math.floor((g.goal.kind === 'tricks' ? g.jumps + g.ducks : g.goal.kind === 'coins' ? g.coins : g.distance) - g.goal.start)) },
    notice: g.time < g.noticeUntil ? g.notice : '',
    hint: next && next.d - g.distance < g.speed*(next.enemy?1.6:1.1) ? { id: next.id, type: next.type, enemy:next.enemy??null,fullRiver:!!next.fullRiver, lane:isBranchSpan(next)?branchSpan(next).centerLane:entityLane(next,g.distance),destinationLane:isBranchSpan(next)?branchSpan(next).centerLane:entityLane(next,next.d),...(isBranchSpan(next)?{spanLanes:branchLanes(next),spanWidth:branchSpan(next).width}:{}),in: timeToImpact(g,next.d), safeLane: LANES.find(lane => !g.entities.some(e => e.row === next.row && hazardTouchesLane(e,lane) && ['rock','log','branch'].includes(e.type))) } : null };
}
export function validBest(value) {
  return value?.version===3&&Number.isSafeInteger(value.score)&&value.score>0
    &&Number.isSafeInteger(value.distance)&&value.distance>=0
    &&Number.isSafeInteger(value.coins)&&value.coins>=0
    &&Number.isInteger(value.levelsCleared)&&value.levelsCleared>=0&&value.levelsCleared<=LEVELS.length?value:null;
}
