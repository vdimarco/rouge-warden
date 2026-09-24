import asyncio
from playwright.async_api import async_playwright
# Tap to roll: after each tap, the roll direction must point from the player toward the tapped spot.
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"])
        ctx = await b.new_context(viewport={"width":390,"height":844}, has_touch=True, is_mobile=True, device_scale_factor=2)
        d = await ctx.new_page()
        await d.goto("file:///home/claude/plungerd.html?local=1"); await d.wait_for_timeout(2000)
        await d.evaluate("document.querySelector('#intro').hidden=true; Meta.data.taught=1; Settings.set(true)")
        await d.tap("#startBtn", force=True); await d.wait_for_timeout(3000)
        for (x,y,lab) in [(340,420,'right'),(40,420,'left'),(195,200,'up'),(195,700,'down')]:
            await d.wait_for_timeout(2500); await d.evaluate("Game.scene.player.rollCd=0; Game.scene.player.rollT=0")
            await d.evaluate("Game.scene.player.rollDir=null")
            await d.touchscreen.tap(x,y); await d.wait_for_timeout(250)
            r = await d.evaluate("Game.scene.player.rollDir && [Game.scene.player.rollDir.x.toFixed(2), Game.scene.player.rollDir.y.toFixed(2)]")
            print(lab, r, flush=True)
        await b.close()
asyncio.run(main())
