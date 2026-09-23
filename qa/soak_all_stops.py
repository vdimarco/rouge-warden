import asyncio
from playwright.async_api import async_playwright
# A bot plays all six stops: it walks into every fight room, fights with a random gun (swapping often),
# clears the waves, beats the boss, and takes the hatch. Any error or stall is reported with where it happened.
STEP = r"""(async (day)=>{
  const s=Game.scene, log=[], P=()=>s.player;
  const tick=(n)=>{ for(let i=0;i<n;i++){ const t=(s._qt=Math.max(s._qt||0, s.time.now)+16); s.time.preUpdate(t,16); s.time.update(t,16); if(s.tweens.preUpdate) s.tweens.preUpdate(); s.tweens.update(t,16); s.step(t,16); } };
  run.hp=run.stats.maxHp=99; 
  const guns=Object.keys(GUNS);
  const fights=s.map.rooms.filter(r=>r.type==='fight');
  for(const r of fights){
    P().iT=1e9; P().x=(r.x+r.w/2)*T; P().y=(r.y+r.h/2)*T; s.camC=null;
    let guard=0;
    tick(30);
    while(s.fightRoom===r && guard<900){ guard++;
      if(guard%40===0){ run.guns=[guns[guard%guns.length], guns[(guard*7)%guns.length]].filter((v,i,a)=>a.indexOf(v)===i).map(k=>({key:k,lvl:1+guard%3,clip:GUNS[k].clip||0,ammo:999})); run.gunIdx=0; UI.gun(); }
      if(guard%13===0) s.swapGun();
      if(guard%29===0) s.wantRoll=true;
      s.mouse.down=true; tick(3);
      if(guard%10===0) for(const e of s.enemies) if(!e.dead && !e.d.boss && e.spawnT<=0) s.damageFoe(e, 40, null);
    }
    s.mouse.down=false;
    log.push(r.id+':'+(s.fightRoom===r?'STUCK':'ok')+':'+guard);
  }
  const br=s.map.rooms.find(r=>r.type==='boss');
  P().iT=1e9; P().x=(br.x+br.w/2)*T; P().y=(br.y+br.h*0.6)*T; s.camC=null;
  let g=0; tick(120);
  while(!s.hatch && g<1500){ g++; s.mouse.down=true; tick(2); if(g%8===0) for(const e of s.enemies) if(!e.dead && e.spawnT<=0 && e.st!=='bench' && !e.hidden && e.st!=='spin') s.damageFoe(e, 60, null); if(g%17===0) s.swapGun(); }
  s.mouse.down=false;
  log.push('boss:'+(s.hatch?'beaten':'STUCK')+':'+g);
  return log;
})"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"])
        d = await b.new_page(viewport={"width":800,"height":500})
        errs=[]; d.on("pageerror", lambda e: errs.append(str(e))); d.on("console", lambda m: m.type=="error" and errs.append(m.text[:300]))
        await d.goto("file:///home/claude/plungerd.html?local=1"); await d.wait_for_timeout(2000)
        await d.evaluate("document.querySelector('#intro').hidden=true; Meta.data.taught=1")
        await d.click("#startBtn", force=True); await d.wait_for_timeout(3000)
        for day in range(1,8):
            try:
                log = await asyncio.wait_for(d.evaluate(STEP+f"({day})"), timeout=120)
            except Exception as e:
                print("day", day, "ERROR", str(e)[:400]); break
            print("day", day, stage := await d.evaluate("stageOf(run.day).name"), log)
            await d.evaluate("Game.nextDay()"); await d.wait_for_timeout(2500)
            if await d.evaluate("run.day") != day+1: print("did not advance"); break
        print("console errors:", errs[:5]); await b.close()
asyncio.run(main())
