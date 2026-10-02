import { HEROES } from './sim.js';
import { KITS } from './abilities.js';
import { spellArtHTML } from './spell-art.js';
export const ROLES=['All','Assassin','Fighter','Tank','Mage','Support','Controller'];
export const rosterHTML=(selected,filter='All')=>HEROES.map((h,i)=>({h,i})).filter(({h})=>filter==='All'||h.category===filter).map(({h,i})=>`<button data-hero="${i}" aria-pressed="${i===selected}" style="--hero-color:${h.color}"><img src="./art/illustrated/${h.slug}-front.webp" alt=""><span>${h.name}<small>${h.category}</small></span></button>`).join('');
export const heroPreviewHTML=i=>`<dl class="hero-stats"><div><dt>Health</dt><dd>${HEROES[i].hp}</dd></div><div><dt>Attack</dt><dd>${HEROES[i].range>250?'Ranged':'Melee'}</dd></div><div><dt>Play style</dt><dd>${['Direct','Tactical','Advanced'][(HEROES[i].complexity||2)-1]}</dd></div></dl><div class="hero-move-preview" aria-label="${HEROES[i].name} spells">${KITS[i].map((a,slot)=>`<button data-hero-spell="${slot}" aria-label="Preview ${a.name}">${spellArtHTML(i,slot,'preview-spell-art')}<span>${a.name}<small>${slot===3?'Ultimate · Level 6':['Q','E','C'][slot]}</small></span></button>`).join('')}</div>`;
