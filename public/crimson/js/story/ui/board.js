// js/story/ui/board.js : the evidence board (EVIDENCE in the menu). Four pinned slots, FACE, PLACE, DATE
// and LINK, each with the player's own photo (S.photo.thumb, else the small copy in the save, D7), its
// subject and score. A slot whose photo is gone shows a 'photo lost' card. Below, a strip of the latest
// photos. Arrows, the d-pad or taps move between slots; Esc or pad B closes it. The story clock stops.
import { EVIDENCE } from '../types.js';
import { esc } from './cards.js';

const NEED = { face: 'A clear photo of his face.', place: 'Where they keep the people.', date: 'When they move them.', link: 'Who owns the vans. Optional.' };

export function createBoard(U) {
  const { S, make, root } = U;
  const el = make('div', 'sBoard hidden', root, `<div class="bIn"><h3>THE EVIDENCE <small>VANCE NEEDS A FACE, A PLACE AND A DATE</small></h3><div class="slots"></div><h4>YOUR PHOTOS</h4><div class="strip"></div><p class="bHelp"></p><button type="button" class="bX" aria-label="Close the board">✕</button></div>`);
  el.id = 'sBoard';
  const slotsEl = el.querySelector('.slots'), strip = el.querySelector('.strip');
  let open = false, prevMode = 'play', fromMenu = false, focusI = 0;
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.addEventListener('click', (e) => { e.stopPropagation(); if (e.target.closest('.bX')) api.close(); const s = e.target.closest('.slot'); if (s) { focusI = +s.dataset.i; showFocus(); } });

  const photoOf = (id) => { if (!id) return null; const g = (S.photo && S.photo.gallery) || []; return g.find((p) => p && p.id === id) || null; };
  function thumbOf(id) {
    if (!id) return '';
    let url = '';
    try { url = (S.photo && S.photo.thumb && S.photo.thumb(id)) || ''; } catch (e) { url = ''; }
    if (!url) { try { const t = S.save && S.save.get().thumbs; url = (t && t[id]) || ''; } catch (e) { url = ''; } }
    return url;
  }
  function render() {
    const slots = (S.evidence && S.evidence.slots) || {};
    slotsEl.innerHTML = EVIDENCE.map((k, i) => {
      const id = slots[k], p = photoOf(id), url = thumbOf(id);
      const body = !id ? `<div class="ph empty"><b>?</b></div><p class="need">${esc(NEED[k])}</p>`
        : url ? `<div class="ph"><img alt="" src="${esc(url)}"></div><p class="cap">${esc(p ? p.subject || '' : '')}${p && p.score != null ? ` · ${Math.round(p.score)}` : ''}</p>`
          : `<div class="ph lost"><b>PHOTO LOST</b></div><p class="cap">The picture is gone. The notes stay.</p>`;
      return `<div class="slot ${id ? 'full' : ''}" data-i="${i}"><i class="pin"></i><p class="tag">${k.toUpperCase()}</p>${body}</div>`;
    }).join('');
    const g = ((S.photo && S.photo.gallery) || []).slice(-8).reverse();
    strip.innerHTML = g.length ? g.map((p) => { const u = thumbOf(p.id); return `<figure>${u ? `<img alt="" src="${esc(u)}">` : '<b>·</b>'}<figcaption>${esc(p.subject || '')}</figcaption></figure>`; }).join('') : '<p class="none">No photos yet. Press {camera} for the phone camera.</p>'.replace('{camera}', U.key('camera'));
    showFocus();
  }
  function showFocus() { [...slotsEl.children].forEach((s, i) => s.classList.toggle('sel', i === focusI)); }
  const api = {
    get isOpen() { return open; },
    open() {
      if (open) return;
      open = true; fromMenu = U.pieces.menu.api.isOpen;
      if (!fromMenu) { prevMode = S.mode; S.mode = 'menu'; }
      U.pushModal('evidence', false);
      U.input.unlock();
      focusI = 0; render();
      el.querySelector('.bHelp').textContent = U.touch ? 'TAP ✕ TO CLOSE' : U.device === 'pad' ? 'B CLOSES' : 'ESC CLOSES';
      el.classList.remove('hidden');
    },
    close() {
      if (!open) return;
      open = false; el.classList.add('hidden'); U.popModal('evidence');
      if (!fromMenu && S.mode === 'menu') S.mode = prevMode === 'menu' ? 'play' : prevMode;
    },
  };
  return {
    api,
    input(I) {
      if (!open) return false;
      if (I.pressed('back') || I.pressed('pause') || I.pressed('use')) { I.consume('back', 'pause'); I.consumeKeyActions(); api.close(); U.blip('back'); return true; }
      if (I.pressed('left') || I.pressed('up')) { focusI = (focusI + 3) % 4; showFocus(); U.blip('move'); }
      if (I.pressed('right') || I.pressed('down')) { focusI = (focusI + 1) % 4; showFocus(); U.blip('move'); }
      return true;
    },
    tick() {},
    reset() { if (open) { open = false; el.classList.add('hidden'); } },
  };
}
