import { HEROES } from './sim.js';
import { spellArtHTML } from './spell-art.js';
import { HERO_IDENTITIES, identitySkill } from './hero-identities.js';
export const ROLES=['All','Carry','Bruiser','Mage','Support','Initiator'];
export const ROLE_ICONS=['trident','crossed-swords','shield','fire','holy-grail','water-drop'];
export const SELECTION_KEYS=['Q','E','C','R'];
const FAL_POSITIONS=['0% 0%','100% 0%','0% 100%','100% 100%'];
const FAL_ATLASES=new Set(['tidewarden','embersong','skyreaver','dredge']);
// Portraits are rendered from the 3D hero models (qa/tidebreak/render-portraits.mjs), so menus and match show the same
// heroes: 'bust' is a 512 px square of head and shoulders, 'full' a 768x1024 standing figure on a clear background.
export const portraitURL=(slug,kind='bust')=>`./art/portraits/${slug}-${kind}.webp`;
const portrait=(id)=>`<span class="reference-portrait hero-portrait" style="background-image:url('${portraitURL(HERO_IDENTITIES[id].slug)}')" aria-hidden="true"></span>`;
export const rosterHTML=(selected,filter='All')=>HERO_IDENTITIES.filter(h=>filter==='All'||h.filters.includes(filter)).map(h=>`<button data-hero="${h.id}" aria-pressed="${h.id===selected}" aria-label="Select ${h.name}" style="--hero-color:${h.color}">${portrait(h.id)}<span class="hero-card-name">${h.name}</span></button>`).join('');
export function selectionSpellArt(identity,slot,className=''){
 const profile=HERO_IDENTITIES[identity];
 if(FAL_ATLASES.has(profile.slug))return `<span class="painted-spell fal-identity-spell ${className}" style="background-image:url('./art/spells/${profile.slug}-fal.webp');background-position:${FAL_POSITIONS[slot]}" aria-hidden="true"></span>`;
 return spellArtHTML(profile.kit,slot,className);
}

export function hudSpellArt(identity,slot,className=''){
 const profile=HERO_IDENTITIES[identity],fallback=HEROES[profile.kit].slug;
 const atlas=FAL_ATLASES.has(profile.slug)?`/tidebreak/art/spells/${profile.slug}-fal.webp`:`/tidebreak/art/spells/${fallback}-spells.webp`;
 const col=slot%2,row=Math.floor(slot/2);
 return `<span class="hud-atlas-crop ${className}" aria-hidden="true"><img src="${atlas}" alt="" style="--hud-col:${col};--hud-row:${row}"></span>`;
}
export function heroPreviewHTML(identity,activeSlot=1){
 const p=HERO_IDENTITIES[identity],h=HEROES[p.kit];
 return `<div class="hero-move-preview" aria-label="${p.name} skills">${p.skills.map((name,slot)=>{
 const a=identitySkill(identity,slot);
 return `<button data-hero-spell="${slot}" aria-label="${name}. ${a.description}" aria-pressed="${slot===activeSlot}" title="${name}: ${a.description}">${selectionSpellArt(identity,slot,'preview-spell-art')}<span>${name}</span><kbd>${SELECTION_KEYS[slot]}</kbd></button>`;
 }).join('')}</div><span class="sr-only">${h.attribute}, ${h.attackType}, ${h.hp} health</span>`;
}

// Match HUD portraits. mountMatchPortraits() at match start fills the player's hero frame and the six heroes beside the
// score; updateMatchPortraits() on each HUD update greys out fallen heroes and counts down their return.
export function lineupHTML(state){
 const side=team=>state.units.filter(u=>u.kind==='hero'&&u.team===team).map(u=>{
  const p=HERO_IDENTITIES[u.identity],name=p?.name||u.name;
  return `<li data-unit="${u.id}" class="${u.player?'player':''}" title="${name}"><img src="${portraitURL(p?.slug||'tidewarden')}" alt="${name}" decoding="async"><b aria-hidden="true"></b></li>`;
 }).join('');
 return `<ol class="lineup ally" aria-label="Your team">${side(0)}</ol><ol class="lineup enemy" aria-label="The other shore">${side(1)}</ol>`;
}
export function updateLineup(root,state){
 for(const li of root.querySelectorAll('[data-unit]')){
  const u=state.units.find(e=>e.id===+li.dataset.unit),down=!u||u.hp<=0,count=down&&u?String(Math.max(1,Math.ceil(u.respawn))):'';
  if(li.dataset.count===count)continue;
  li.dataset.count=count;li.classList.toggle('down',down);li.querySelector('b').textContent=count;
  li.title=`${li.querySelector('img').alt}${down?`, returns in ${count} s`:''}`;
 }
}
export function mountMatchPortraits(state,identity){
 const frame=document.getElementById('hero-frame'),lineup=document.getElementById('lineup');
 if(frame)frame.style.backgroundImage=`url('${portraitURL(HERO_IDENTITIES[identity].slug)}')`;
 if(lineup)lineup.innerHTML=lineupHTML(state);
}
export function updateMatchPortraits(state){const lineup=document.getElementById('lineup');if(lineup)updateLineup(lineup,state);}
