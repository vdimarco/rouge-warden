import { HEROES } from './sim.js';
import { KITS, canLearn, rankGate, cooldownFor } from './abilities.js';
import { skillIcon } from './skill-icons.js';
const KEYS=['Q','E','C','R'];
const hints=[
 ['Fly into cover before using Death omen.','Aim the fan across a group.','Your next basic attack consumes the mark.','Use Death omen while concealed.'],
 ['Leave a wet trail to prepare Tailbreaker.','Pull enemies close, then sweep them away.','Wet enemies are stunned as they are knocked back.','Keep your allies inside the healing whirlpool.'],
 ['Jump beside a prepared Hex snare.','Root a target before firing the mortar.','Rooted enemies take 60% extra fire damage.','Hold a group inside the expanding shockwaves.'],
 ['Land close enough to use Rending claws.','Bleeding enemies flee for longer.','Bleed a target, then use Hell shriek.','Attack during the frenzy to recover health.'],
];
const upgrades=[
 ['Longer flight and cloak.','Stronger damage and a longer slow.','Stronger marked hit.','Stronger fear pulse.'],
 ['Longer dive and stronger healing.','Stronger pull damage.','Stronger damage and a longer stun.','Stronger whirlpool damage and team healing.'],
 ['Longer hop and stronger shield.','Stronger trap damage.','Stronger fire damage.','Stronger shockwaves.'],
 ['Longer leap and stronger impact.','Stronger shriek damage.','Stronger slash and bleeding.','Longer frenzy and stronger shield.'],
];
export function spellDetail(hero,slot){const a=KITS[hero][slot];return {...a,tags:a.tags||['Movement','Control','Signature','Ultimate'][slot],combo:a.combo||hints[hero][slot],upgrade:a.upgrade||upgrades[hero][slot]};}
const rankPips=(rank,max)=>Array.from({length:max},(_,j)=>`<i class="${j<rank?'filled':''}"></i>`).join('');
export function spellbookHTML(p,selected=0){
 const h=HEROES[p.hero],a=spellDetail(p.hero,selected),rank=p.skillRanks[selected],max=selected===3?3:4,gate=rankGate(selected,rank),ready=canLearn(p,selected);
 const base=KITS[p.hero][selected].cooldown;
 const current=cooldownFor({...p,skillRanks:p.skillRanks.map((r,i)=>i===selected?Math.max(1,r):r)},selected);
 const next=Math.max(3,base-rank*(selected===3?3:.75))*p.haste;
 const action=ready?`${rank?'Upgrade':'Learn'} ${a.name} · 1 point`:rank===max?'Fully trained':p.level<gate?`Unlocks at level ${gate}`:'Earn a skill point';
 return `<div class="spellbook" style="--hero-color:${h.color}"><div class="spellbook-heading"><img src="./art/illustrated/${h.slug}-front.webp" alt=""><div><h2>Shape your legend</h2><p>${h.name} · Level ${p.level}</p></div><strong class="point-count" role="status">${p.skillPoints}<span>skill point${p.skillPoints===1?'':'s'}</span></strong></div><div class="spellbook-layout"><div class="spell-list" role="group" aria-label="Select a spell to inspect">${KITS[p.hero].map((move,i)=>{
 const r=p.skillRanks[i],n=i===3?3:4,locked=i===3&&p.level<6;
 return `<button class="spell-row ${i===3?'ultimate-row':''}" data-preview="${i}" aria-pressed="${i===selected}" aria-label="Inspect ${move.name}" aria-controls="spell-detail"><span class="spell-row-icon">${skillIcon(move.icon)}</span><kbd>${KEYS[i]}</kbd><span class="spell-row-copy"><b>${move.name}</b><span class="rank-pips" aria-label="Rank ${r} of ${n}">${rankPips(r,n)}</span></span><small>${locked?'Level 6':r?`Rank ${r}`:canLearn(p,i)?'Learn':'Unlearned'}</small><svg class="row-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>`;
 }).join('')}</div><section id="spell-detail" class="spell-detail" aria-label="${a.name} details"><div class="spell-visual"><img src="./art/illustrated/${h.slug}-front.webp" alt=""><span class="spell-visual-glyph">${skillIcon(a.icon)}</span></div><h3>${a.name}${selected===3?'<small>ULTIMATE</small>':''}</h3><p class="spell-description">${a.description}</p><span class="spell-tags">${a.tags}</span><div class="spell-stats"><span><b>${Number(current.toFixed(2))}s</b> cooldown${rank>0&&rank<max?`<small>Next rank: ${Number(next.toFixed(2))}s</small>`:''}</span><span><b>${rank} / ${max}</b> rank<small>${rank===max?'Fully trained':`Next rank at level ${gate}`}</small></span></div><ol class="rank-track" aria-label="Rank level requirements">${Array.from({length:max},(_,j)=>{const level=rankGate(selected,j);return `<li class="${j<rank?'trained':j===rank?'next':''}"><i></i><span>Lv ${level}</span></li>`;}).join('')}</ol><p class="upgrade-note"><b>${rank===max?'Rank benefits':'On upgrade'}</b> ${a.upgrade}</p><p class="combo-note"><b>Play it well</b> ${a.combo}</p><button id="train-selected" class="primary" ${ready?'':'disabled'}>${action}</button><p id="training-feedback" class="training-feedback" role="status" aria-live="polite"></p></section></div><footer class="spellbook-footer"><p>Your three-hit basic attacks are always ready.</p><button id="back-skills" class="row-btn">Back to the hunt</button></footer></div>`;
}
