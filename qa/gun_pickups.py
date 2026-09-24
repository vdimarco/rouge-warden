import asyncio
from playwright.async_api import async_playwright
JS = r"""(()=>{
  const s=Game.scene, P=s.player, out={};
  run.hp=run.stats.maxHp=999; P.iT=1e9;
  const tick=(n)=>{ for(let i=0;i<n;i++){ s.step(s.time.now+i*16,16); } };
  run.guns=['pistol','soaker','nailgun','tp'].map(k=>({key:k,lvl:1,clip:GUNS[k].clip||0,ammo:GUNS[k].ammo||999})); run.gunIdx=2; UI.gun();
  let swaps=0, last=run.guns.map(g=>g.key).join();
  s.addPickup('gun:rocket', P.x, P.y, {});
  for(let i=0;i<180;i++){ tick(1); const now=run.guns.map(g=>g.key).join(); if(now!==last){swaps++; last=now;} }
  out.fullHands={swaps, guns:run.guns.map(g=>g.key), floor:s.pickups.filter(p=>p.v.startsWith('gun:')).map(p=>p.v)};
  // walk away and come back: the dropped gun can be picked up again
  const dp=s.pickups.find(p=>p.v.startsWith('gun:')); P.x+=80; tick(10); P.x=dp.x; P.y=dp.y; tick(40);
  out.afterReturn=run.guns.map(g=>g.key);
  // a second copy levels the gun up
  const k=run.guns[0].key; s.addPickup('gun:'+k, P.x, P.y, {}); tick(20);
  out.level=run.guns.find(g=>g.key===k).lvl;
  return out;
})()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"])
        d = await b.new_page(viewport={"width":900,"height":600})
        errs=[]; d.on("pageerror", lambda e: errs.append(str(e)))
        await d.goto("file:///home/claude/plungerd.html?local=1"); await d.wait_for_timeout(2000)
        await d.evaluate("document.querySelector('#intro').hidden=true; Meta.data.taught=1")
        await d.click("#startBtn", force=True); await d.wait_for_timeout(3000)
        print(await d.evaluate(JS)); print(errs[:3]); await b.close()
asyncio.run(main())
