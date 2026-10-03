import { HEROES } from './sim.js';
import { spellArtHTML } from './spell-art.js';
import { HERO_IDENTITIES, identitySkill } from './hero-identities.js';
export const ROLES=['All','Carry','Bruiser','Mage','Support','Initiator'];
export const ROLE_ICONS=['trident','crossed-swords','shield','fire','holy-grail','water-drop'];
export const SELECTION_KEYS=['Q','E','C','R'];
const FAL_POSITIONS=['0% 0%','100% 0%','0% 100%','100% 100%'];
const portrait=(id)=>{
 const x=[17,129,243,361][id%4],y=[253,379,501,623][Math.floor(id/4)];
 return `<span class="reference-portrait" style="--portrait-x:${x};--portrait-y:${y}" aria-hidden="true"></span>`;
};
export const rosterHTML=(selected,filter='All')=>HERO_IDENTITIES.filter(h=>filter==='All'||h.filters.includes(filter)).map(h=>`<button data-hero="${h.id}" aria-pressed="${h.id===selected}" aria-label="Select ${h.name}" style="--hero-color:${h.color}">${portrait(h.id)}<span class="hero-card-name">${h.name}</span></button>`).join('');
export function selectionSpellArt(identity,slot,className=''){
 if(identity===0)return `<span class="painted-spell fal-tidewarden-spell ${className}" style="background-image:url('./art/spells/tidewarden-fal.webp');background-position:${FAL_POSITIONS[slot]}" aria-hidden="true"></span>`;
 return spellArtHTML(HERO_IDENTITIES[identity].kit,slot,className);
}
export function heroPreviewHTML(identity,activeSlot=1){
 const p=HERO_IDENTITIES[identity],h=HEROES[p.kit];
 return `<div class="hero-move-preview" aria-label="${p.name} skills">${p.skills.map((name,slot)=>{
 const a=identitySkill(identity,slot);
 return `<button data-hero-spell="${slot}" aria-label="${name}. ${a.description}" aria-pressed="${slot===activeSlot}" title="${name}: ${a.description}">${selectionSpellArt(identity,slot,'preview-spell-art')}<span>${name}</span><kbd>${SELECTION_KEYS[slot]}</kbd></button>`;
 }).join('')}</div><span class="sr-only">${h.attribute}, ${h.attackType}, ${h.hp} health</span>`;
}
