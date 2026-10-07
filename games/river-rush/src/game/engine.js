// Distance-based three-lane runner. Presentation never decides collisions.
import { laneSpring } from './world.js';
import { LEVELS, FINISH_RUNWAY, levelAt, levelSeed, levelSpeed } from './levels.js';
import { courseAct, courseIntensity } from './course-intensity.js';
export const JUMP_SECONDS = .66;
export const DUCK_SECONDS = .60;
export const VIEW_DISTANCE = 180;
export const BASE_SPEED = LEVELS[0].startSpeed, MAX_SPEED = Math.max(...LEVELS.map(level=>level.maxSpeed)), ACCELERATION = LEVELS[0].acceleration;
// Every pickup needs actual raft-center contact within the same 0.95 m
// tolerance on 3.8 m lanes. Target-lane input is not visible overlap.
export const COIN_LANE_RADIUS = .25;
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
    lane: 1, visualLane: 1, laneVelocity: 0, speed: level.startSpeed, action: '', actionTime: 0, buffered: '', bufferTime: 0,
    coins: 0, score: 0, bonus: 0, streak: 0, multiplier: 1, lastCoin: -10,
    charge: 0, rush: 0, magnet: 0, shield: true, grace: 0,
    jumps: 0, ducks: 0, dodges: 0, shieldsUsed: 0, rowsPassed: 0,
    goalsCleared: 0, goal: { kind: 'tricks', start: 0, target: 3 },
    entities: [], nextRow: level.startSpeed*(68/42), row: 0, nextId: 1, patternsSeen:[], runwayGenerated:false,
    motifDeck:[], episode:null, episodeIndex:0, routeLane:1, routeDirection:mapSeed&1?1:-1,
    event: '', eventId: 0, effects: [], notice: level.index===0?'Jump logs · Duck branches · Dodge rocks':`${level.name} · ${level.difficulty}`, noticeUntil: 4, reason: '' };
  for (let d = 7; d <= 32; d += 5) add(g, 'coin', 1, d);
  generateAhead(g); return g;
}
export function restartLevel(g){return createGame(g.campaignSeed,g.levelIndex,g.carry);}
export function nextLevel(g){return g.phase==='won'&&g.levelIndex<LEVELS.length-1?createGame(g.campaignSeed,g.levelIndex+1,campaignTotals(g)):null;}
function random(g) { g.rng = (Math.imul(g.rng, 1664525) + 1013904223) >>> 0; return g.rng / 4294967296; }
function add(g, type, lane, d, extra = {}) { g.entities.push({ id: g.nextId++, type, lane, d, done: false, ...extra }); }
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
  return{index:g.episodeIndex++,motif:g.motifDeck.pop(),act,length:5+Math.floor(random(g)*5),step:0};
}
function rowPattern(g,row,d){
  const level=levelAt(g.levelIndex),act=courseAct(d,level.length),intensity=courseIntensity(d,level.length,g.levelIndex);
  if(g.levelIndex===0&&row<3){
    g.routeLane=row<2?1:2;
    return{motif:'tutorial',safe:row<2?0:2,hazards:[{lane:1,type:['log','branch','rock'][row]}],coinLane:row<2?1:2,act,episode:-1,beat:row,recovery:false,intensity};
  }
  // Seeded episodes have different lengths and change at geographic act boundaries,
  // rather than repeating a visible four-row route. A shuffled deck keeps variety.
  if(!g.episode||g.episode.step>=g.episode.length||g.episode.act!==act)g.episode=nextEpisode(g,act);
  const episode=g.episode,step=episode.step++,motif=episode.motif,recovery=step===episode.length-1;
  const move=motif==='slalom'||motif==='coin-zigzag'||random(g)<.65;
  if(!recovery&&move){
    if(g.routeLane===0)g.routeDirection=1;else if(g.routeLane===2)g.routeDirection=-1;
    else if(motif==='mixed-hazards'||motif==='split-current')g.routeDirection=random(g)<.5?-1:1;
    g.routeLane+=g.routeDirection;
  }
  const safe=g.routeLane,occupied=[0,1,2].filter(lane=>lane!==safe);
  if(random(g)<.5)occupied.reverse();
  let types=['rock','rock'];
  if(motif==='coin-zigzag')types=['log','branch'];
  else if(motif==='mixed-hazards')types=random(g)<.5?['branch','log']:['log','branch'];
  else if(motif==='jump-waves')types=['rock','log'];
  else if(motif==='low-canopy')types=['branch','rock'];
  else if(motif==='split-current')types=random(g)<.5?['branch','log']:['rock','branch'];
  // Full-width waves always share one action; other formations leave a clear
  // adjacent-lane route. Opening waves stay light and episode ends breathe.
  const wave=(motif==='jump-waves'||motif==='low-canopy')&&act>0&&step>0&&!recovery&&random(g)<.12+.46*intensity;
  const pair=!recovery&&random(g)<.28+.54*intensity+g.levelIndex*.05;
  const hazards=wave?[0,1,2].map(lane=>({lane,type:motif==='jump-waves'?'log':'branch'})):occupied.slice(0,pair?2:1).map((lane,i)=>({lane,type:types[(i+step)%types.length]}));
  return{motif,safe,hazards,coinLane:safe,act,episode:episode.index,beat:step,recovery,intensity};
}
export function generateAhead(g) {
  if(g.phase!=='playing')return;
  const level=levelAt(g.levelIndex),limit=level.length-FINISH_RUNWAY,visibleTo=g.distance+VIEW_DISTANCE+45;
  while (g.nextRow < visibleTo && g.nextRow < limit) {
    const d = g.nextRow, row = g.row++;
    const predictedTime = g.time + timeToImpact(g,d);
    const {motif,safe,hazards,coinLane,act,episode,beat,recovery,intensity}=rowPattern(g,row,d);
    if(!g.patternsSeen.includes(motif))g.patternsSeen.push(motif);
    hazards.forEach(h => add(g, h.type, h.lane, d, { row, motif,act,episode,beat,recovery }));
    for (let offset = -17; offset <= -2; offset += 5) add(g, 'coin', coinLane, d + offset);
    const actionHazard = hazards.find(h => h.type !== 'rock');
    if (actionHazard) {
      // Gold over logs is collected only while airborne. Duck routes pay on clearing.
      add(g, 'coin', actionHazard.lane, d, { high: actionHazard.type === 'log' });
      add(g, 'coin', actionHazard.lane, d + 5);
    }
    if (row % 13 === 6) add(g, 'magnet', safe, d - 8);
    if (row % 17 === 11) add(g, 'shield', safe, d - 8);
    // Preserve the introductory jump/duck/rock reaction time at faster speeds.
    const interval=g.levelIndex===0&&row<3?1.05-Math.min(1,predictedTime/95)*.19:Math.max(level.minInterval,level.rowInterval+.16*(1-intensity)-.1*intensity)+(recovery ? .30+.20*intensity : 0);
    g.nextRow += speedAt(predictedTime,g.levelIndex) * interval;
  }
  if(!g.runwayGenerated&&visibleTo>limit){
    g.runwayGenerated=true;
    for(let d=level.length-130;d<=level.length-15;d+=5)add(g,'coin',1,d,{motif:'finish-runway'});
  }
  g.entities.sort((a, b) => a.d - b.d || a.id - b.id);
}
export function jumpHeight(g) {
  return jumpHeightAt(g.action,g.actionTime);
}
function jumpHeightAt(action,time){const p=clamp(time/JUMP_SECONDS,0,1);return action==='jump'?4*p*(1-p):0;}
// Reward a timely tap on the launch frame, before the arc reaches full height.
function jumpClears(g){return jumpClearsAt(g.action,g.actionTime);}
function jumpClearsAt(action,time){return action==='jump'&&time<JUMP_SECONDS&&(time<=.06||jumpHeightAt(action,time)>COIN_GROUND_MAX_JUMP_HEIGHT);}
export function coinHeightTouches(high,action,time){return high?jumpClearsAt(action,time):jumpHeightAt(action,time)<=COIN_GROUND_MAX_JUMP_HEIGHT;}
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
    const lane = clamp(g.lane + (action === 'left' ? -1 : 1), 0, 2);
    if (lane !== g.lane) { g.lane = lane; emit(g, 'swap'); }
  } else if (action === 'jump' || action === 'duck') {
    if (g.action === action) { g.buffered = action; g.bufferTime = .2; }
    else beginAction(g, action); // Down cancels jump; up cancels duck, immediately.
  } else if (action === 'rush' && g.charge >= 100 && !g.rush) {
    g.charge = 0; g.rush = 4; emit(g, 'rush', 'RUSH! Smash through everything');
  }
}
function collide(g, obstacle) {
  if (g.rush > 0 || g.grace > 0) { emit(g, 'smash', '', g.lane, { obstacle: obstacle.type }); return; }
  if (g.shield) {
    g.shield = false; g.shieldsUsed++; g.grace = 1.1;
    g.streak = 0; g.multiplier = 1;
    emit(g, 'hit', 'Shield saved you! Next hit ends the run'); return;
  }
  g.phase = 'lost';
  g.reason = obstacle.type === 'rock' ? 'Rock hit. Switch lanes to dodge boulders.' : obstacle.type === 'log' ? 'Log hit. Jump as it reaches your raft.' : 'Branch hit. Duck as it reaches your raft.';
  emit(g, 'lose', 'WIPEOUT');
}
export function updateGame(g, input, dt) {
  if (g.phase !== 'playing') return;
  dt = clamp(dt, 0, .05);
  const taps = input.actions.splice(0);
  taps.forEach(action => applyAction(g, action));
  const frame={position:g.visualLane,velocity:g.laneVelocity,target:g.lane,action:g.action,actionTime:g.actionTime,buffered:g.buffered,bufferTime:g.bufferTime,magnet:g.magnet,rush:g.rush};
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
  g.grace = Math.max(0, g.grace - dt);
  g.speed = speedAt(g.time,g.levelIndex) * (g.rush > 0 ? 1.32 : 1);
  g.rush = Math.max(0, g.rush - dt);
  const steering=laneSpring(g.visualLane,g.laneVelocity,g.lane,dt);
  g.visualLane=steering.position;g.laneVelocity=steering.velocity;
  const previous = g.distance;
  const level=levelAt(g.levelIndex);
  g.distance = Math.min(level.length,g.distance+g.speed*dt);
  if (g.time - g.lastCoin > 2.8) { g.streak = 0; g.multiplier = 1; }
  // Generated courses are ordered, but processing the crossed subset in
  // physical order also guarantees a coin boost cannot enhance an earlier coin.
  const crossed=g.entities.filter(e=>!e.done&&e.d<=g.distance&&e.d>previous).sort((a,b)=>a.d-b.d||a.id-b.id);
  let boostUntil=frame.magnet;
  let coinGoalDuringRush=false;
  for (const e of crossed) {
    e.done = true;
    // Sample the same analytic trajectory for coins and powers at their exact
    // crossing. Powers cannot activate while the visible raft is still beside
    // them, including when steering is reversed or a frame spans several items.
    const elapsed=clamp((e.d-previous)/g.speed,0,dt);
    const lane=laneSpring(frame.position,frame.velocity,frame.target,elapsed).position;
    const overlap=Math.abs(e.lane-lane)<=COIN_LANE_RADIUS;
    if (e.type === 'coin') {
      const action=crossingAction(frame,elapsed);
      const boosted=boostUntil>elapsed;
      if (overlap&&coinHeightTouches(!!e.high,action.action,action.time)) {
        e.collected=true;
        g.coins++; g.streak++; g.lastCoin = g.time;
        if(g.goal.kind==='coins'&&g.coins-g.goal.start>=g.goal.target&&frame.rush>elapsed)coinGoalDuringRush=true;
        g.multiplier = Math.min(5, 1 + Math.floor(g.streak / 8));
        const value=10*g.multiplier*(boosted?2:1);
        g.bonus += value; if (frame.rush<=elapsed) g.charge = Math.min(100, g.charge + 2);
        emit(g, 'coin', g.streak % 8 === 0 ? `COIN STREAK ×${g.multiplier}` : '', e.lane, { entityId:e.id,high: !!e.high, distance:e.d, playerLane:lane, playerHeight:jumpHeightAt(action.action,action.time),attracted:false,boosted,value,contactTime:g.time-dt+elapsed });
      }
    } else if (e.type === 'magnet' || e.type === 'shield') {
      if (overlap) {
        e.collected=true;
        if (e.type === 'magnet') boostUntil=elapsed+8; else g.shield = true;
        emit(g, 'power', e.type === 'magnet' ? 'GOLD BOOST ×2! Touch coins for double points' : 'SHIELD! One free hit', e.lane, {power:e.type,distance:e.d,playerLane:lane});
      }
    } else {
      g.rowsPassed++;
      if (e.lane === g.lane) {
        const cleared = (e.type === 'log' && jumpClears(g)) || (e.type === 'branch' && g.action === 'duck');
        if (cleared && !g.rush) {
          const type = e.type === 'log' ? 'jump' : 'duck';
          g[type === 'jump' ? 'jumps' : 'ducks']++;
          g.bonus += 100 * g.multiplier; g.charge = Math.min(100, g.charge + 12);
          emit(g, 'perfect', `PERFECT ${type.toUpperCase()} +${100 * g.multiplier}`);
        } else collide(g, e);
      } else { g.dodges++; if (!g.rush) g.charge = Math.min(100, g.charge + 2); }
    }
    if (g.phase !== 'playing') break;
  }
  g.magnet=Math.max(0,boostUntil-dt);
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
  const next = g.entities.find(e => !e.done && e.lane === g.lane && ['rock', 'log', 'branch'].includes(e.type));
  return { phase: g.phase, time: g.time, distance: Math.floor(g.distance), lane: g.lane, visualLane: g.visualLane, actionTime: g.actionTime,
    action: g.action, coins: g.coins, score: g.score, streak: g.streak, multiplier: g.multiplier,
    charge: g.charge, rush: g.rush, magnet: g.magnet, shield: g.shield, speed: g.speed, streakTime: g.streak ? Math.max(0, 2.8 - (g.time - g.lastCoin)) : 0,
    jumps: g.jumps, ducks: g.ducks, dodges: g.dodges, reason: g.reason,
    level:{index:level.index,id:level.id,name:level.name,length:level.length,remaining:Math.max(0,Math.ceil(level.length-g.distance)),progress:clamp(g.distance/level.length,0,1),final:level.index===LEVELS.length-1,difficulty:level.difficulty},
    campaign:campaignTotals(g),
    goalsCleared: g.goalsCleared, goal: { ...g.goal, progress: Math.min(g.goal.target, Math.floor((g.goal.kind === 'tricks' ? g.jumps + g.ducks : g.goal.kind === 'coins' ? g.coins : g.distance) - g.goal.start)) },
    notice: g.time < g.noticeUntil ? g.notice : '',
    hint: next && next.d - g.distance < g.speed*1.1 ? { id: next.id, type: next.type, in: timeToImpact(g,next.d), safeLane: [0,1,2].find(lane => !g.entities.some(e => e.row === next.row && e.lane === lane && ['rock','log','branch'].includes(e.type))) } : null };
}
export function validBest(value) {
  return value?.version===3&&Number.isSafeInteger(value.score)&&value.score>0
    &&Number.isSafeInteger(value.distance)&&value.distance>=0
    &&Number.isSafeInteger(value.coins)&&value.coins>=0
    &&Number.isInteger(value.levelsCleared)&&value.levelsCleared>=0&&value.levelsCleared<=LEVELS.length?value:null;
}
