import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"])
        d = await b.new_page(viewport={"width":390,"height":780}, device_scale_factor=2)
        errs=[]; d.on("pageerror", lambda e: errs.append(str(e)))
        await d.goto("file:///home/claude/plungerd.html?local=1"); await d.wait_for_timeout(2000)
        await d.evaluate("document.querySelector('#intro').hidden=true; Meta.data.taught=1")
        await d.click("#startBtn", force=True); await d.wait_for_timeout(3000)
        # count on-screen chunks without a painted texture, every frame, while resizing and teleporting around
        await d.evaluate("""(()=>{const s=Game.scene; window.MISS=0; window.FR=0; s.events.on('postupdate',()=>{FR++; const v=s.cameras.main.worldView; for(const c of s.chunks){ if(c.x<v.right&&c.x+c.w>v.x&&c.y<v.bottom&&c.y+c.h>v.y&&!c.img) MISS++; }});})()""")
        for k in range(6):
            await d.set_viewport_size({"width":390,"height":780 - (k%2)*60}); await d.wait_for_timeout(300)
            await d.evaluate("(()=>{const s=Game.scene, r=s.map.rooms[Math.floor(Math.random()*s.map.rooms.length)]; s.player.x=(r.x+r.w/2)*T; s.player.y=(r.y+r.h/2)*T; s.camC=null;})()")
            await d.wait_for_timeout(400)
        print("frames", await d.evaluate("FR"), "on-screen chunks missing:", await d.evaluate("MISS"))
        await d.evaluate("Game.scene.repaintChunks()"); await d.wait_for_timeout(300)
        print(errs[:3]); await b.close()
asyncio.run(main())
