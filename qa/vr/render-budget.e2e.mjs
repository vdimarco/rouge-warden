// Buffer dimensions and layout, not a hardware FPS benchmark.
import {newPage,open,close,checker,watchdog} from './lib.mjs';
const {check,done}=checker('flat render budget');watchdog(300000,'flat render budget');
try {
 const p=await newPage({width:3840,height:1080});
 await p.addInitScript(()=>Object.defineProperty(window,'devicePixelRatio',{value:2,configurable:true}));
 await open(p,'?nosw');await p.waitForFunction(()=>G.viewDone);
 const read=()=>p.evaluate(()=>{const c=G.renderer.domElement,r=c.getBoundingClientRect();return {w:c.width,h:c.height,ratio:G.renderer.getPixelRatio(),cssW:r.width,cssH:r.height,aspect:G.camera.aspect};});
 const large=await read();
 check(large.w*large.h<=3840*2160,'initial ultrawide buffer respects the pixel budget',large);
 check(large.cssW===3840&&large.cssH===1080&&large.aspect===3840/1080,'ultrawide canvas and camera fill the viewport',large);
 await p.setViewportSize({width:390,height:844});
 await p.waitForFunction(()=>G.camera.aspect===390/844);
 const phone=await read();
 check(phone.w===780&&phone.h===1688&&phone.ratio===2,'phone restores normal high-DPI rendering',phone);
 check(phone.cssW===390&&phone.cssH===844,'phone layout remains viewport-sized',phone);
 await p.setViewportSize({width:3840,height:1080});
 await p.waitForFunction(()=>G.camera.aspect===3840/1080);
 const resized=await read();
 check(resized.w*resized.h<=3840*2160,'resize reapplies the ultrawide budget',resized);
 await p.evaluate(()=>{G.renderer.xr.isPresenting=true;});
 await p.setViewportSize({width:1280,height:720});
 await p.evaluate(()=>dispatchEvent(new Event('resize')));
 const xr=await read();
 check(xr.w===resized.w&&xr.h===resized.h,'flat resize leaves a presenting XR buffer alone',xr);
 await p.evaluate(()=>{G.renderer.xr.isPresenting=false;Object.defineProperty(window,'devicePixelRatio',{value:1,configurable:true});dispatchEvent(new Event('resize'));});
 const desktop=await read();
 check(desktop.w===1280&&desktop.h===720&&desktop.ratio===1,'normal desktop density is restored after XR',desktop);
 check(desktop.aspect===1280/720,'camera aspect follows the restored desktop viewport',desktop);
 check(p.errors.length===0,'no page errors',p.errors);
}finally{await close();}
done();
