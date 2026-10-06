// Skill presses go to the nearest skill. A layer under the skill buttons catches presses in the gaps of the cluster.
const disc = el => { const r = el.getBoundingClientRect(); return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2, r: Math.min(r.right - r.left, r.bottom - r.top) / 2 }; };

// The skill with the nearest disc edge. A press inside a disc always reaches the skill of that disc.
export function nearestSkill(buttons, x, y) {
  let best = null, gap = Infinity;
  for (const b of buttons) { const d = disc(b), g = Math.hypot(x - d.x, y - d.y) - d.r; if (g < gap) { gap = g; best = b; } }
  return best;
}

// The layer has a rim around each skill and a plate that joins the skill centres. It sits under the buttons, so the
// buttons, the "+" badges and the other controls of the cluster stay on top.
export function skillReach(buttons, onPress, rim = 10) {
  const cluster = buttons[0]?.parentElement;
  if (!cluster || typeof document === 'undefined') return null;
  const layer = document.createElement('div'); layer.className = 'skill-reach'; layer.setAttribute('aria-hidden', 'true');
  const rims = buttons.map(() => layer.appendChild(document.createElement('i'))), plate = layer.appendChild(document.createElement('b'));
  cluster.prepend(layer);
  const place = () => {
    const box = cluster.getBoundingClientRect(); if (!box.width) return;
    const k = cluster.offsetWidth / box.width, at = buttons.map(b => { const d = disc(b); return { x: (d.x - box.left) * k, y: (d.y - box.top) * k, r: d.r * k }; });
    at.forEach((d, i) => Object.assign(rims[i].style, { left: `${d.x - d.r - rim}px`, top: `${d.y - d.r - rim}px`, width: `${2 * (d.r + rim)}px`, height: `${2 * (d.r + rim)}px` }));
    const cx = at.reduce((s, d) => s + d.x, 0) / at.length, cy = at.reduce((s, d) => s + d.y, 0) / at.length;
    plate.style.clipPath = `polygon(${at.map(d => [Math.atan2(d.y - cy, d.x - cx), d]).sort((a, b) => a[0] - b[0]).map(([, d]) => `${d.x}px ${d.y}px`).join(',')})`;
  };
  if (typeof ResizeObserver !== 'undefined') { const watch = new ResizeObserver(place); watch.observe(cluster); buttons.forEach(b => watch.observe(b)); }
  addEventListener('resize', place); place();
  layer.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); onPress(nearestSkill(buttons, e.clientX, e.clientY), e); });
  return { place };
}
