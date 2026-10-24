export class PatrolAudio {
  constructor(){this.enabled=false;this.context=null;}
  async toggle(){
    if(!this.context){
      const AudioContext=window.AudioContext||window.webkitAudioContext;
      if(!AudioContext)return false;
      this.context=new AudioContext();
      this.master=this.context.createGain();this.master.gain.value=0;this.master.connect(this.context.destination);
      const buffer=this.context.createBuffer(1,this.context.sampleRate*3,this.context.sampleRate),data=buffer.getChannelData(0);
      let last=0;for(let i=0;i<data.length;i++){last=(last+Math.random()*.04-.02)/1.02;data[i]=last*3;}
      this.noise=this.context.createBufferSource();this.noise.buffer=buffer;this.noise.loop=true;
      const filter=this.context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=400;
      this.noise.connect(filter);filter.connect(this.master);this.noise.start();
    }
    await this.context.resume();this.enabled=!this.enabled;
    this.master.gain.setTargetAtTime(this.enabled?.12:0,this.context.currentTime,.2);
    return this.enabled;
  }
  event(type){
    if(!this.enabled||!this.context)return;
    const c=this.context,now=c.currentTime,osc=c.createOscillator(),gain=c.createGain();
    osc.type=type==='hit'||type==='blast'?'sawtooth':'sine';
    const frequency=type==='launch'?90:type==='hit'||type==='blast'?55:type==='danger'?250:560;
    osc.frequency.setValueAtTime(frequency,now);osc.frequency.exponentialRampToValueAtTime(frequency*.45,now+.7);
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(type==='hit'||type==='blast'?.4:.18,now+.03);gain.gain.exponentialRampToValueAtTime(.001,now+.85);
    osc.connect(gain);gain.connect(this.master);osc.start();osc.stop(now+.9);
  }
}
