// Lightweight, locally synthesized music and feedback. Starts on a user gesture.
export class Sound {
  constructor() { this.on = true; try { this.on = localStorage.getItem('tidebreak.sound') !== 'off'; } catch {} this.context = null; this.note = 0; this.next = 0; }
  start() { try { this.context ||= new (window.AudioContext || window.webkitAudioContext)(); this.context.resume().catch(() => {}); } catch {} }
  tone(hz, duration = .1, volume = .035, type = 'sine', end, delay = 0) {
    const c = this.context; if (!c || !this.on || c.state !== 'running') return;
    const at=c.currentTime+delay,o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(hz, at); if (end) o.frequency.exponentialRampToValueAtTime(end, at + duration); g.gain.setValueAtTime(.001,at);g.gain.linearRampToValueAtTime(volume,at+.006);g.gain.exponentialRampToValueAtTime(.001, at + duration); o.connect(g).connect(c.destination); o.start(at); o.stop(at + duration);
  }
  tick(time) { if (time < this.next) return; this.next = time + .48; const notes = [146.83, 220, 293.66, 349.23, 293.66, 220, 174.61, 130.81]; this.tone(notes[this.note++ % notes.length], .9, .009, 'triangle'); }
  hit(variant = 0, hero = 0) { const pitch=[1,.6,.85,1.12,.68,.88,1.3,.55,1.2,.95,1.05,.8][hero]||1;this.tone([340,430,220][variant]*pitch,[.11,.14,.21][variant],variant===2?.027:.018,hero===7?'sine':'triangle',[105,160,65][variant]*pitch); }
  skill(slot, hero = 0) {
    const roots=[310,145,250,190,120,420,540,95,660,330,470,175],root=roots[hero]||310,interval=[1,1.5,1.25,.5][slot]||1,type=[0,3,7,11].includes(hero)?'triangle':'sine';
    this.tone(root*interval,slot===3?.45:.26,.031,type,root*([1,4,6,9].includes(hero)?2.3:.55));
    if(slot===3)this.tone(root*1.5,.32,.022,'triangle',root*2,.07);
  }
  feedback(event) {
    if(event.type==='combo'){this.tone(590,.13,.033,'triangle',760);this.tone(880,.18,.024,'sine',1050,.07);}
    else if(event.type==='shield-break'){this.tone(1000,.2,.025,'triangle',160);this.tone(1420,.12,.016,'sine',330,.025);}
    else if(event.type==='interrupt'){this.tone(390,.16,.03,'triangle',90);}
    else if(event.type==='kill'){this.tone(330,.28,.03,'triangle',440);this.tone(660,.28,.022,'sine',880,.09);}
    else if(event.type==='exposed'){this.tone(250,.18,.025,'triangle',120);this.tone(500,.13,.018,'sine',270,.025);}
  }
  syncFeedback(state,p) {
    if(this.feedbackState!==state){this.feedbackState=state;this.feedbackSeen=new Set();this.feedbackAt=-1;}
    const events=(state.combatFeedback||[]).filter(e=>!this.feedbackSeen.has(e.id));
    for(const e of events)this.feedbackSeen.add(e.id);
    // One result sound per update keeps a group hit from masking the next warning.
    const priority={kill:5,interrupt:4,'shield-break':3,combo:2,exposed:1};
    const event=events.filter(e=>state.time-e.time<=.3&&(e.source===p.id||e.target===p.id)).sort((a,b)=>(priority[b.type]||0)-(priority[a.type]||0))[0];
    if(event&&state.time>=this.feedbackAt+.09){this.feedback(event);this.feedbackAt=state.time;}
    if(this.feedbackSeen.size>128)this.feedbackSeen=new Set((state.combatFeedback||[]).map(e=>e.id));
  }
  toggle() { this.on = !this.on; try { localStorage.setItem('tidebreak.sound', this.on ? 'on' : 'off'); } catch {} return this.on; }
}
