// A card that explains a skill in the command bar: name, key, rank, mana, cooldown, tags, what it does and why it
// cannot be used now. A mouse shows it while the pointer is over the skill (or the skill has keyboard focus). A touch
// shows it while the finger is down and for a short time after release, so a tap still casts as before.
// On the phone layouts of the bar the card is compact (one meta line and the first sentence of the text) and sits at
// the left of the bar, above the items, away from the skills under the thumb.
import { nearestSkill } from './skill-reach.js';

const TOUCH_HOLD_MS = 1800;
// The phone layouts of the command bar (see command-bar.css).
const PHONE = '(max-height:599px) and (min-width:540px), (max-width:1039px) and (min-height:600px), (max-width:539px)';
const compact = () => typeof matchMedia === 'function' && matchMedia(PHONE).matches;
const firstSentence = t => (String(t).match(/^.*?[.!?](\s|$)/) || [t])[0].trim();
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// buttons: the four skill buttons. info(slot) returns { name, key, rank, maxRank, cost, cooldown, tags, description,
// status } or null when no match runs. status is a short line such as "Ready" or "Learn at level 3".
export function skillCard(buttons, info) {
  const cluster = buttons[0]?.parentElement;
  if (!cluster || typeof document === 'undefined') return null;
  const card = document.createElement('div');
  card.id = 'skill-card'; card.className = 'skill-card'; card.setAttribute('role', 'tooltip'); card.hidden = true;
  cluster.closest('#hud')?.append(card);
  let slot = -1, hideTimer = 0, refresh = 0;

  const place = () => {
    const b = buttons[slot]; if (!b) return;
    const w = card.offsetWidth, h = card.offsetHeight, r = b.getBoundingClientRect();
    if (compact()) {
      // Phone: at the left edge of the bar, above the bar, the quick-buy tab and any badge or point button the card
      // would reach over.
      const bar = document.querySelector('#hud .health')?.getBoundingClientRect(), shelf = document.querySelector('#hud #loadout')?.getBoundingClientRect();
      const x = Math.max(6, Math.min(innerWidth - w - 6, Math.min(bar?.left ?? 8, shelf?.left ?? 8) - 4));
      let top = Math.min(r.top, bar?.top ?? r.top, shelf?.top ?? r.top);
      for (const el of document.querySelectorAll('#hud #quick-buy,#hud .ability-upgrade:not([hidden]),#hud #skill-points')) { const o = el.getBoundingClientRect(); if (o.height && o.right > x && o.left < x + w) top = Math.min(top, o.top); }
      card.style.left = `${x}px`; card.style.top = `${Math.max(6, top - h - 6)}px`; return;
    }
    // The card sits above the skill row and above the "+" badges and the point button, so it covers none of them.
    let top = r.top;
    for (const el of cluster.querySelectorAll('.ability-upgrade:not([hidden]),#skill-points')) { const o = el.getBoundingClientRect(); if (o.height && o.bottom > 0) top = Math.min(top, o.top); }
    const x = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    card.style.left = `${x}px`; card.style.top = `${Math.max(8, top - h - 10)}px`;
  };
  const render = () => {
    const d = slot >= 0 && info(slot); if (!d) { hide(); return; }
    const ranks = Array.from({ length: d.maxRank }, (_, i) => `<i class="${i < d.rank ? 'filled' : ''}"></i>`).join('');
    const small = compact(); card.classList.toggle('compact', small);
    card.innerHTML = `<div class="skill-card-head"><kbd>${esc(d.key)}</kbd><strong>${esc(d.name)}</strong><span class="skill-card-ranks" aria-label="Rank ${d.rank} of ${d.maxRank}">${ranks}</span></div>`
      + (small
        ? `<p class="skill-card-meta"><span class="mana">${esc(d.cost)} mana</span><span>${esc(d.cooldown)}s</span>${d.status ? `<span class="skill-card-status ${d.ready ? 'ready' : ''}">${esc(d.status)}</span>` : ''}</p><p class="skill-card-text">${esc(firstSentence(d.description))}</p>`
        : `<p class="skill-card-meta"><span class="mana">${esc(d.cost)} mana</span><span>${esc(d.cooldown)}s cooldown</span>${d.tags ? `<span>${esc(d.tags)}</span>` : ''}</p>`
          + `<p class="skill-card-text">${esc(d.description)}</p>`
          + (d.status ? `<p class="skill-card-status ${d.ready ? 'ready' : ''}">${esc(d.status)}</p>` : ''));
    card.hidden = false; place();
  };
  const show = s => {
    clearTimeout(hideTimer);
    if (s !== slot) { slot = s; render(); } else if (card.hidden) render();
    clearInterval(refresh); refresh = setInterval(render, 250);
  };
  function hide() { clearTimeout(hideTimer); clearInterval(refresh); slot = -1; card.hidden = true; }
  const hideSoon = ms => { clearTimeout(hideTimer); hideTimer = setTimeout(hide, ms); };

  buttons.forEach((b, i) => {
    b.removeAttribute('title');
    b.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') show(i); });
    b.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && slot === i) hide(); });
    // Keyboard focus only: a tap also focuses the button, and the touch timer decides when that card goes.
    b.addEventListener('focus', () => { if (b.matches(':focus-visible')) show(i); });
    b.addEventListener('blur', () => { if (slot === i) hide(); });
  });
  // Touch: the press may land on a skill or on the reach layer between skills; both pick the nearest skill.
  cluster.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return;
    if (!e.target.closest?.('.ability,.skill-reach')) return;
    const b = e.target.closest('.ability') || nearestSkill(buttons, e.clientX, e.clientY);
    const i = buttons.indexOf(b); if (i < 0) return;
    show(i);
    const up = ev => { if (ev.pointerId !== e.pointerId) return; removeEventListener('pointerup', up, true); removeEventListener('pointercancel', up, true); hideSoon(TOUCH_HOLD_MS); };
    addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true);
  }, true);
  addEventListener('resize', () => { if (!card.hidden) place(); });
  return { show, hide, card };
}
