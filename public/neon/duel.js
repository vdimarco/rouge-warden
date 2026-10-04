// Combat rules are independent from rendering and motion sensors.
// A seeded generator (mulberry32) makes a duel repeatable: the same seed gives the same attacks.
export function seededRandom(seed=1){let s=seed>>>0;return()=>{s=s+0x6D2B79F5>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
// Turns text, such as a date, into a seed. Extra numbers give each round its own seed.
export function seedFrom(text,...parts){let h=2166136261;for(const c of [String(text),...parts].join('/')){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
// The local date as YYYY-MM-DD. Everyone who plays on the same day meets the same duels.
export function dayKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
// Picks count items without repeats. The same random sequence gives the same picks.
export function pick(items,count,random=Math.random){const pool=[...items],out=[];while(out.length<count&&pool.length)out.push(pool.splice(Math.floor(random()*pool.length),1)[0]);return out}
// A guard that goes down this many seconds or less before impact is a parry.
// A touch guard is one button, so its window is wider than for a blade set with the gyro.
export const PARRY_WINDOW={touch:.6,gyro:.28};
// Guard pressure for each defense. At 4 the guard breaks. A parry breaks it at once.
export const PRESSURE={block:1,evade:2};
export class Duel {
  constructor(level=1,random=Math.random){
    this.random=random;this.level=level;this.active=null;this.gap=.6;this.finished=false;
    const count=Math.min(5,1+Math.floor((level-1)/2));
    this.fighters=Array.from({length:count},(_,i)=>({id:i,type:i===0&&level%4===0?'CAPTAIN':'RONIN',boss:i===0&&level%4===0,hp:6+Math.floor(level/3)+(i===0&&level%4===0?3:0),max:6+Math.floor(level/3)+(i===0&&level%4===0?3:0),posture:0,guardDir:i%2,dir:i%2,phase:'guard',timer:.6+i*.3,period:Math.max(.7,1.15-level*.025),hit:0,turns:0,attack:'cut',lastAttack:null}));
  }
  open(f){f.posture=4;f.phase='open';f.timer=1.8;this.active=null;this.gap=.35}
  // Adds guard pressure. A full bar opens the guard. Otherwise the fighter steps back to recover.
  press(f,amount,recover=.45){f.posture=Math.min(4,f.posture+amount);if(f.posture>=4)this.open(f);else{f.phase='recover';f.timer=recover}}
  swing(f,direction,power=1){
    if(!f||f.hp<=0||this.finished)return {kind:'miss'};
    if(f.phase==='open'){
      const damage=Math.min(3,Math.max(1,power));f.hp=Math.max(0,f.hp-damage);f.hit=.22;
      if(f.hp===0){f.phase='down';if(this.active===f)this.active=null;this.finished=this.fighters.every(x=>x.hp===0);return {kind:'kill',damage}}
      // One clean hit per opening: another exchange is needed to defeat a foe.
      f.posture=0;f.phase='recover';f.timer=.65;return {kind:'hit',damage};
    }
    // Repeated cuts meet a real guard; changing angle pressures it faster.
    f.posture=Math.min(4,f.posture+(direction!==f.guardDir?.6:.2));f.guardDir=direction;f.hit=.08;
    if(f.posture>=4){this.open(f);return {kind:'break'}}
    return {kind:'clash'};
  }
  update(dt,context){
    if(this.finished)return;this.gap=Math.max(0,this.gap-dt);
    for(const f of this.fighters){if(f.hp<=0)continue;f.hit=Math.max(0,f.hit-dt);
      if(f.phase==='open'||f.phase==='recover'){f.timer-=dt;if(f.timer<=0){if(f.phase==='open')f.posture=0;f.phase='guard';f.timer=.7}}
      else if(f.phase==='guard'){f.timer=Math.max(0,f.timer-dt);f.posture=Math.max(0,f.posture-dt*.15)}
    }
    if(this.active){const f=this.active;f.timer-=dt;
      if(f.timer<=0){const defense=context.defense(f);let kind;
        // A timed dodge weakens the guard, but it gives no free opening.
        if(defense.dashing){kind='evade';this.press(f,PRESSURE.evade,.6)}
        // Out of reach, the blade cuts air and the guard stays whole.
        else if(!defense.inRange){kind='whiff';f.phase='recover';f.timer=.6}
        // No guard stops a sweep. A parry opens the guard at once. A block only weakens it.
        else if(defense.blocked&&f.attack!=='sweep'){if(defense.perfect){kind='parry';this.open(f)}else{kind='block';this.press(f,PRESSURE.block)}}
        else{kind='damage';f.phase='recover';f.timer=.6}
        context.event(kind,f);this.active=null;this.gap=.45;
      }
    }
    if(!this.active&&this.gap===0){const choices=this.fighters.filter(f=>f.hp>0&&f.phase==='guard'&&f.timer===0&&context.canAttack(f));choices.sort((a,b)=>a.turns-b.turns||a.id-b.id);if(choices.length){const f=choices[0];f.turns++;const attacks=['cut','overhead','lunge','sweep','delayed'].filter(a=>a!==f.lastAttack);f.attack=attacks[Math.floor(this.random()*attacks.length)];f.lastAttack=f.attack;f.dir=f.attack==='overhead'?1:f.attack==='sweep'?0:Math.floor(this.random()*2);f.period=(f.attack==='delayed'?1.5:f.attack==='sweep'?1.15:f.attack==='lunge'?.85:.7)+this.random()*.3;f.phase='windup';f.timer=f.period;this.active=f;context.event('windup',f)}}
  }
}
