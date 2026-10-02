import { HEROES } from './sim.js';
import { KITS, canLearn, rankGate, cooldownFor } from './abilities.js';
import { spellArtHTML } from './spell-art.js';
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
 return `<div class="spellbook" style="--hero-color:${h.color}"><div class="spellbook-heading"><img src="./art/illustrated/${h.slug}-front.webp" alt=""><div><h2>Shape your legend</h2><p>${h.name} · Level ${p.level}</p></div><strong class="point-count" role="status"><span class="gold-star" aria-hidden="true">✦</span>${p.skillPoints}<span>skill point${p.skillPoints===1?'':'s'}</span></strong></div><div class="spellbook-layout"><div class="spell-list" role="group" aria-label="Select a spell to inspect">${KITS[p.hero].map((move,i)=>{
 const r=p.skillRanks[i],n=i===3?3:4,locked=i===3&&p.level<6;
 return `<button class="spell-row ${i===3?'ultimate-row':''}" data-preview="${i}" aria-pressed="${i===selected}" aria-label="Inspect ${move.name}" aria-controls="spell-detail">${spellArtHTML(p.hero,i,'spell-row-icon')}<kbd>${KEYS[i]}</kbd><span class="spell-row-copy"><b>${move.name}</b><span class="rank-pips" aria-label="Rank ${r} of ${n}">${rankPips(r,n)}</span></span><small>${locked?'🔒 Level 6':r?`Rank ${r}`:''}</small><svg class="row-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>`;
 }).join('')}</div><section id="spell-detail" class="spell-detail" aria-label="${a.name} details"><div class="spell-detail-scroll">${spellArtHTML(p.hero,selected,'spell-visual')}<h3>${a.name}</h3><p class="spell-description">${a.description}</p><span class="spell-tags">${a.tags}</span><div class="spell-stats"><span class="cooldown-stat"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg><span><b>${Number(current.toFixed(2))}s</b> cooldown${rank>0&&rank<max?`<small>Next rank: ${Number(next.toFixed(2))}s</small>`:''}</span></span><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 8 9-5 9 5-9 5-9-5m0 5 9 5 9-5m-18 5 9 5 9-5"/></svg> Rank <b>${rank} / ${max}</b><small>${rank===max?'Fully trained':`Next rank at level ${gate}`}</small></span></div><ol class="rank-track" aria-label="Rank level requirements">${Array.from({length:max},(_,j)=>{const level=rankGate(selected,j);return `<li class="${j<rank?'trained':j===rank?'next':''}"><i></i><span>${level}</span></li>`;}).join('')}</ol><details class="spell-tips"><summary>Upgrade details &amp; combo</summary><p class="upgrade-note"><b>${rank===max?'Rank benefits':'On upgrade'}</b> ${a.upgrade}</p><p class="combo-note"><b>Play it well</b> ${a.combo}</p></details></div><div class="spell-learn-action"><button id="train-selected" class="primary" ${ready?'':'disabled'}><span aria-hidden="true">✦</span> ${action}</button><p id="training-feedback" class="training-feedback" role="status" aria-live="polite"></p></div></section></div><footer class="spellbook-footer"><p><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M25 8C12 0 0 17 8 29c9 14 31 2 25-12-4-9-17-8-20 1-2 6 6 12 11 7 3-3 0-8-4-6"/></svg>Your three-hit basic attacks are always ready.</p><button id="back-skills" class="row-btn">Back to the hunt</button></footer></div>`;
}
