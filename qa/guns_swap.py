import asyncio
from playwright.async_api import async_playwright
JS = r"""(()=>{
  const s=Game.scene, P=s.player, out={fails:[], steps:0};
  run.hp=run.stats.maxHp=999; P.iT=1e9; Settings.set(ONEHAND); if(ONEHAND){ s.touch.move={id:77,x:100,y:100,ox:100,oy:100,t:performance.now()}; }
  const r=s.map.rooms.filter(r=>r.type==='fight')[0]; s.reveal(r); P.x=(r.x+r.w/2)*T; P.y=(r.y+r.h/2)*T;
  const tick=(n)=>{ for(let i=0;i<n;i++){ s.step(s.time.now+i*16, 16); out.steps++; UI.gunFlush(); } };
  // keep a few critters around to shoot at
  const feed=()=>{ if(s.enemies.filter(e=>!e.dead).length<3){ const e=s.spawnFoe('raccoon',P.x+60,P.y-40,{child:true}); e.spawnT=0; } };
  const keys=Object.keys(GUNS);
  const mk=(k)=>({key:k,lvl:1+Math.floor(Math.random()*3),clip:GUNS[k].clip||0,ammo:999});
  for(const a of keys) for(const c of keys){ if(a===c) continue;
    try{
      run.guns=[mk(a),mk(c)]; run.gunIdx=0; UI.gun(); feed();
      s.mouse.down=true; tick(6);            // firing a
      document.querySelector('#gunBtn').click(); tick(3);  // swap mid-fire, through the button
      s.startReload(); s.swapGun(); tick(4); // reload, swap mid-reload
      s.wantRoll=true; tick(2); s.setGun(1); tick(3); // swap mid-roll
      s.mouse.down=false; tick(2); s.setGun(0); tick(2);
      run.guns[0].clip=0; run.guns[0].ammo=0; s.mouse.down=true; tick(6); s.mouse.down=false; // run a gun dry
      if(!run.guns.length || !run.guns[run.gunIdx]) throw new Error('no gun left: '+JSON.stringify(run.guns));
    }catch(e){ out.fails.push([a,c,String(e.stack||e).slice(0,300)]); }
  }
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
        # step() swallows nothing here: call the real body so errors surface
        for oh in ['false','true']:
            res = await d.evaluate(JS.replace('ONEHAND', oh))
            print('one hand', oh, 'steps', res['steps'], 'fails', len(res['fails']))
            for a,c,e in res['fails'][:3]: print(a,c,e[:300])
        print('frame error logged:', await d.evaluate('!!Game.scene.errLogged'))
        return
        print("steps:", res['steps'], "fails:", len(res['fails']))
        seen=set()
        for a,c,e in res['fails']:
            k=e.split('\n')[0]
            if k in seen: continue
            seen.add(k); print(a,c,'\n ',e[:300])
        print(errs[:3]); await b.close()
asyncio.run(main())
