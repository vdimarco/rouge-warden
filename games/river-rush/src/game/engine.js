// Distance-based three-lane runner. Presentation never decides collisions.
import { laneSpring } from './world.js';
import { LEVELS, FINISH_RUNWAY, levelAt, levelSeed, levelSpeed } from './levels.js';
export const JUMP_SECONDS = .66;
export const DUCK_SECONDS = .60;
export const VIEW_DISTANCE = 180;
export const BASE_SPEED = LEVELS[0].startSpeed, MAX_SPEED = Math.max(...LEVELS.map(level=>level.maxSpeed)), ACCELERATION = LEVELS[0].acceleration;
// A pickup needs the raft's center to cross the coin, within roughly its
// 0.95 m half-width on 3.8 m lanes. Target-lane input is not visible overlap.
export const COIN_LANE_RADIUS = .25;
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
function rowPattern(g,row){
  if(g.levelIndex===0&&row<3)return{motif:'tutorial',safe:row<2?0:2,hazards:[{lane:1,type:['log','branch','rock'][row]}],coinLane:row<2?1:2};
  const n=row-(g.levelIndex===0?3:0),block=Math.floor(n/4),step=n%4;
  const motif=motifs[(block+g.campaignSeed%motifs.length+g.levelIndex*2)%motifs.length];
  const forward=(g.seed&1)?1:-1,route=[0,1,2,1];
  let safe=route[step],types=['rock','rock'];
  if(motif==='coin-zigzag'){safe=g.levelIndex===0?route[(step+1)%4]:(step%2?2:0);types=['log','branch'];}
  else if(motif==='mixed-hazards'){safe=(block+step)%3;types=step%2?['branch','log']:['log','branch'];}
  else if(motif==='jump-waves'){safe=route[(step+block)%4];types=['rock','log'];if(step%2===0)return{motif,safe,hazards:[0,1,2].map(lane=>({lane,type:'log'})),coinLane:safe};}
  else if(motif==='low-canopy'){safe=route[(step+block)%4];types=['branch','rock'];if(step%2===0)return{motif,safe,hazards:[0,1,2].map(lane=>({lane,type:'branch'})),coinLane:safe};}
  else if(motif==='split-current'){safe=(step+block)%3;types=step%2?['branch','log']:['rock','branch'];}
  if(forward<0)safe=2-safe;
  const occupied=[0,1,2].filter(lane=>lane!==safe);
  // Every ordinary row offers a clear lane; later maps put pressure on both alternatives.
  const pair=g.levelIndex>0||motif==='slalom'||random(g)<.55;
  const hazards=occupied.slice(0,pair?2:1).map((lane,i)=>({lane,type:types[(i+step)%types.length]}));
  return{motif,safe,hazards,coinLane:safe};
}
export function generateAhead(g) {
  if(g.phase!=='playing')return;
  const level=levelAt(g.levelIndex),limit=level.length-FINISH_RUNWAY,visibleTo=g.distance+VIEW_DISTANCE+45;
  while (g.nextRow < visibleTo && g.nextRow < limit) {
    const d = g.nextRow, row = g.row++;
    const predictedTime = g.time + timeToImpact(g,d);
    const {motif,safe,hazards,coinLane}=rowPattern(g,row);
    if(!g.patternsSeen.includes(motif))g.patternsSeen.push(motif);
    hazards.forEach(h => add(g, h.type, h.lane, d, { row, motif }));
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
    const interval=g.levelIndex===0&&row<3?1.05-Math.min(1,predictedTime/95)*.19:Math.max(level.minInterval,level.rowInterval-predictedTime/180*.09);
    g.nextRow += speedAt(predictedTime,g.levelIndex) * interval;
  }
  if(!g.runwayGenerated&&visibleTo>limit){
    g.runwayGenerated=true;
    for(let d=level.length-70;d<=level.length-15;d+=5)add(g,'coin',1,d,{motif:'finish-runway'});
  }
  g.entities.sort((a, b) => a.d - b.d || a.id - b.id);
}
export function jumpHeight(g) {
  return g.action === 'jump' ? 4 * clamp(g.actionTime / JUMP_SECONDS, 0, 1) * (1 - clamp(g.actionTime / JUMP_SECONDS, 0, 1)) : 0;
}
// Reward a timely tap on the launch frame, before the arc reaches full height.
function jumpClears(g){return jumpClearsAt(g.action,g.actionTime);}
function jumpClearsAt(action,time){const p=clamp(time/JUMP_SECONDS,0,1);return action==='jump'&&time<JUMP_SECONDS&&(time<=.06||4*p*(1-p)>.28);}
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
  g.magnet = Math.max(0, g.magnet - dt); g.grace = Math.max(0, g.grace - dt);
  g.speed = speedAt(g.time,g.levelIndex) * (g.rush > 0 ? 1.32 : 1);
  g.rush = Math.max(0, g.rush - dt);
  const steering=laneSpring(g.visualLane,g.laneVelocity,g.lane,dt);
  g.visualLane=steering.position;g.laneVelocity=steering.velocity;
  const previous = g.distance;
  const level=levelAt(g.levelIndex);
  g.distance = Math.min(level.length,g.distance+g.speed*dt);
  if (g.time - g.lastCoin > 2.8) { g.streak = 0; g.multiplier = 1; }
  for (const e of g.entities) {
    if (e.done || e.d > g.distance || e.d <= previous) continue;
    e.done = true;
    if (e.type === 'coin') {
      // Sample at the exact longitudinal crossing, rather than the end of the
      // render frame. This also handles reversals and crossing a lane that is
      // no longer selected, without skipping narrow pickups at low frame rates.
      const elapsed=clamp((e.d-previous)/g.speed,0,dt);
      const lane=laneSpring(frame.position,frame.velocity,frame.target,elapsed).position;
      const action=crossingAction(frame,elapsed),overlap=Math.abs(e.lane-lane)<=COIN_LANE_RADIUS;
      const attracted=frame.magnet>elapsed||frame.rush>elapsed||g.magnet>0;
      if ((overlap&&(!e.high||jumpClearsAt(action.action,action.time)))||attracted) {
        e.collected=true;
        g.coins++; g.streak++; g.lastCoin = g.time;
        g.multiplier = Math.min(5, 1 + Math.floor(g.streak / 8));
        g.bonus += 10 * g.multiplier; if (frame.rush<=elapsed) g.charge = Math.min(100, g.charge + 2);
        emit(g, 'coin', g.streak % 8 === 0 ? `COIN STREAK ×${g.multiplier}` : '', e.lane, { high: !!e.high, distance:e.d, playerLane:lane, attracted: attracted&&(!overlap||e.high&&!jumpClearsAt(action.action,action.time)) });
      }
    } else if (e.type === 'magnet' || e.type === 'shield') {
      if (e.lane === g.lane) {
        if (e.type === 'magnet') g.magnet = 8; else g.shield = true;
        emit(g, 'power', e.type === 'magnet' ? 'MAGNET! All lanes pay' : 'SHIELD! One free hit');
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
  if (g.phase === 'playing') {
    const totals = { tricks: g.jumps + g.ducks, coins: g.coins, distance: g.distance };
    if (totals[g.goal.kind] - g.goal.start >= g.goal.target) {
      g.goalsCleared++; g.bonus += 500;
      if (!g.rush) g.charge = Math.min(100, g.charge + 20);
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
