# Design

The homepage starts a cabinet from `data-url` on the cabinet article. `boot()` reads that attribute and assigns `location.href`. There is no separate anchor, sitemap entry, or URL builder for BREAKTHROUGH.

Change only that attribute to `/breakthrough2/`. The game id stays `breakthrough`, so credits, the attract scene, and the token slot keep working. The marquee text and `aria-label` stay as they are.

`qa/breakthrough/play.mjs` still targets `/breakthrough/` because that script checks the older page, which remains. Homepage QA that reads `public/index.html` does not assert this URL.
