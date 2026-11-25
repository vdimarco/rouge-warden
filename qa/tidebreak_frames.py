# Frame rate and screenshot latency for Shore of the Ancients under software WebGL.
# Usage: python3 qa/tidebreak_frames.py [url]
# The default url is the live site. Pass a local or preview url to compare a branch.
# Screenshots land in qa/shots/. The process exits non-zero if any screenshot takes over 15 seconds.
import argparse, asyncio, os, sys, time
from pathlib import Path
from playwright.async_api import async_playwright

LIVE = "https://warden-alpha-wheat.vercel.app/tidebreak/"
SHOTS = Path(__file__).resolve().parent / "shots"
SWIFT = ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"]

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("url", nargs="?", default=LIVE)
    args = parser.parse_args()
    SHOTS.mkdir(parents=True, exist_ok=True)
    chrome = os.environ.get("CHROME_PATH")
    hung = False
    async with async_playwright() as p:
        launch = {"args": SWIFT}
        if chrome:
            launch["executable_path"] = chrome
        browser = await p.chromium.launch(**launch)
        for vw, vh, d, m, t in [(390, 844, 3, True, "390"), (1280, 800, 1, False, "1280")] * 3:
            ctx = await browser.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=d, is_mobile=m, has_touch=m)
            page = await ctx.new_page()
            await page.goto(args.url, wait_until="load", timeout=120000)
            await page.wait_for_timeout(2000)
            stats = await page.evaluate("""()=>new Promise(r=>{let n=0;const t0=performance.now();function f(){n++; if(performance.now()-t0<1000) requestAnimationFrame(f); else r({fps:n,lt:performance.getEntriesByType('longtask').length})} requestAnimationFrame(f)})""")
            path = SHOTS / f"tb-{t}.png"
            t0 = time.time()
            try:
                await page.screenshot(path=str(path), timeout=15000)
                status = "ok %.1fs" % (time.time() - t0)
            except Exception:
                status = "HANG >15s"
                hung = True
            print(t, stats, status, flush=True)
            await ctx.close()
        await browser.close()
    if hung:
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
