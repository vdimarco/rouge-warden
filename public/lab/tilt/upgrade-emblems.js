// Celestial instrument engravings. Geometry stays crisp at every panel size.
const ivory = '#fff1cc';
const brass = '#d6b679';
const mint = '#c6f8e8';

const star = (x, y, size = 4, color = ivory) =>
  `<path d="M${x} ${y-size} Q${x} ${y} ${x+size} ${y} Q${x} ${y} ${x} ${y+size} Q${x} ${y} ${x-size} ${y} Q${x} ${y} ${x} ${y-size}Z" fill="${color}" stroke="none"/>`;

function frame(id, drawing) {
  const prefix = `celestial-emblem-${id}`;
  return `<svg class="celestial-emblem celestial-emblem-${id}" viewBox="0 0 240 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="${prefix}-aura">
        <stop offset="0" stop-color="${ivory}" stop-opacity=".48"/>
        <stop offset=".34" stop-color="${mint}" stop-opacity=".18"/>
        <stop offset="1" stop-color="${mint}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="${prefix}-core" cx=".4" cy=".35" r=".7">
        <stop offset="0" stop-color="#fffdf0"/>
        <stop offset=".55" stop-color="${ivory}"/>
        <stop offset="1" stop-color="${brass}"/>
      </radialGradient>
      <linearGradient id="${prefix}-tail" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stop-color="${mint}" stop-opacity=".3"/>
        <stop offset=".3" stop-color="${ivory}"/>
        <stop offset="1" stop-color="${brass}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <g fill="none" stroke="${brass}" stroke-width=".85" stroke-linecap="round" stroke-linejoin="round">
      ${drawing(prefix)}
    </g>
  </svg>`;
}

const diagrams = {
  pulse: prefix => `
    <g class="emblem-orbit">
      <circle cx="120" cy="80" r="63" stroke-dasharray=".6 3" opacity=".65"/>
      <circle cx="120" cy="80" r="49"/>
      <circle cx="120" cy="80" r="36" stroke="${mint}" opacity=".75"/>
      <circle cx="120" cy="80" r="24" stroke-dasharray=".6 2.2" opacity=".65"/>
      <path d="M120 8V152 M112 31h16 M112 129h16 M69 80h13 M158 80h13" opacity=".6"/>
      <circle cx="120" cy="18" r="2" fill="${ivory}" stroke="none"/>
      <circle cx="76" cy="36" r="1.6" fill="${ivory}" stroke="none"/>
      <circle cx="161" cy="129" r="3" fill="${ivory}" stroke="none"/>
    </g>
    <circle cx="120" cy="80" r="34" fill="url(#${prefix}-aura)" stroke="none"/>
    <g stroke="${mint}">
      <path d="M10 80C24 85 26 79 36 72S54 70 62 79S78 93 98 92 M142 92C162 93 170 88 178 79S194 65 204 72S218 84 230 80" opacity=".65"/>
      <path d="M13 80C29 86 32 65 45 65S62 81 72 87S87 90 99 87 M141 87C153 90 158 89 168 87S182 65 195 65S211 86 227 80" stroke-width="1.1"/>
      <path d="M24 77C37 55 49 54 61 70S78 88 99 83 M141 83C162 88 167 86 179 70S203 55 216 77" stroke-width="1.2" opacity=".92"/>
    </g>
    <circle class="emblem-core" cx="120" cy="80" r="11" fill="url(#${prefix}-core)" stroke="${ivory}" stroke-width=".6"/>
    ${star(47,88,4)}${star(193,88,4)}${star(120,144,3)}
  `,
  shield: prefix => `
    <g class="emblem-orbit">
      <circle cx="120" cy="80" r="63" stroke-dasharray=".6 3" opacity=".65"/>
      <path d="M120 7V26 M120 139V153" opacity=".75"/>
      <ellipse cx="120" cy="81" rx="99" ry="27" transform="rotate(-19 120 81)"/>
      <circle cx="120" cy="17" r="2.2" fill="${ivory}" stroke="none"/>
      <circle cx="187" cy="40" r="3.2" fill="${ivory}" stroke="none"/>
      <circle cx="56" cy="121" r="4.2" fill="${ivory}" stroke="none"/>
      <circle cx="199" cy="72" r="1.7" fill="${ivory}" stroke="none"/>
    </g>
    <path d="M120 34C108 43 95 47 82 49C83 94 92 112 120 129C148 112 157 94 158 49C145 47 132 43 120 34Z" fill="#061923" fill-opacity=".87" stroke="${ivory}" stroke-width="1.5"/>
    <path d="M120 39C108 48 99 50 87 53C89 92 98 108 120 122C142 108 151 92 153 53C141 50 132 48 120 39Z" opacity=".25"/>
    <circle cx="120" cy="79" r="31" fill="url(#${prefix}-aura)" stroke="none"/>
    <circle cx="120" cy="79" r="22" stroke="${mint}" opacity=".85"/>
    <path d="M120 47V112 M89 79h62" stroke="${mint}" opacity=".65"/>
    <g class="emblem-core">${star(120,79,16)}</g>
    <circle cx="120" cy="141" r="1.8" fill="${ivory}" stroke="none"/>
    ${star(120,9,2.6)}${star(120,149,2.6)}${star(72,85,2)}
  `,
  comet: prefix => `
    <g class="emblem-orbit">
      <circle cx="120" cy="80" r="62" stroke-dasharray=".6 3" opacity=".48"/>
      <path d="M120 8V25 M120 136V153" opacity=".65"/>
      <ellipse cx="120" cy="80" rx="99" ry="31" transform="rotate(-31 120 80)" stroke="${ivory}"/>
      <circle cx="53" cy="129" r="3.4" fill="${ivory}" stroke="none"/>
      <circle cx="120" cy="44" r="1.8" fill="${ivory}" stroke="none"/>
    </g>
    <circle cx="91" cy="91" r="32" fill="url(#${prefix}-aura)" stroke="none"/>
    <g stroke="url(#${prefix}-tail)">
      <path d="M95 76L189 41L110 79L175 45L106 72L190 35" stroke-width="1.1"/>
      <path d="M107 87L190 42L123 69L177 41" stroke-width="1.35"/>
      <path d="M102 101L187 53L124 82L170 56" stroke-width="1.1"/>
      <path d="M109 91L179 50 M110 75L161 39 M112 97L171 65" stroke-width=".75"/>
      <path d="M91 74Q128 57 179 40 M108 102Q141 89 180 57" stroke-width=".7" opacity=".6"/>
    </g>
    <circle cx="91" cy="91" r="16" stroke="${mint}" opacity=".45"/>
    <circle class="emblem-core" cx="91" cy="91" r="11.5" fill="url(#${prefix}-core)" stroke="${ivory}" stroke-width=".6"/>
    ${star(60,53,3)}${star(192,94,5)}${star(120,18,2.5)}${star(120,142,2.5)}
  `,
};

export function upgradeEmblem(id) {
  return Object.hasOwn(diagrams, id) ? frame(id, diagrams[id]) : '';
}
