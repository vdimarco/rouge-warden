// js/story/content/credits.js : the story's end credits, as options for ctx.rollCredits (js/credits.js):
// result 完 THE BEST MAN, the cast with their ink portraits, the places note, the hotline card (E5) and
// the closing note. KEEP PLAYING goes on to free roam; ◀ ARCADE (the roll's own link) leaves.
import { UI_TEXT } from './lines.js';

const role = (img, name, what) => `<div class="role"><img src="${img}" alt=""><span><b>${name}</b><small>${what}</small></span></div>`;
const glyph = (k, name, what) => `<div class="role"><span aria-hidden="true" style="display:flex;align-items:center;justify-content:center;width:78px;height:78px;flex:none;border-radius:50%;border:1px solid rgba(233,230,223,0.3);font:400 38px var(--brush);color:var(--ink)">${k}</span><span><b>${name}</b><small>${what}</small></span></div>`;

export const CREDITS = {
  result: { kanji: '完', title: 'THE BEST MAN' },
  blocks: [
    `<h3>THE CREW</h3>
      ${role('art/crew/1.webp', 'TANK TOP', 'STRONG IS EASY')}
      ${role('art/crew/2.webp', 'FIFTY-ONE', 'THE GROOM')}
      ${role('art/crew/3.webp', 'SHADES', 'WORKING ON IT')}
      ${role('art/crew/4.webp', 'NEW BALANCE', 'THE DRIVER')}
      ${role('art/crew/5.webp', 'RED JERSEY', 'NOT POSTING IT')}`,
    `<h3>AND</h3>
      ${role('art/gabe.webp', 'GABE', 'THE BEAR OF MIDGLEY BRIDGE')}
      ${role('art/portraits/vance.webp', 'AGENT NORA VANCE', 'SAME TIME NEXT MONTH')}
      ${glyph('人', 'DANA', 'SHE WROTE THE NOTE')}`,
    `<h3>THE OTHER SIDE</h3>
      ${role('art/portraits/voss.webp', 'HARLAN VOSS', 'THE SMILING MAN')}
      ${role('art/portraits/rattler.webp', 'WADE "RATTLER" PRUITT', 'FINDERS KEEPERS')}
      ${glyph('頭', 'BOONE', 'THE FOREMAN')}`,
    `<h3>AT THE WEDDING</h3><p class="line"><b>Christian · Ryu</b><small>The groomsmen</small></p>`,
    `<p class="line"><span>SET IN</span><b>Sedona, Arizona</b><small>The places are real. The people and the businesses are invented.</small></p>`,
    `<h3>IF YOU SEE SIGNS OF TRAFFICKING</h3><p class="line"><b>Do not step in yourself.</b><small>${UI_TEXT.hotline.replace('If you see signs of trafficking, do not step in yourself. ', '')}</small></p>`,
    `<h3>MADE WITH</h3>
      <p class="line"><span>WORLD, INK AND LIGHT</span><b>Three.js</b></p>
      <p class="line"><span>CHARACTERS, ART AND FILM</span><b>Higgsfield</b><small>Meshy image-to-3D · Seedance · GPT Image</small></p>
      <p class="line"><span>BUILT WITH</span><b>Claude Code</b></p>`,
  ],
  note: UI_TEXT.closing,
  againLabel: '▶ KEEP PLAYING',
};
