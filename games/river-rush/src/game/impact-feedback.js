// Contact presentation has its own short fatal clock. It never advances the
// stopped river, player action or pickup simulation.
export const FATAL_IMPACT_DURATION=.60;
export const IMPACT_SPRAY_CAPACITY=72;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=x=>{const t=clamp(x,0,1);return t*t*(3-2*t);};

export function impactFeedback(g,reduced=false,fatalElapsed=0){
 const event=g.effects.findLast(e=>['hit','lose','smash'].includes(e.type));
 const fatal=event?.type==='lose',contactTime=event?.contactTime??event?.time??-10;
 const age=Math.max(0,g.time-contactTime+(fatal?clamp(fatalElapsed,0,FATAL_IMPACT_DURATION):0));
 const shieldEvent=g.effects.findLast(e=>e.type==='hit'),shieldAge=shieldEvent?Math.max(0,g.time-(shieldEvent.contactTime??shieldEvent.time)+(fatal?clamp(fatalElapsed,0,FATAL_IMPACT_DURATION):0)):10;
 const active=!!event&&age<(fatal?FATAL_IMPACT_DURATION:.56);
 const side=(event?.playerLane??event?.lane??g.visualLane??1)<1?-1:1;
 const kick=event?Math.exp(-age*8)*(Math.cos(age*19)+.24*Math.sin(age*19)):0;
 const settle=fatal?smooth((age-.1)/.45):0;
 const strength=active?clamp(Math.exp(-age*5)+(fatal?.22:0),0,1):0;
 const recoil=event?(reduced?0:(fatal?.82:1)*kick+(fatal?.58*settle:0)):0;
 const pitch=event?(reduced?0:.29*kick-(fatal?.22*settle:0)):0;
 const roll=event?(reduced?0:side*(.12*kick+(fatal?.57*settle:0))):0;
 const brace=event?(reduced?(active?.16:0):Math.max(0,Math.exp(-age*5)+(fatal?.5*settle:0))):0;
 const flash=active?Math.max(0,1-age/.22)*.68:0;
 const shieldPulse=shieldAge<.56?Math.exp(-shieldAge*7):0;
 const shakeX=active&&!reduced?Math.sin(age*68+1)*Math.exp(-age*17)*(fatal?.095:.075):0;
 const shakeY=active&&!reduced?Math.sin(age*82+.6)*Math.exp(-age*18)*(fatal?.062:.044):0;
 const splashParticles=active&&!reduced?56:0;
 const shieldShards=active&&!reduced&&shieldPulse>0?16:0;
 return{eventId:event?.id??null,type:event?.type??null,fatal,age,active,strength,recoil,pitch,roll,brace,flash,shieldPulse,shieldAge,shakeX,shakeY,cameraShake:Math.hypot(shakeX,shakeY),splashParticles,shieldShards,side,lane:event?.playerLane??event?.lane??g.visualLane??1};
}

// Reuse the fixed spray pool for impact droplets and shield fragments.
export function impactParticle(index,impact,out={}){
 const shard=index>=56,age=shard?impact.shieldAge:impact.age,angle=index*2.399963,spread=.6+age*(shard?6:8),height=shard?1.5:.25;
 out.x=Math.cos(angle)*spread*(shard?.9:1.25);
 out.y=height+Math.sin(Math.min(1,age/.6)*Math.PI)*(shard?2.1:1.4+(index%5)*.14)-age*(shard?.8:1.4);
 out.z=Math.sin(angle)*spread*.7+.7+impact.recoil*.45;
 out.shard=shard;
 return out;
}
