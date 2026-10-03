// A Node version of the reviewer's off-screen check (neon-offscreen.mjs). A phone in portrait, touch mode,
// with the real 3D district and duel rules. The GPU renderer is a stand-in, so game time runs as fast as Node.
// "On screen" uses the reviewer's test: the attacker's chest is in front of the camera and inside the frame.
import {test} from 'node:test';import assert from 'node:assert/strict';
import {loadDistrict} from './node-district.mjs';
import {Duel,seededRandom,PARRY_WINDOW} from '../../public/neon/duel.js';
const District=await loadDistrict();
const district=new District();

// Plays one round the way game.js does: the world moves, the target is chosen, the touch lock-on turns
// the view, and the duel runs with the same attack and defense rules. A bot may guard, dodge and cut.
function play({round=1,seed=1,seconds=60,dt=1/30,bot=null}){
  const d=district;d.setStyle('rick-morty');d.reset();
  const duel=new Duel(round,seededRandom(seed));d.beginEncounter(duel.fighters);
  const s={windups:0,windOn:0,lands:0,landOn:0,hits:0,health:100,t:0,deathAt:null,clearAt:null,guard:false,guardAt:-10};
  let enemy=duel.fighters[0];
  for(;s.t<seconds;s.t+=dt){
    d.update(dt,true,enemy,false);
    enemy=d.chooseFighter(duel.active)||enemy;
    bot?.(d,duel,enemy,s);
    d.assist(duel.active,enemy,dt);
    duel.update(dt,{canAttack:f=>d.canEngage(f),defense:f=>({inRange:d.fighterDistance(f)<3.5,dashing:d.dash>0,blocked:s.guard,perfect:s.guard&&s.t-s.guardAt<PARRY_WINDOW.touch}),event:(kind,f)=>{
      if(kind==='windup'){s.windups++;if(d.inView(f,0))s.windOn++;return}
      s.lands++;if(d.inView(f,0))s.landOn++;s.guard=false;
      if(kind==='damage'){s.hits++;s.health-=f.boss?18:12}
    }});
    if(s.health<=0){s.deathAt=s.t;break}
    if(duel.finished){s.clearAt=s.t;break}
  }
  return s;
}
// A player who knows the duel: guard as the blade falls, dodge sweeps at the last moment, cut when the guard opens.
function expert(d,duel,enemy,s){
  const a=duel.active;
  if(a?.phase==='windup'){if(a.attack==='sweep'){if(a.timer<.12&&d.dash<=0)d.requestDash(1,0)}else if(a.timer<.35&&!s.guard){s.guard=true;s.guardAt=s.t}}
  // Cut an open guard, as game.js does, unless another blade is about to fall.
  const victim=d.strikeTarget(enemy);
  if(victim.phase==='open'&&!(a?.timer<.5)&&(s.cut??0)<=s.t){d.selectFighter(victim);d.lunge();if(d.canStrike()){duel.swing(victim,0,2);s.cut=s.t+.32}}
}

test('a passive touch player sees every windup start, and nearly every blow land',()=>{
  const total={windups:0,windOn:0,lands:0,landOn:0};
  for(const round of [1,3,5,9])for(const seed of [1,2,3]){const s=play({round,seed,seconds:45});for(const k in total)total[k]+=s[k]}
  assert.ok(total.windups>=60,`only ${total.windups} windups`);
  const start=total.windOn/total.windups,land=total.landOn/total.lands;
  console.log(`windups on screen at start ${(start*100).toFixed(0)}% (${total.windOn}/${total.windups}), at impact ${(land*100).toFixed(0)}% (${total.landOn}/${total.lands})`);
  assert.ok(start>=.9,`windups on screen at start: ${(start*100).toFixed(0)}%`);
  assert.ok(land>=.9,`blows on screen at impact: ${(land*100).toFixed(0)}%`);
});

test('a player who parries and dodges clears round 1 quickly and is never hit',()=>{
  for(const seed of [1,2,3]){const s=play({round:1,seed,seconds:40,bot:expert});
    console.log(`seed ${seed}: round 1 clear in ${s.clearAt?.toFixed(1)} s, hits taken ${s.hits}`);
    assert.ok(s.clearAt!==null&&s.clearAt<25,`seed ${seed}: no clear in time`);assert.equal(s.hits,0)}
});
