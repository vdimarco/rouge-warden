// The parts of the Reel It In art, as SVG strings: the painted water, the rings, the glints and the bobber, in a 1024 x 1024
// space. render-art.mjs draws the icons, the splash and the Play graphics from them; qa/fish/store-video.mjs draws the
// video's background and end card.
// The game's palette (public/fish/index.html :root)
export const C = { deep: "#0d2f38", deep2: "#134451", ink: "#f6efd9", red: "#e0453a", brass: "#e8b64a", cream: "#fff6dc" };

// ---------- the parts of the picture, in a 1024 x 1024 space ----------

export const defs = `
<defs>
  <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0a2730"/>
    <stop offset="0.38" stop-color="#145257"/>
    <stop offset="0.66" stop-color="#1d7469"/>
    <stop offset="1" stop-color="#0c3940"/>
  </linearGradient>
  <radialGradient id="glow" cx="0.5" cy="0.6" r="0.55">
    <stop offset="0" stop-color="#ffd27a" stop-opacity="0.7"/>
    <stop offset="0.32" stop-color="${C.brass}" stop-opacity="0.3"/>
    <stop offset="1" stop-color="${C.brass}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.72">
    <stop offset="0.6" stop-color="#04161b" stop-opacity="0"/>
    <stop offset="1" stop-color="#04161b" stop-opacity="0.55"/>
  </radialGradient>
  <radialGradient id="redTop" cx="0.36" cy="0.3" r="0.8">
    <stop offset="0" stop-color="#ff8a72"/>
    <stop offset="0.35" stop-color="#ec4f3f"/>
    <stop offset="0.8" stop-color="#b8302a"/>
    <stop offset="1" stop-color="#7e1c17"/>
  </radialGradient>
  <radialGradient id="creamBottom" cx="0.38" cy="0.15" r="0.95">
    <stop offset="0" stop-color="#ffffff"/>
    <stop offset="0.45" stop-color="${C.ink}"/>
    <stop offset="0.85" stop-color="#cdbf9c"/>
    <stop offset="1" stop-color="#8f7f5c"/>
  </radialGradient>
  <linearGradient id="brassBand" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#9c6b1c"/>
    <stop offset="0.3" stop-color="#f7d37a"/>
    <stop offset="0.55" stop-color="${C.brass}"/>
    <stop offset="1" stop-color="#8a5c16"/>
  </linearGradient>
  <linearGradient id="stick" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#8a5c16"/>
    <stop offset="0.45" stop-color="#f7d37a"/>
    <stop offset="1" stop-color="#a87a22"/>
  </linearGradient>
  <filter id="brush" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.011 0.045" numOctaves="3" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="26" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="brushSoft" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="3" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="wobble" x="-20%" y="-20%" width="140%" height="140%">
    <feTurbulence type="fractalNoise" baseFrequency="0.006 0.09" numOctaves="2" seed="11" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="34" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="2.5"/>
  </filter>
  <filter id="blur8"><feGaussianBlur stdDeviation="8"/></filter>
  <filter id="blur3"><feGaussianBlur stdDeviation="3"/></filter>
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="5" result="t"/>
    <feColorMatrix in="t" type="matrix" values="0 0 0 0 1  0 0 0 0 0.96  0 0 0 0 0.85  0 0 0 0.09 0"/>
    <feComposite in2="SourceGraphic" operator="in"/>
  </filter>
</defs>`;

// Painted water: the gradient, long soft strokes, the warm glow and a vignette.
export function water({ glow = true, vignette = true } = {}) {
  const strokes = [];
  const rows = [
    [140, "#0f3c45", 0.55], [205, "#1a6464", 0.45], [262, "#123f48", 0.5], [330, "#2a8577", 0.35], [395, "#174f55", 0.45],
    [455, "#3a9b86", 0.28], [520, "#1b6a66", 0.4], [690, "#2f8c7b", 0.38], [760, "#145055", 0.5], [830, "#3e9f8a", 0.25], [905, "#0f3e46", 0.55],
  ];
  rows.forEach(([y, c, o], i) => {
    const w = 18 + (i % 3) * 8;
    strokes.push(`<path d="M-40 ${y} C 200 ${y - 22}, 380 ${y + 20}, 560 ${y - 6} S 900 ${y + 16}, 1070 ${y - 4}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" fill="none" opacity="${o}"/>`);
  });
  // short light dabs that catch the sky
  const dabs = [[170, 300, 90], [760, 250, 120], [300, 430, 70], [820, 470, 80], [140, 760, 110], [690, 860, 95], [420, 930, 70], [880, 700, 60]]
    .map(([x, y, l]) => `<path d="M${x} ${y} q ${l / 2} -8 ${l} 0" stroke="#7cc6b0" stroke-width="7" stroke-linecap="round" fill="none" opacity="0.35"/>`).join("");
  return `<rect width="1024" height="1024" fill="url(#water)"/>
  <g filter="url(#brush)">${strokes.join("")}${dabs}</g>
  ${glow ? `<rect width="1024" height="1024" fill="url(#glow)"/>` : ""}
  ${vignette ? `<rect width="1024" height="1024" fill="url(#vignette)"/>` : ""}`;
}

// Rings in the water around the bobber, wobbled by the brush.
export function ripples({ cx = 512, cy = 604, rings = [[230, 54, 0.75, 9], [330, 86, 0.45, 7], [440, 120, 0.25, 6]] } = {}) {
  return `<g filter="url(#brushSoft)" fill="none" stroke="${C.cream}" stroke-linecap="round">
    ${rings.map(([rx, ry, o, w]) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" stroke-width="${w}" opacity="${o}" stroke-dasharray="${rx * 1.1} ${rx * 0.18}"/>`).join("")}
  </g>`;
}

// Glints of light on the water.
export function sparkles(list) {
  return list.map(([x, y, s, o = 0.9]) => `<path d="M${x} ${y - s} Q ${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y} Q ${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s} Q ${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y} Q ${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s} Z" fill="#fff2c4" opacity="${o}"/>`).join("");
}

// The bobber: a red top, a cream bottom, a brass band and a brass stick with a red tip. Centre (cx, cy), radius r.
export function bobberBody(cx, cy, r) {
  const band = r * 0.13;
  return `<g transform="rotate(-10 ${cx} ${cy})">
    <!-- stick -->
    <rect x="${cx - r * 0.07}" y="${cy - r * 1.62}" width="${r * 0.14}" height="${r * 0.8}" rx="${r * 0.07}" fill="url(#stick)"/>
    <circle cx="${cx}" cy="${cy - r * 1.64}" r="${r * 0.15}" fill="url(#redTop)"/>
    <circle cx="${cx - r * 0.05}" cy="${cy - r * 1.69}" r="${r * 0.05}" fill="#ffd9cf" opacity="0.85"/>
    <!-- body -->
    <g filter="url(#brushSoft)">
      <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy} Z" fill="url(#redTop)"/>
      <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy} Z" fill="url(#creamBottom)"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${r * 1.005}" ry="${band}" fill="url(#brassBand)"/>
      <ellipse cx="${cx}" cy="${cy - band * 0.35}" rx="${r * 0.9}" ry="${band * 0.28}" fill="#fff0b8" opacity="0.55"/>
    </g>
    <!-- shine and a dark rim, so the shape holds at 60 px -->
    <ellipse cx="${cx - r * 0.38}" cy="${cy - r * 0.52}" rx="${r * 0.3}" ry="${r * 0.17}" transform="rotate(-32 ${cx - r * 0.38} ${cy - r * 0.52})" fill="#ffffff" opacity="0.6" filter="url(#blur3)"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#3b1110" stroke-width="${r * 0.035}" opacity="0.55"/>
  </g>`;
}

// The bobber sitting in the water: the part above the waterline, a shadow and a wobbly reflection below it.
let clipId = 0;
export function bobber({ cx = 512, cy = 520, r = 190 } = {}) {
  const wy = cy + r * 0.42, id = ++clipId;
  // a gently waving waterline across the picture
  const line = `C ${cx + r * 2} ${wy + 8}, ${cx + r} ${wy - 8}, ${cx} ${wy} S ${cx - r * 2} ${wy - 8}, -100 ${wy}`;
  return `
  <clipPath id="above${id}"><path d="M-100 -100 H1124 V${wy} ${line} Z"/></clipPath>
  <clipPath id="below${id}"><path d="M-100 1124 H1124 V${wy} ${line} Z"/></clipPath>
  <ellipse cx="${cx}" cy="${wy + r * 0.05}" rx="${r * 1.05}" ry="${r * 0.2}" fill="#06222a" opacity="0.45" filter="url(#blur8)"/>
  <linearGradient id="fadeG${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${wy}" x2="0" y2="${wy + r * 1.25}">
    <stop offset="0" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>
  <mask id="fade${id}" maskUnits="userSpaceOnUse" x="-100" y="-100" width="1224" height="1224"><rect x="-100" y="${wy}" width="1224" height="${r * 1.4}" fill="url(#fadeG${id})"/></mask>
  <g clip-path="url(#below${id})" mask="url(#fade${id})">
    <g filter="url(#wobble)"><g transform="translate(0 ${2 * wy}) scale(1 -1)">${bobberBody(cx, cy, r)}</g></g>
  </g>
  <g clip-path="url(#above${id})">${bobberBody(cx, cy, r)}</g>
  <path d="M ${cx - r * 1.02} ${wy} C ${cx - r * 0.5} ${wy + r * 0.08}, ${cx + r * 0.5} ${wy - r * 0.08}, ${cx + r * 1.02} ${wy}" stroke="${C.cream}" stroke-width="${r * 0.05}" fill="none" opacity="0.8" stroke-linecap="round" filter="url(#brushSoft)"/>`;
}

export function fishingLine(x, y) {
  return `<path d="M ${x} ${y} C ${x + 120} ${y - 160}, ${x + 260} ${y - 300}, 1100 -60" stroke="${C.cream}" stroke-width="4" fill="none" opacity="0.7"/>`;
}

// The point at the top of the stick, after the -10 degree turn of bobberBody.
export function stickTip(cx, cy, r) {
  const a = (-10 * Math.PI) / 180, dx = 0, dy = -r * 1.78;
  return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
}

export function svg(body, { w = 1024, h = 1024, viewBox = "0 0 1024 1024" } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid slice">${defs}${body}</svg>`;
}
