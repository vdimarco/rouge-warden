// Gloam Downs: the focus in the cards (the help card, the Map, the end card, the run's cards and the loading screen). The focus stays
// on the open card's own buttons: Tab, the d-pad and the left stick move it, and it wraps at the ends, so it never reaches ◀ Lab or
// Games behind the card (the dialog pattern of WAI-ARIA). A on a pad, and Space or Enter on keys, press the focused button. When a
// card opens, its main button takes the focus. A button that is off but still shown (aria-disabled) keeps the focus.
export const wrapIndex = (i, n, d) => (((i + d) % n) + n) % n;
// the buttons of a card that can take the focus, in their order on the page
export const buttonsOf = box => [...box.querySelectorAll('button')].filter(b => !b.disabled && !b.hidden && b.getClientRects().length > 0);

// the open card: { el, main() -> its main button, back() -> true when it went back, or null }
let open = null;
export const current = () => (open && !open.el.hidden && !open.el.classList.contains('done') ? open : null);
export function show(card) {
  open = card;
  focusMain();
  return card;
}
export function shut(el) { if (open && (!el || open.el === el)) open = null; }
export function focusMain() {
  const c = current();
  if (!c) return;
  const b = c.main?.() || buttonsOf(c.el)[0];
  b?.focus({ preventScroll: true });
}
export function move(d) {
  const c = current();
  if (!c) return;
  const list = buttonsOf(c.el);
  if (!list.length) return;
  const i = list.indexOf(document.activeElement);
  const b = list[i < 0 ? (d > 0 ? 0 : list.length - 1) : wrapIndex(i, list.length, d)];
  b.focus({ preventScroll: true });
  // a long card (the Lamp-room with its unlocks) scrolls inside itself, so the focused button is in view with keys or a pad alone
  b.scrollIntoView?.({ block: 'nearest' });
}
// press the focused button, or the main button when the focus is outside the card -> the button pressed
export function press() {
  const c = current();
  if (!c) return null;
  const list = buttonsOf(c.el);
  const b = list.includes(document.activeElement) ? document.activeElement : c.main?.() || list[0];
  if (!b || b.getAttribute('aria-disabled') === 'true') return null;
  b.click();
  return b;
}
// Tab and Shift+Tab move only between the open card's buttons
addEventListener('keydown', e => {
  if (e.key !== 'Tab' || !current()) return;
  e.preventDefault();
  move(e.shiftKey ? -1 : 1);
}, true);
