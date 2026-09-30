// Combat rules are independent from rendering and motion sensors.
export class Duel {
  constructor(level=1,random=Math.random){
    this.random=random;this.level=level;this.active=null;this.gap=.6;this.finished=false;
    const count=Math.min(5,1+Math.floor((level-1)/2));
    this.fighters=Array.from({length:count},(_,i)=>({id:i,type:i===0&&level%4===0?'CAPTAIN':'RONIN',boss:i===0&&level%4===0,hp:6+Math.floor(level/3)+(i===0&&level%4===0?3:0),max:6+Math.floor(level/3)+(i===0&&level%4===0?3:0),posture:0,guardDir:i%2,dir:i%2,phase:'guard',timer:.6+i*.3,period:Math.max(.7,1.15-level*.025),hit:0,turns:0,attack:'cut',lastAttack:null}));
  }
  open(f){f.posture=4;f.phase='open';f.timer=1.8;this.active=null;this.gap=.35}
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
        if(!defense.inRange||defense.dashing){kind='evade';f.phase='open';f.posture=4;f.timer=.85}
        else if(defense.blocked&&f.attack!=='sweep'){f.posture+=defense.perfect?2.25:1;kind=defense.perfect?'parry':'block';if(f.posture>=4)this.open(f);else{f.phase='recover';f.timer=.45}}
        else{kind='damage';f.phase='recover';f.timer=.6}
        context.event(kind,f);this.active=null;this.gap=.45;
      }
    }
    if(!this.active&&this.gap===0){const choices=this.fighters.filter(f=>f.hp>0&&f.phase==='guard'&&f.timer===0&&context.canAttack(f));choices.sort((a,b)=>a.turns-b.turns||a.id-b.id);if(choices.length){const f=choices[0];f.turns++;const attacks=['cut','overhead','lunge','sweep','delayed'].filter(a=>a!==f.lastAttack);f.attack=attacks[Math.floor(this.random()*attacks.length)];f.lastAttack=f.attack;f.dir=f.attack==='overhead'?1:f.attack==='sweep'?0:Math.floor(this.random()*2);f.period=(f.attack==='delayed'?1.5:f.attack==='sweep'?1.15:f.attack==='lunge'?.85:.7)+this.random()*.3;f.phase='windup';f.timer=f.period;this.active=f;context.event('windup',f)}}
  }
}
