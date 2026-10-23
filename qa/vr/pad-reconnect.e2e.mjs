// Synthetic controller lifecycle; this does not claim physical-device validation.
import {newPage,open,close,checker,watchdog,shot} from './lib.mjs';
const {check,done}=checker('pad reconnect');watchdog(300000,'pad reconnect');
try {
 const p=await newPage();
 await p.addInitScript(()=>{window.__pad=null;Object.defineProperty(navigator,'getGamepads',{value:()=>[window.__pad]});});
 await open(p,'?nosw');await p.waitForFunction(()=>G.desktop);
 const cases=await p.evaluate(()=>{
  const buttons=[[0,'jumpDown'],[1,'carDown'],[2,'yank'],[3,'viewDown'],[5,'yank'],[9,'menuDown'],[12,'throwDown']];
  const result=[];
  for(const [button,name] of buttons){
   const pad=window.__pad={connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
   G.desktop.update(1/60);
   pad.buttons[button]={pressed:true,value:1};
   const read=()=>{const x=G.desktop.update(1/60);return name==='yank'?x.hands.some(h=>h.yank>0):x[name];};
   const first=read(),held=read();
   pad.connected=false;const absent=read();
   pad.connected=true;const reconnected=read(),reheld=read();
   result.push({button,name,first,held,absent,reconnected,reheld});
   window.__pad=null;G.desktop.update(1/60);
  }
  return result;
 });
 for(const c of cases){
  check(c.first&&!c.held,'connected button '+c.button+' emits one action per press',c);
  check(!c.absent,'disconnected button '+c.button+' emits no action',c);
  check(c.reconnected&&!c.reheld,'reconnected button '+c.button+' starts a fresh edge',c);
 }
 await p.evaluate(cases=>{const panel=document.createElement('pre');panel.style.cssText='position:fixed;inset:20px;z-index:99999;padding:20px;background:#fff;color:#111;font:14px monospace;white-space:pre-wrap';panel.textContent='SYNTHETIC CONTROLLER LIFECYCLE PROBE\nNo physical gamepad or gameplay validation\n\n'+cases.map(c=>'Button '+c.button+' ('+c.name+'): reconnect action '+c.reconnected+', held repeats '+c.reheld).join('\n');document.body.appendChild(panel);},cases);
 await shot(p,'pad-reconnect');
 check(p.errors.length===0,'no page errors',p.errors);
}finally{await close();}
done();
