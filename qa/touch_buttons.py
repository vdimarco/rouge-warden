import asyncio
from playwright.async_api import async_playwright
# Real multi-touch on a phone-sized screen: hold a drag with one finger, tap the gun button and the gun slots
# with a second finger, lift both, then check the game still runs and the thumbstick isn't left stuck.
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"])
        ctx = await b.new_context(viewport={"width":390,"height":844}, has_touch=True, is_mobile=True)
        d = await ctx.new_page()
        await d.goto("file:///home/claude/plungerd.html?local=1"); await d.wait_for_timeout(2000)
        await d.evaluate("document.querySelector('#intro').hidden=true; Meta.data.taught=1; Settings.set(true)")
        await d.tap("#startBtn", force=True); await d.wait_for_timeout(3000); print("started", flush=True)
        await d.evaluate("run.hp=run.stats.maxHp=99; Game.scene.player.iT=1e9; run.guns=['pistol','soaker','hose','zapper'].map(k=>({key:k,lvl:1,clip:GUNS[k].clip||0,ammo:999})); run.gunIdx=0; UI.gun(); UI.gunFlush(); window.FR=0; Game.scene.events.on('postupdate',()=>FR++); 1")
        cdp = await ctx.new_cdp_session(d)
        gb = await d.evaluate("(()=>{const r=document.querySelector('#gunBtn').getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]})()")
        sl = await d.evaluate("[...document.querySelectorAll('.slot')].map(b=>{const r=b.getBoundingClientRect(); return [r.x+r.width/2, r.y+r.height/2]})")
        async def touch(kind, pts): await asyncio.wait_for(cdp.send("Input.dispatchTouchEvent", {"type": kind, "touchPoints": [{"x":x,"y":y,"id":i} for i,(x,y) in pts]}), 8)
        async def state(): return await asyncio.wait_for(d.evaluate("[run.gunIdx, !!Game.scene.touch.move, Game.scene.mode, FR]"), 8)
        for k,target in enumerate([gb]+sl+[gb]):
            await touch("touchStart", [(0,(200,500))]); await d.wait_for_timeout(100)
            await touch("touchMove", [(0,(230,470))]); await d.wait_for_timeout(100)
            await touch("touchStart", [(0,(230,470)),(1,tuple(target))]); await d.wait_for_timeout(80)
            await touch("touchEnd", [(0,(230,470))]); await d.wait_for_timeout(80)
            await touch("touchEnd", []); await d.wait_for_timeout(250)
            print("tap", k, "[gun, stick stuck, mode, frames]", await state(), flush=True)
        # a single-finger tap on the gun button, then on a slot, the way most people would
        for target in [gb, sl[2], gb]:
            await touch("touchStart", [(0,tuple(target))]); await d.wait_for_timeout(60); await touch("touchEnd", []); await d.wait_for_timeout(300)
            print("single tap", await state(), flush=True)
        print("phaser pointers [id, down, identifier]:", await d.evaluate("Game.scene.input.manager.pointers.map(p=>[p.id,p.isDown,p.identifier])"))
        p0 = await d.evaluate("[Game.scene.player.x,Game.scene.player.y]")
        await touch("touchStart", [(0,(200,500))]); await d.wait_for_timeout(100); print("on drag start:", await d.evaluate("[!!Game.scene.touch.move, Game.scene.input.manager.pointers.map(p=>[p.id,p.isDown,p.identifier])]")); await touch("touchMove", [(0,(200,560))]); await d.wait_for_timeout(300); print("mid drag:", await d.evaluate("[JSON.stringify(Game.scene.touch.move), JSON.stringify(Game.scene.moveInput ? Game.scene.moveInput() : null), Game.scene.player.vx, Game.scene.player.vy, Game.scene.player.rollT]")); await d.wait_for_timeout(400); await touch("touchEnd", [])
        p1 = await d.evaluate("[Game.scene.player.x,Game.scene.player.y]")
        print("player moved after taps:", round(p1[1]-p0[1]), "final", await state(), flush=True)
        await b.close()
asyncio.run(main())
