(()=>{
const YEARS=[2026,2032,2038,2044,2050,2056,2062,2068,2074,2080,2090,2100];
const TECHS=[
{id:"geothermal",name:"Advanced Geothermal",cat:"Energy",desc:"AI-guided drilling opens clean firm power almost anywhere.",cost:{capital:2,research:1,industry:1},fx:{emissions:-8,energy:-5,prosperity:2}},
{id:"solar",name:"Perovskite Solar",cat:"Energy",desc:"Ultra-light tandem cells make solar cheaper and faster to deploy.",cost:{capital:2,research:1},fx:{emissions:-7,energy:-6,prosperity:2}},
{id:"storage",name:"Iron-Air Storage",cat:"Energy",desc:"Cheap multi-day batteries smooth renewable power.",cost:{capital:2,research:2},fx:{emissions:-6,energy:-5,prosperity:1}},
{id:"hvdc",name:"Continental HVDC",cat:"Infrastructure",desc:"Move clean power across huge distances with low losses.",cost:{capital:2,political:1,industry:2},fx:{emissions:-5,energy:-4,prosperity:2}},
{id:"gridai",name:"AI Grid Orchestration",cat:"Infrastructure",desc:"Balance millions of producers, batteries, and flexible loads.",cost:{research:2,trust:1},fx:{emissions:-4,energy:-4,prosperity:2}},
{id:"nuclear",name:"Factory Nuclear",cat:"Energy",desc:"Standardized reactors cut build time and construction risk.",cost:{capital:3,political:1,industry:2},fx:{emissions:-8,energy:-3,prosperity:1}},
{id:"fusion",name:"Fusion Pilot Fleet",cat:"Moonshot",desc:"A costly shot at abundant high-density power.",cost:{capital:4,research:3,industry:1},fx:{emissions:-9,energy:-4,prosperity:2},risk:.28},
{id:"heatpump",name:"Universal Heat Pumps",cat:"Buildings",desc:"Electrify heating at global scale.",cost:{capital:1,political:1,industry:2},fx:{emissions:-5,energy:-2,prosperity:1}},
{id:"ev",name:"Battery Mobility",cat:"Transport",desc:"Electric cars, buses, and freight spread through falling costs.",cost:{capital:2,industry:2},fx:{emissions:-6,energy:-1,prosperity:2}},
{id:"steel",name:"Hydrogen Steel",cat:"Industry",desc:"Replace coal-based steelmaking with clean hydrogen routes.",cost:{capital:2,research:1,industry:2},fx:{emissions:-6,energy:1,prosperity:1}},
{id:"cement",name:"Carbon-Negative Cement",cat:"Industry",desc:"New binders lock away CO₂ while replacing clinker.",cost:{capital:1,research:2,industry:2},fx:{emissions:-5,ecology:1}},
{id:"dac",name:"Direct Air Capture",cat:"Carbon",desc:"Pull carbon directly from ambient air.",cost:{capital:3,research:2,industry:1},fx:{emissions:-7,energy:3}},
{id:"mineral",name:"Carbon Mineralization",cat:"Carbon",desc:"Lock captured CO₂ into stable rock.",cost:{capital:2,research:1,industry:1},fx:{emissions:-5,ecology:1}},
{id:"methane",name:"Methane Suppression",cat:"Agriculture",desc:"Sensors, feed additives, and leak control rapidly cut methane.",cost:{capital:1,research:1,political:1},fx:{emissions:-7,prosperity:1}},
{id:"ferment",name:"Precision Fermentation",cat:"Food",desc:"Make proteins with microbes and spare land and methane.",cost:{capital:2,research:2,trust:1},fx:{emissions:-5,ecology:5,prosperity:1}},
{id:"forest",name:"Forest Restoration",cat:"Nature",desc:"Large-scale restoration expands carbon sinks and habitat.",cost:{capital:1,political:2},fx:{emissions:-4,ecology:7,prosperity:1}},
{id:"agri",name:"Regenerative Agriculture",cat:"Food",desc:"Improve soil carbon, resilience, and fertilizer efficiency.",cost:{capital:1,political:1},fx:{emissions:-3,ecology:5,prosperity:1}},
{id:"robotics",name:"Autonomous Construction",cat:"Industry",desc:"Robotics compress the time needed to build infrastructure.",cost:{capital:2,research:2},fx:{prosperity:4,industry:2}},
{id:"materials",name:"Materials Discovery AI",cat:"Science",desc:"Accelerate batteries, catalysts, cement, and grid materials.",cost:{research:3,trust:1},fx:{prosperity:3,research:2}},
{id:"recycle",name:"Closed-Loop Materials",cat:"Industry",desc:"High-value recycling reduces mining pressure and bottlenecks.",cost:{capital:1,industry:2,political:1},fx:{ecology:4,prosperity:2,energy:-1}}
];
const EVENTS=[
{name:"Copper crunch",text:"Grid expansion collides with a global copper shortage.",fx:{industry:-2,energy:2}},
{name:"Megadrought",text:"A major food-producing region enters a multi-year drought.",fx:{trust:-1,prosperity:-3,ecology:-2}},
{name:"AI productivity boom",text:"Automation raises output and research throughput.",fx:{prosperity:4,research:2}},
{name:"Energy shock",text:"Fuel prices spike after a geopolitical disruption.",fx:{capital:-1,energy:5,trust:-1}},
{name:"Wildfire summer",text:"Smoke blankets major cities and public concern surges.",fx:{trust:1,ecology:-3,political:1}},
{name:"Mineral embargo",text:"Critical mineral exports are suddenly restricted.",fx:{industry:-2,capital:-1}},
{name:"Climate migration",text:"Large migration flows strain housing and political capacity.",fx:{political:-2,trust:-1}},
{name:"Fusion headline",text:"A lab announces a major fusion milestone.",fx:{research:2,trust:1}},
{name:"Methane super-emitter",text:"Satellites expose massive leaks and force action.",fx:{political:1,emissions:2}},
{name:"Crop breakthrough",text:"Heat-tolerant crops improve food resilience.",fx:{prosperity:2,ecology:1}},
{name:"Financial squeeze",text:"Higher borrowing costs make infrastructure harder to finance.",fx:{capital:-2}},
{name:"Civic climate pact",text:"Cities and industry coordinate around a common transition plan.",fx:{political:2,trust:2}}
];
const SYNERGIES=[
{need:["solar","storage","gridai","hvdc"],name:"PLANETARY GRID",fx:{emissions:-12,energy:-8,prosperity:4}},
{need:["dac","mineral","geothermal"],name:"CARBON MINING",fx:{emissions:-10,ecology:3}},
{need:["robotics","nuclear"],name:"REACTOR SHIPYARDS",fx:{emissions:-7,energy:-4,industry:2}},
{need:["ferment","agri","forest"],name:"LAND DIVIDEND",fx:{emissions:-6,ecology:10,prosperity:3}},
{need:["materials","storage"],name:"POST-LITHIUM STORAGE",fx:{energy:-5,prosperity:3}},
{need:["steel","cement","robotics"],name:"CLEAN INDUSTRIAL BASE",fx:{emissions:-8,prosperity:4,industry:2}},
{need:["methane","ferment"],name:"METHANE COLLAPSE",fx:{emissions:-8,ecology:3}},
{need:["heatpump","ev","gridai"],name:"ELECTRIC EVERYWHERE",fx:{emissions:-9,energy:-3,prosperity:3}}
];
let state,rng,log=[];
let offers=[];
let finished=false;
const $=id=>document.getElementById(id);
const fast=new URLSearchParams(location.search).get("fast")==="1";
if(fast)document.documentElement.classList.add("fast");
function seedRng(seed){let t=seed>>>0;return()=>{t+=0x6D2B79F5;let r=Math.imul(t^t>>>15,1|t);r^=r+Math.imul(r^r>>>7,61|r);return((r^r>>>14)>>>0)/4294967296}}
function urlParam(name){return new URLSearchParams(location.search).get(name)}
function integerSeed(raw){
  if(typeof raw==="number"&&Number.isSafeInteger(raw))return raw;
  if(typeof raw!=="string"||!/^-?\d+$/.test(raw))return null;
  const n=Number(raw);
  return Number.isSafeInteger(n)?n:null;
}
function clockSeed(){return (Date.now()%2147483647)|0}
function syncSeedNote(bad){
  const note=$("seedNote");
  if(!note)return;
  if(bad==null){const raw=urlParam("seed");bad=raw!=null&&integerSeed(raw)==null}
  note.textContent=bad?"Bad seed, using random":"";
  note.classList.toggle("hidden",!bad);
}
function newState(explicit){
  const fromCall=integerSeed(explicit);
  const rawParam=urlParam("seed");
  const fromUrl=rawParam==null?null:integerSeed(rawParam);
  const seed=fromCall!=null?fromCall:(fromUrl!=null?fromUrl:clockSeed());
  const bad=fromCall==null&&rawParam!=null&&fromUrl==null;
  rng=seedRng(seed);
  log=[];
  offers=[];
  finished=false;
  state={seed,turn:0,capital:8,research:7,political:6,trust:6,industry:6,emissions:100,energy:100,prosperity:55,ecology:55,warming:2.8,owned:[],synergies:[],event:null};
  syncSeedNote(bad);
}
function clamp(n,min=0,max=100){return Math.max(min,Math.min(max,n))}
function applyFx(fx={}){for(const[k,v]of Object.entries(fx)){if(["capital","research","political","trust","industry"].includes(k))state[k]=Math.max(0,state[k]+v);else state[k]=clamp(state[k]+v)}state.warming=+(1.35+(state.emissions/100)*1.55).toFixed(2)}
function pay(cost={}){for(const[k,v]of Object.entries(cost))if(state[k]<v)return false;for(const[k,v]of Object.entries(cost))state[k]-=v;return true}
function affordable(t){return Object.entries(t.cost||{}).every(([k,v])=>state[k]>=v)}
function costText(c){return Object.entries(c).map(([k,v])=>v+" "+k).join(" · ")}
function pickTechs(){const pool=TECHS.filter(t=>!state.owned.includes(t.id)).sort(()=>rng()-.5);const a=pool.filter(affordable).slice(0,3);for(const t of pool){if(a.length>=3)break;if(!a.includes(t))a.push(t)}return a.slice(0,3)}
function effectsHtml(fx){return Object.entries(fx).map(([k,v])=>'<span class="pill">'+k+' '+(v>0?"+":"")+v+'</span>').join("")}
function render(){ $("year").textContent=YEARS[state.turn]||2100;$("turnLabel").textContent="Turn "+(state.turn+1)+" of 12";["capital","research","political","trust","industry","emissions","energy","prosperity","ecology"].forEach(k=>$(k).textContent=Math.round(state[k]));$("warming").textContent="+"+state.warming.toFixed(2)+"°C";$("smog").style.opacity=(clamp(state.emissions)/130).toFixed(2);$("forest").style.height=(16+state.ecology*.16)+"%";$("world").style.filter="saturate("+(0.65+state.ecology/150)+")";const seedEl=$("runSeed");if(seedEl)seedEl.textContent="Seed "+state.seed;renderCards()}
function renderCards(){const cards=$("cards");cards.innerHTML="";offers=pickTechs();offers.forEach(t=>{const el=document.createElement("article");el.className="card";el.dataset.id=t.id;el.innerHTML='<span class="tag">'+t.cat+'</span><h3>'+t.name+'</h3><p>'+t.desc+'</p><div class="effects">'+effectsHtml(t.fx)+'</div><div class="cost">'+costText(t.cost)+'</div>';if(!affordable(t)){el.style.opacity=.5;el.title="You cannot afford this yet"}el.onclick=()=>chooseOffered(t.id);cards.appendChild(el)});if(state.event){$("eventBanner").classList.remove("hidden");$("eventBanner").innerHTML="<b>"+state.event.name+"</b>"+state.event.text}else $("eventBanner").classList.add("hidden")}
function chooseOffered(id){const t=offers.find(x=>x.id===id);if(t)chooseTech(t)}
function chooseTech(t){if(!affordable(t)||!pay(t.cost))return;const failed=t.risk&&rng()<t.risk;if(failed){applyFx({trust:-1,research:-1});log.push({year:YEARS[state.turn],title:t.name+" failed",text:"The moonshot consumed resources without reaching deployment."})}else{state.owned.push(t.id);applyFx(t.fx);log.push({year:YEARS[state.turn],title:t.name,text:t.desc});checkSynergy()}advance()}
function checkSynergy(){for(const s of SYNERGIES){if(!state.synergies.includes(s.name)&&s.need.every(id=>state.owned.includes(id))){state.synergies.push(s.name);applyFx(s.fx);log.push({year:YEARS[state.turn],title:s.name,text:"A technology combination became a civilization-scale system."});$("modalBody").innerHTML='<p class="eyebrow">META-BREAKTHROUGH</p><h2>'+s.name+'</h2><p>Your technologies combined into something larger than any single project.</p>';openModal()}}}
function advance(){if(state.event)applyFx(state.event.fx);state.turn++;if(state.turn>=12){finish();return}applyFx({prosperity:1,emissions:2,ecology:-1});state.capital+=2;state.research+=2;state.political+=1;state.industry+=1;state.event=rng()<.72?EVENTS[Math.floor(rng()*EVENTS.length)]:null;if(state.event)log.push({year:YEARS[state.turn],title:state.event.name,text:state.event.text});render()}
function ideaLab(){const bases=[["Living Flow Battery","Engineered microbes maintain organic electrolytes for long-duration storage.",{research:2,capital:1},{emissions:-4,energy:-5,prosperity:1}],["Atmospheric Methane Enzymes","Bio-designed catalysts accelerate methane breakdown around industrial sources.",{research:2,trust:1},{emissions:-7,ecology:2}],["Self-Healing Grid Materials","Advanced conductors repair microfractures and reduce transmission failures.",{research:2,industry:1},{energy:-4,prosperity:3}],["Autonomous Reforestation Swarms","Robotic nurseries restore degraded ecosystems at continental scale.",{capital:2,research:1},{ecology:8,emissions:-4}],["Solar Cement Kilns","High-temperature solar heat replaces fossil combustion in cement production.",{capital:2,industry:1},{emissions:-5,energy:-1}]];const picks=bases.sort(()=>rng()-.5).slice(0,3);$("modalBody").innerHTML='<p class="eyebrow">IDEA LAB</p><h2>What should humanity invent?</h2><p>These moonshots are shaped by the current run.</p>'+picks.map((x,i)=>'<button class="ideaChoice" data-i="'+i+'"><b>'+x[0]+'</b><span>'+x[1]+'</span><small>'+costText(x[2])+'</small></button>').join("");[...document.querySelectorAll(".ideaChoice")].forEach((b,i)=>b.onclick=()=>{const x=picks[i];if(pay(x[2])){applyFx(x[3]);state.synergies.push(x[0]);log.push({year:YEARS[state.turn],title:x[0],text:x[1]});$("modal").close();advance()}});openModal()}
function showTimeline(){$("modalBody").innerHTML='<p class="eyebrow">TIMELINE</p><h2>Your alternate history</h2><div class="timelineList">'+(log.length?log.map(x=>'<div class="timelineItem"><b>'+x.year+' · '+x.title+'</b><div>'+x.text+'</div></div>').join(""):"<p>No major events yet.</p>")+'</div>';openModal()}
function ending(){if(state.warming<=1.65&&state.prosperity>=60&&state.ecology>=60)return"The Age of Abundance";if(state.warming<=1.9&&state.ecology>=65)return"The Regeneration Century";if(state.warming<=2.0)return"The Managed Transition";if(state.prosperity>=70)return"The Hot Growth Era";if(state.trust<3||state.political<2)return"The Fractured Century";return"The Long Emergency"}
function finish(){finished=true;if($("modal").open)$("modal").close();$("gameScreen").classList.add("hidden");$("endScreen").classList.remove("hidden");$("endingTitle").textContent=ending();$("endingCopy").textContent="Your choices pushed the world toward "+state.warming.toFixed(2)+"°C of warming while prosperity reached "+Math.round(state.prosperity)+" and ecology "+Math.round(state.ecology)+".";$("endStats").innerHTML=[["2100 warming","+"+state.warming.toFixed(2)+"°C"],["Emissions",Math.round(state.emissions)],["Energy cost",Math.round(state.energy)],["Prosperity",Math.round(state.prosperity)],["Ecology",Math.round(state.ecology)],["Trust",Math.round(state.trust)],["Technologies",state.owned.length],["Seed",state.seed]].map(x=>'<div><span>'+x[0]+'</span><b>'+x[1]+'</b></div>').join("");const names=[...state.synergies,...state.owned.map(id=>TECHS.find(t=>t.id===id)?.name)].filter(Boolean);$("breakthroughList").innerHTML=names.length?names.map(n=>"<span>"+n+"</span>").join(""):"<span>No major breakthrough</span>"}
function openModal(){const m=$("modal");if(fast){m.style.transition="none";m.style.animation="none"}if(!m.open)m.showModal()}
function start(seed){newState(seed);$("titleScreen").classList.add("hidden");$("endScreen").classList.add("hidden");$("gameScreen").classList.remove("hidden");state.event=EVENTS[Math.floor(rng()*EVENTS.length)];render()}
function copyState(){return JSON.parse(JSON.stringify({seed:state.seed,turn:state.turn,year:YEARS[state.turn]||2100,capital:state.capital,research:state.research,political:state.political,trust:state.trust,industry:state.industry,emissions:state.emissions,energy:state.energy,prosperity:state.prosperity,ecology:state.ecology,warming:state.warming,owned:state.owned,synergies:state.synergies,event:state.event}))}
window.__test=Object.freeze({
  state(){return state?copyState():null},
  log(){return log.map(entry=>({year:entry.year,title:entry.title,text:entry.text}))},
  offers(){return offers.map(t=>t.id)},
  choose(id){chooseOffered(id)},
  start(seed){start(seed)},
  ending(){return finished?ending():null}
});
syncSeedNote();
$("startBtn").onclick=()=>start();$("againBtn").onclick=()=>start();$("ideaBtn").onclick=ideaLab;$("timelineBtn").onclick=showTimeline;$("modalClose").onclick=()=>$("modal").close();let sound=true;$("soundBtn").onclick=()=>{sound=!sound;$("soundBtn").textContent=sound?"♪":"×"};
})();