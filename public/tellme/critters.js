// Painted-cottage SVG fallbacks. Same layers as the WebP look sheet:
// body, face_<state>, tail. WebP covers these when a file loads.
// Bram: slate, stocky, heavy-lidded. Fennel: rust, sharp, quick-eyed.
// Face states differ by brow, eye, and mouth shape. Sweat is two drops.

const INK = "#241C16";
const CREAM = "#F3E9D2";
const SCLERA = "#F4EBDD";

const EYE = {
  smug: { rx: 38, ry: 13, pr: 5.5 },
  calm: { rx: 28, ry: 26, pr: 8.5 },
  nervous: { rx: 32, ry: 32, pr: 4.2 },
  sweating: { rx: 38, ry: 38, pr: 7 },
};

const BROW = {
  smug: ["M108 126 Q150 90 190 118", "M206 148 Q240 162 280 144"],
  calm: ["M112 130 H186", "M198 130 H272"],
  nervous: ["M102 152 L174 114", "M210 114 L282 152"],
  sweating: ["M96 158 L146 84 L192 130", "M192 130 L238 84 L288 158"],
};

const MOUTH = {
  smug: `<path d="M144 226 Q196 216 248 194" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round"/>`,
  calm: `<path d="M164 222 H224" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round"/>`,
  nervous: `<path d="M134 218 Q154 200 174 220 Q196 240 216 216 Q236 194 256 216 Q270 230 284 210" fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>`,
  sweating:
    `<path d="M126 204 Q192 186 258 204 Q248 246 192 250 Q136 246 126 204 Z" fill="${INK}"/>` +
    `<path d="M148 208 Q192 222 236 208" fill="none" stroke="${CREAM}" stroke-width="8" stroke-linecap="round"/>`,
};

function drop(x, y, s) {
  const w = 26 * s;
  const h = 74 * s;
  return `<path d="M${x} ${y} C${x - w} ${y + h * 0.45} ${x - w * 0.82} ${y + h} ${x} ${y + h * 1.05} C${x + w * 0.82} ${y + h} ${x + w} ${y + h * 0.45} ${x} ${y} Z" fill="#F4EFE4" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>`;
}

function eye(who, side, cx, cy, state) {
  const { rx, ry, pr } = EYE[state];
  const id = `${who}-eye-${side}`;
  const fur = who === "bram" ? "#3E5870" : "#C4622E";
  let heavy = "";
  if (who === "bram" && (state === "smug" || state === "calm")) {
    heavy = `<path d="M${cx - rx} ${cy - ry * 0.15} Q${cx} ${cy - ry - 2} ${cx + rx} ${cy - ry * 0.15}" fill="none" stroke="#2C3C4E" stroke-width="12" stroke-linecap="round"/>`;
  }
  return (
    `<clipPath id="${id}"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/></clipPath>` +
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${SCLERA}" stroke="${INK}" stroke-width="7"/>` +
    `<g clip-path="url(#${id})"><circle class="pupil" cx="${cx}" cy="${cy + (state === "smug" ? 2 : 0)}" r="${pr}" fill="#1A1614"/></g>` +
    `<ellipse class="lid" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fur}"/>` +
    heavy
  );
}

export function faceInner(who, state) {
  const brows = BROW[state]
    .map((d) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>`)
    .join("");
  const eyes = eye(who, "l", 150, 158, state) + eye(who, "r", 234, 158, state);
  const sweat = state === "sweating" ? drop(48, 108, 1) + drop(336, 124, 1.05) : "";
  return `<g class="breathe">${brows}${eyes}${MOUTH[state]}${sweat}</g>`;
}

const bramBody = `<svg class="body-svg" viewBox="0 0 384 384" aria-hidden="true">
  <defs>
    <radialGradient id="bramFur" cx="38%" cy="28%" r="72%">
      <stop offset="0%" stop-color="#8EABC2"/>
      <stop offset="46%" stop-color="#5B7C99"/>
      <stop offset="100%" stop-color="#3A5368"/>
    </radialGradient>
    <radialGradient id="bramDeep" cx="50%" cy="20%" r="80%">
      <stop offset="0%" stop-color="#2C4154" stop-opacity="0"/>
      <stop offset="100%" stop-color="#1A2836" stop-opacity=".45"/>
    </radialGradient>
    <radialGradient id="bramRim" cx="50%" cy="0%" r="62%">
      <stop offset="0%" stop-color="#F2B84B" stop-opacity=".62"/>
      <stop offset="48%" stop-color="#F2B84B" stop-opacity=".16"/>
      <stop offset="100%" stop-color="#F2B84B" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="bramEar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#C4897C"/>
      <stop offset="55%" stop-color="#6E8CAA"/>
      <stop offset="100%" stop-color="#4A6884"/>
    </linearGradient>
  </defs>
  <ellipse cx="192" cy="348" rx="78" ry="12" fill="#0C1510" opacity=".38"/>
  <g class="breathe">
    <g class="ear ear-l">
      <ellipse cx="112" cy="112" rx="30" ry="34" fill="url(#bramFur)" stroke="#2A3848" stroke-width="5" stroke-opacity=".4"/>
      <ellipse cx="112" cy="116" rx="16" ry="20" fill="url(#bramEar)"/>
    </g>
    <g class="ear ear-r">
      <ellipse cx="272" cy="112" rx="30" ry="34" fill="url(#bramFur)" stroke="#2A3848" stroke-width="5" stroke-opacity=".4"/>
      <ellipse cx="272" cy="116" rx="16" ry="20" fill="url(#bramEar)"/>
    </g>
    <ellipse cx="192" cy="292" rx="96" ry="64" fill="url(#bramFur)" stroke="#2A3848" stroke-width="6" stroke-opacity=".35"/>
    <ellipse cx="150" cy="286" rx="28" ry="22" fill="#6E90AA" opacity=".45"/>
    <ellipse cx="236" cy="300" rx="32" ry="20" fill="#3E5870" opacity=".35"/>
    <ellipse cx="192" cy="312" rx="52" ry="34" fill="#E4D2B0"/>
    <ellipse cx="192" cy="318" rx="28" ry="16" fill="#F3E9D2" opacity=".55"/>
    <path d="M118 262 C86 292 96 328 132 338 C158 346 170 322 162 298 C154 274 146 260 118 262Z" fill="#4E6E8C" stroke="#2A3848" stroke-width="4" stroke-opacity=".3"/>
    <path d="M266 262 C298 292 288 328 252 338 C226 346 214 322 222 298 C230 274 238 260 266 262Z" fill="#4E6E8C" stroke="#2A3848" stroke-width="4" stroke-opacity=".3"/>
    <ellipse cx="140" cy="334" rx="26" ry="16" fill="#5B7C99" stroke="#2A3848" stroke-width="4" stroke-opacity=".35"/>
    <ellipse cx="244" cy="334" rx="26" ry="16" fill="#5B7C99" stroke="#2A3848" stroke-width="4" stroke-opacity=".35"/>
    <ellipse cx="128" cy="332" rx="7" ry="5" fill="#3E5870"/>
    <ellipse cx="140" cy="338" rx="7" ry="5" fill="#3E5870"/>
    <ellipse cx="154" cy="332" rx="7" ry="5" fill="#3E5870"/>
    <ellipse cx="230" cy="332" rx="7" ry="5" fill="#3E5870"/>
    <ellipse cx="244" cy="338" rx="7" ry="5" fill="#3E5870"/>
    <ellipse cx="258" cy="332" rx="7" ry="5" fill="#3E5870"/>
    <ellipse cx="192" cy="172" rx="104" ry="92" fill="url(#bramFur)" stroke="#2A3848" stroke-width="6" stroke-opacity=".38"/>
    <ellipse cx="150" cy="168" rx="46" ry="36" fill="#6A8AAA" opacity=".4"/>
    <ellipse cx="250" cy="186" rx="40" ry="30" fill="#3A5168" opacity=".32"/>
    <ellipse cx="124" cy="176" rx="30" ry="22" fill="#3A5168" opacity=".55"/>
    <ellipse cx="260" cy="176" rx="30" ry="22" fill="#3A5168" opacity=".55"/>
    <ellipse cx="192" cy="196" rx="100" ry="78" fill="url(#bramDeep)"/>
    <ellipse cx="118" cy="188" rx="22" ry="16" fill="#7E9BB4" opacity=".45"/>
    <ellipse cx="266" cy="188" rx="22" ry="16" fill="#7E9BB4" opacity=".45"/>
    <path d="M168 86 Q192 74 216 86 L224 176 Q192 198 160 176 Z" fill="${CREAM}"/>
    <path d="M176 92 Q192 86 208 92 L212 150 Q192 162 172 150 Z" fill="#F7F1E4" opacity=".7"/>
    <ellipse cx="192" cy="208" rx="46" ry="34" fill="${CREAM}"/>
    <ellipse cx="192" cy="214" rx="30" ry="18" fill="#E7D3B4" opacity=".65"/>
    <ellipse cx="192" cy="196" rx="15" ry="10" fill="#2C2824"/>
    <ellipse cx="188" cy="192" rx="5" ry="3" fill="#6A5348" opacity=".7"/>
    <g fill="none" stroke="#3A342C" stroke-width="2.4" stroke-linecap="round" opacity=".8">
      <path d="M148 196 C120 188 96 190 78 184"/>
      <path d="M150 206 C118 206 94 214 74 212"/>
      <path d="M148 214 C122 222 100 232 82 236"/>
      <path d="M236 196 C264 188 288 190 306 184"/>
      <path d="M234 206 C266 206 290 214 310 212"/>
      <path d="M236 214 C262 222 284 232 302 236"/>
    </g>
    <ellipse class="rim" cx="192" cy="118" rx="96" ry="58" fill="url(#bramRim)"/>
  </g>
</svg>`;

const fennelBody = `<svg class="body-svg" viewBox="0 0 384 384" aria-hidden="true">
  <defs>
    <radialGradient id="fenFur" cx="40%" cy="30%" r="74%">
      <stop offset="0%" stop-color="#F0A36E"/>
      <stop offset="42%" stop-color="#D9692B"/>
      <stop offset="100%" stop-color="#A3481C"/>
    </radialGradient>
    <radialGradient id="fenDeep" cx="50%" cy="18%" r="78%">
      <stop offset="0%" stop-color="#7A3414" stop-opacity="0"/>
      <stop offset="100%" stop-color="#5C280E" stop-opacity=".4"/>
    </radialGradient>
    <radialGradient id="fenRim" cx="50%" cy="0%" r="60%">
      <stop offset="0%" stop-color="#F2B84B" stop-opacity=".58"/>
      <stop offset="50%" stop-color="#F2B84B" stop-opacity=".14"/>
      <stop offset="100%" stop-color="#F2B84B" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="192" cy="348" rx="64" ry="11" fill="#0C1510" opacity=".38"/>
  <g class="breathe">
    <g class="ear ear-l">
      <path d="M156 146 L118 26 L196 128 Z" fill="url(#fenFur)" stroke="#6A3014" stroke-width="5" stroke-opacity=".45" stroke-linejoin="round"/>
      <path d="M154 132 L132 52 L182 122 Z" fill="#F0B09A"/>
    </g>
    <g class="ear ear-r">
      <path d="M228 146 L266 26 L188 128 Z" fill="url(#fenFur)" stroke="#6A3014" stroke-width="5" stroke-opacity=".45" stroke-linejoin="round"/>
      <path d="M230 132 L252 52 L202 122 Z" fill="#F0B09A"/>
    </g>
    <ellipse cx="192" cy="294" rx="62" ry="58" fill="url(#fenFur)" stroke="#6A3014" stroke-width="6" stroke-opacity=".35"/>
    <ellipse cx="160" cy="286" rx="20" ry="28" fill="#E88850" opacity=".4"/>
    <ellipse cx="220" cy="300" rx="18" ry="22" fill="#A3481C" opacity=".28"/>
    <ellipse cx="192" cy="304" rx="34" ry="40" fill="#F7F1E6"/>
    <path d="M138 268 C112 294 118 326 146 334 C164 340 172 316 166 298 C158 278 152 266 138 268Z" fill="#C45A24" stroke="#6A3014" stroke-width="4" stroke-opacity=".3"/>
    <path d="M246 268 C272 294 266 326 238 334 C220 340 212 316 218 298 C226 278 232 266 246 268Z" fill="#C45A24" stroke="#6A3014" stroke-width="4" stroke-opacity=".3"/>
    <ellipse cx="150" cy="332" rx="18" ry="12" fill="#D9692B" stroke="#6A3014" stroke-width="4" stroke-opacity=".3"/>
    <ellipse cx="234" cy="332" rx="18" ry="12" fill="#D9692B" stroke="#6A3014" stroke-width="4" stroke-opacity=".3"/>
    <ellipse cx="192" cy="176" rx="78" ry="68" fill="url(#fenFur)" stroke="#6A3014" stroke-width="6" stroke-opacity=".38"/>
    <ellipse cx="160" cy="170" rx="28" ry="22" fill="#E8894E" opacity=".45"/>
    <ellipse cx="230" cy="188" rx="26" ry="18" fill="#B8501E" opacity=".3"/>
    <ellipse cx="192" cy="200" rx="76" ry="58" fill="url(#fenDeep)"/>
    <ellipse cx="128" cy="186" rx="20" ry="14" fill="#F6E0C8" opacity=".8"/>
    <ellipse cx="256" cy="186" rx="20" ry="14" fill="#F6E0C8" opacity=".8"/>
    <ellipse cx="192" cy="214" rx="32" ry="28" fill="#F8E6D0"/>
    <ellipse cx="192" cy="224" rx="18" ry="12" fill="#E7CDB4" opacity=".55"/>
    <ellipse cx="192" cy="198" rx="11" ry="8" fill="#2C241C"/>
    <ellipse cx="189" cy="195" rx="3.5" ry="2.2" fill="#8A624E" opacity=".65"/>
    <g fill="none" stroke="#3A342C" stroke-width="2.2" stroke-linecap="round" opacity=".75">
      <path d="M164 196 C140 186 112 184 90 176"/>
      <path d="M166 206 C138 204 114 214 92 210"/>
      <path d="M164 214 C142 222 118 232 98 234"/>
      <path d="M220 196 C244 186 272 184 294 176"/>
      <path d="M218 206 C246 204 270 214 292 210"/>
      <path d="M220 214 C242 222 266 232 286 234"/>
    </g>
    <ellipse class="rim" cx="192" cy="130" rx="74" ry="48" fill="url(#fenRim)"/>
  </g>
</svg>`;

const bramTail = `<svg class="tail-svg" viewBox="0 0 384 384" aria-hidden="true">
  <defs>
    <linearGradient id="bramTailGrad" x1="0.2" y1="1" x2="0.6" y2="0">
      <stop offset="0%" stop-color="#3A5368"/>
      <stop offset="38%" stop-color="#5B7C99"/>
      <stop offset="62%" stop-color="#8AA6BC"/>
      <stop offset="100%" stop-color="#F3E9D2"/>
    </linearGradient>
  </defs>
  <path d="M274 298 C308 274 356 250 364 196 C372 142 352 92 326 66 C308 48 286 64 294 88 C306 124 320 162 306 206 C292 250 262 272 246 294 C258 300 266 302 274 298Z" fill="url(#bramTailGrad)" stroke="#2A3848" stroke-width="5" stroke-opacity=".4" stroke-linejoin="round"/>
  <ellipse cx="332" cy="150" rx="22" ry="34" fill="#6E90AA" opacity=".35"/>
  <ellipse cx="328" cy="62" rx="32" ry="38" fill="#F3E9D2" stroke="#2A3848" stroke-width="4" stroke-opacity=".28"/>
  <ellipse cx="336" cy="48" rx="16" ry="16" fill="#F7F3EA"/>
</svg>`;

const fennelTail = `<svg class="tail-svg" viewBox="0 0 384 384" aria-hidden="true">
  <defs>
    <linearGradient id="fenTailGrad" x1="0.15" y1="1" x2="0.7" y2="0">
      <stop offset="0%" stop-color="#8A3E16"/>
      <stop offset="36%" stop-color="#D9692B"/>
      <stop offset="60%" stop-color="#E8894E"/>
      <stop offset="100%" stop-color="#F7F4EE"/>
    </linearGradient>
  </defs>
  <path d="M286 292 C324 266 372 240 376 182 C380 124 358 74 330 48 C312 32 290 50 300 74 C314 112 330 154 314 198 C298 244 270 266 254 290 C268 298 278 298 286 292Z" fill="url(#fenTailGrad)" stroke="#6A3014" stroke-width="5" stroke-opacity=".4" stroke-linejoin="round"/>
  <ellipse cx="348" cy="140" rx="20" ry="32" fill="#E07A3A" opacity=".4"/>
  <ellipse cx="338" cy="46" rx="30" ry="36" fill="#F7F4EE" stroke="#6A3A22" stroke-width="4" stroke-opacity=".28"/>
  <ellipse cx="346" cy="34" rx="14" ry="14" fill="#FFFcf7"/>
</svg>`;

export function mountCritters() {
  document.querySelector(".critter.bram .body-ph").innerHTML = bramBody;
  document.querySelector(".critter.fennel .body-ph").innerHTML = fennelBody;
  document.querySelector(".critter.bram .tail-ph").innerHTML = bramTail;
  document.querySelector(".critter.fennel .tail-ph").innerHTML = fennelTail;
}
