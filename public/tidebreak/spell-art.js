import { HEROES } from './sim.js';
const POSITIONS=['0% 0%','100% 0%','0% 100%','100% 100%'];
export function spellArtHTML(hero,slot,className=''){
 return `<span class="painted-spell ${className}" style="background-image:url('./art/spells/${HEROES[hero].slug}-spells.webp');background-position:${POSITIONS[slot]}" aria-hidden="true"></span>`;
}
