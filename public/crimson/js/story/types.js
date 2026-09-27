// js/story/types.js : the story contract. Frozen ids, the shapes every package codes against, the save
// schema, the mission and cine validators, and CONTRACT: the list of S members that qa/crimson/contract.mjs
// checks. Packages read this file; only the foundation and integration edit it.
//
// Rules for every package (AMENDMENTS B13, G1, G2):
// - init(S) fills only your own S members. Wire to other packages in S.bus.on('start', ...), which the
//   director emits in begin() before the first chapter.
// - Code against these shapes. If a member you need is a stub, guard it; never edit another package.
// - Flow runs on S.timers, S.co and handles with a `done` flag. No setTimeout, no Promise continuations.
// - Gameplay never reads S.q (C2). Only ambient traffic, crowd and flora scale with the tier.

/* ------------------------------------------------------------------ frozen ids */
export const PHASES = Object.freeze(['input', 'script', 'control', 'physics', 'ai', 'combat', 'anim', 'camera', 'world', 'look', 'fx', 'hud']);
// Which phases run in each director mode. 'sim' phases also stop while S.freeze is set (B7).
export const PHASE_RULES = Object.freeze({
  input: 'always', script: 'clock', control: 'sim', physics: 'sim', ai: 'sim', combat: 'sim',
  anim: 'clock', camera: 'always', world: 'always', look: 'always', fx: 'clock', hud: 'always',
});
export const MODES = Object.freeze(['boot', 'play', 'menu', 'credits']);
export const MODALS = Object.freeze(['dialog', 'choice', 'map', 'evidence', 'card']);
export const BEGIN_REASONS = Object.freeze(['yield', 'skip', 'continue', 'jump']);
export const HERO_MODES = Object.freeze(['foot', 'drive', 'passenger', 'photo']);
export const PACKAGES = Object.freeze(['look', 'audio', 'world', 'cast', 'vehicles', 'combat', 'missions', 'ui', 'content']); // init order
export const PACKAGE_PATHS = Object.freeze({ look: 'look/look.js', audio: 'audio/audio.js', world: 'world/sedona.js', cast: 'cast/cast.js', vehicles: 'vehicles/vehicles.js', combat: 'combat/combat.js', missions: 'missions/missions.js', ui: 'ui/ui.js', content: 'content/content.js' });
export const CAMERA_PRIO = Object.freeze({ cine: 100, photo: 90, drive: 50, foot: 40, boot: 0 });
export const SAVE_KEY = 'crimson.story.v1';

export const CREW_IDS = Object.freeze(['tanktop', 'fifty', 'shades', 'newbalance', 'redjersey']); // CREW index order
export const CAST_IDS = Object.freeze([...CREW_IDS, 'gabe', 'vance', 'voss', 'rattler', 'boone', 'gang', 'civA', 'civB', 'christian', 'ryu', 'ronin', 'bear']);
export const ARENA_CAST = Object.freeze(['ronin', 'gabe', 'bear']); // registered arena actors: hidden, never disposed (B9)
export const CORE_CAST = Object.freeze([...CREW_IDS, 'gabe']); // S.ready waits for S.cast.preload(CORE_CAST) (B2)
// Bodies. null means code-built by cast/bodygen.js (A1) or an arena actor. GLBs load by absolute path.
export const BODY_URL = Object.freeze({
  tanktop: '/wild/models/crew1.glb', fifty: '/wild/models/crew2.glb', shades: '/wild/models/crew3.glb', newbalance: '/wild/models/crew4.glb', redjersey: '/wild/models/crew5.glb',
  christian: '/wild/models/christian.glb', ryu: '/wild/models/ryu.glb',
  gabe: null, ronin: null, bear: null, vance: 'models/vance.glb', voss: 'models/voss.glb', rattler: 'models/rattler.glb', boone: null, gang: 'models/gang.glb', civA: null, civB: null,
});
export const DONOR_RIG = '/wild/models/crew4.glb'; // the skeleton code-built bodies clone (A1)
// Dialogue portraits. A missing file shows the glyph card instead (A3). Dana has none, by design.
export const PORTRAITS = Object.freeze({
  tanktop: 'art/crew/1.webp', fifty: 'art/crew/2.webp', shades: 'art/crew/3.webp', newbalance: 'art/crew/4.webp', redjersey: 'art/crew/5.webp',
  gabe: 'art/gabe.webp', vance: 'art/portraits/vance.webp', voss: 'art/portraits/voss.webp', rattler: 'art/portraits/rattler.webp', dana: null,
});
export const GLYPHS = Object.freeze({ tanktop: '力', fifty: '命', shades: '影', newbalance: '风', redjersey: '速', gabe: '熊', vance: '法', voss: '笑', rattler: '蛇' });
export const FOE_IDS = Object.freeze(['driver', 'guard', 'boone', 'rattler', 'voss', 'legend']);
export const LEGEND_IDS = Object.freeze(['javelina', 'vulture', 'gila', 'tarantula']); // E9: 'legend' foes, one per cairn
export const WEAPON_IDS = Object.freeze(['fists', 'foamKatana', 'cue', 'stool', 'staff']);
export const ABILITIES = Object.freeze(['bearCall']);
export const EVIDENCE = Object.freeze(['face', 'place', 'date', 'link']);
export const LOOKS = Object.freeze(['ARENA', 'DAY', 'DUSK', 'NIGHT', 'DAWN', 'MEMORY', 'MEMORY_NIGHT', 'INTERIOR', 'HANGOVER', 'VORTEX', 'DEEP_INK']);
export const STEP_TYPES = Object.freeze(['cine', 'talk', 'card', 'goto', 'drive', 'enter', 'exit', 'wait', 'stakeout', 'photo', 'tail', 'lose', 'chase', 'race', 'fight', 'defend', 'stealth', 'interact', 'escort', 'collect', 'choice', 'set', 'script']);
export const CHAPTER_ORDER = Object.freeze(['c0', 'i0', 'f1', 'i1', 'f2', 'i2', 'f3', 'i3', 'f4', 'i4', 'f5', 'i5', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'p12', 'e1']);
export const COLD_OPEN = Object.freeze(['c0', 'i0']); // never saved as the resume point: CONTINUE starts at f1 or later
export const VEHICLE_KINDS = Object.freeze(['van', 'jeep', 'suv', 'suv_fbi', 'pickup', 'sedan', 'rv', 'whitevan']);
export const VAN_LOOKS = Object.freeze(['noBumper', 'tapedWindows', 'noMirror', 'justMarried']);
export const SURFACES = Object.freeze(['asphalt', 'dirt', 'rock', 'sand', 'water', 'scrub']);
export const CARD_KINDS = Object.freeze(['chapter', 'time', 'title', 'text', 'pass', 'fail', 'error', 'loading']);
export const INPUT_ACTIONS = Object.freeze(['move', 'look', 'light', 'heavy', 'parry', 'dodge', 'canteen', 'lock', 'use', 'crouch', 'camera', 'bearcall', 'map', 'pause', 'music', 'gas', 'brake', 'handbrake', 'horn', 'lookback', 'exit', 'skip', 'shutter', 'zoom']);
export const INPUT_CONTEXTS = Object.freeze(['foot', 'drive', 'photo', 'menu', 'cine']);
export const TOUCH_SETS = Object.freeze(['combat', 'explore', 'drive', 'photo', 'menu', 'none']);
// Events on S.bus. 'start' {reason, chapter, mission, step, save}; 'exit'; 'preload' stage ('story'|'transform'|'begin');
// 'chapter' {id}; 'mission' {id, state}; 'step' {mission, index, type}; 'pass' {id}; 'fail' {id, reason};
// 'quality' q; 'coError' {task, error, waited}; 'swap' {to: 'story'|'arena'}; 'save' SaveV1.
// S.bus.emit calls listeners in the order they were added, so listeners added in init run in PACKAGES order.
export const BUS_EVENTS = Object.freeze(['start', 'exit', 'preload', 'chapter', 'mission', 'step', 'pass', 'fail', 'quality', 'coError', 'swap', 'save']);
// Name every long-lived chain task ROOT_PREFIX + a name: MISSIONS' chapter chain ('root:chapter') and free
// roam ('root:roam'). While the story plays, MISSIONS keeps one root task alive. A root task that ends with
// an error, or any task that ends with an error while no live task waits on it, shows 'Something went
// wrong.' with RETRY and SAVE & QUIT (B16). To handle a helper task's error yourself, yield its handle
// (the error is thrown into you) and catch it.
export const ROOT_PREFIX = 'root:';
// Reserved orders inside a phase (lower runs first; S.register's default is 0). Each package registers at
// its own slots, so the order never depends on init order. An input handler that acts on an action
// consumes it (S.input.consume), so a later handler in the same tick does not act on it again: E carries
// both 'use' and 'exit', so the handler that acts on either consumes both.
export const PHASE_ORDER = Object.freeze({
  input: Object.freeze({ ui: -50 }), // UI: pause, the menu, dialogue, cards and choices come first
  script: Object.freeze({ ready: -100, missions: 0 }), // MISSIONS sets S.ready first, then its fail rules
  control: Object.freeze({ interact: -10, vehicles: -5, hero: 0 }), // director: S.interact.update; VEHICLES: E gets out; COMBAT: the hero
  fx: Object.freeze({ arenaFx: 100 }), // director: fx.js particles, after every package's fx
});
// Session lifecycle (index.js):
// - init(S) runs once per page. It fills only the package's own S members (B13). Start no timers or tasks
//   in init: S.timers and S.co are session-scoped.
// - api.begin() starts a session: it emits 'preload' ('begin'), then 'start' {reason, chapter, mission, step,
//   save}, then starts the boot task, which waits for S.ready and calls S.missions.startChapter. 'start'
//   listeners reset state and wire packages to each other. They run in PACKAGES order, so show no UI there
//   (UI resets itself in its own 'start' listener, after MISSIONS): show UI from tasks and phases.
// - api.leave() (SAVE & QUIT, a new begin) cancels every task and clears every timer first (the tasks'
//   finally blocks run), then emits 'exit'. Create timers and tasks in 'start' or later, never in init.

/* ------------------------------------------------------------------ S (the one context object) */
/**
 * @typedef {(cdt: number, rdt: number, raw: number) => void} PhaseFn
 *   raw: the frame's real seconds. rdt: raw * S.timeScale (0 while the clock is stopped, as in the menu).
 *   cdt: rdt with combat hitstop and slow motion applied; 0 while frozen or outside play (B7, B8).
 * @typedef {object} Story  S, built by index.js and filled by the packages
 * @property {object} THREE  three.js
 * @property {ArenaCtx} ctx  the arena seam from game.js
 * @property {object} game  game.js's game object (read only)
 * @property {object} scene @property {object} camera @property {object} renderer  shared with the arena
 * @property {number} time  story seconds (scaled), @property {number} frame  story ticks
 * @property {Timers} timers @property {Co} co @property {Bus} bus @property {(name:string)=>(()=>number)} rng
 * @property {Day} day @property {Object<string,any>} flags
 * @property {number} q  quality tier 0..2 (never read by gameplay)
 * @property {'boot'|'play'|'menu'|'credits'} mode
 * @property {null|'dialog'|'choice'|'map'|'evidence'|'card'} modal
 * @property {boolean} freeze  gameplay-only stop: control, physics, ai, combat (B7). Modal UI sets it.
 * @property {boolean} lockControl  the hero ignores move input (cines, scripted walks)
 * @property {number} hitstop @property {number} slow @property {number} slowT  combat-only time effects (B8)
 * @property {number} timeScale  cinematic time (default 1): scales every sim phase, timers and the clock (B8)
 * @property {Interact} interact @property {Film} film @property {object} focus  Vector3 the look follows
 * @property {boolean} ready  set by MISSIONS once S.world.ready and the core S.cast.preload are done (B2)
 * @property {object} test  QA handles; each package adds its own (S.test.world, S.test.van, ...)
 * @property {(phase:string, fn:PhaseFn, order?:number)=>(()=>void)} register  throws on an unknown phase (B6)
 * @property {{add:(name:string,prio:number,active:()=>boolean,update:(rdt:number)=>void)=>(()=>void), current:object|null}} cameras
 * @property {object} api  the director api @property {()=>void} exit  SAVE & QUIT: write the save, leave, show the title
 * @property {Object<string,'real'|'stub'>} pkgs  where each package was loaded from
 * @property {Look} look @property {Audio} audio @property {World} world @property {Cast} cast
 * @property {Vehicles} vehicles @property {Drive} drive @property {Traffic} traffic @property {Drivers} drivers
 * @property {Hero} hero @property {Combat} combat @property {Stealth} stealth
 * @property {Missions} missions @property {Cine} cine @property {Photo} photo @property {Evidence} evidence
 * @property {Save} save @property {Markers3D} markers3d @property {Ui} ui @property {Input} input @property {Content} content
 */
/**
 * @typedef {object} ArenaCtx  what game.js hands the story (arenaCtx())
 * @property {object} THREE @property {object} game @property {object} cam @property {object} input
 * @property {object[]} CREW @property {number} crewPick  the crew index the story plays (the title's pick)
 * @property {(i:number)=>void} setCrewPick  sets the pick (and the title's selection); begin('continue') applies SaveV1.pick with it before 'start'
 * @property {{ronin:object, gabe:object, bear:object, katana:object}} actors  the arena actors
 * @property {object} player @property {object} boss
 * @property {object} scene @property {object} camera @property {object} renderer @property {object} post @property {object} arena
 * @property {(title:string, sub:string, kanji?:string)=>void} showCard @property {(text:string, hot?:boolean)=>void} pop @property {object} hud
 * @property {(v:boolean)=>void} setArenaVisible  arena group, arena actors, trails, pipe; depth 0.1/3000 or 0.3/2600
 * @property {(on:boolean)=>void} setBridgeSilhouette @property {()=>void} restoreArenaLook
 * @property {(center:object, camPos:object)=>void} followLights @property {(x:number,z:number)=>number} groundHeight
 * @property {object} Music @property {object} Audio @property {object} fx  fx.js spawners (sparks, ink, dust, neon, fur, grass, ember, flash, ring, splat, blast)
 * @property {(dt:number)=>void} updateFX  steps fx.js; the director calls it in 'fx' (PHASE_ORDER.fx.arenaFx) with cdt in play, else rdt
 * @property {()=>void} clearFX  ends every particle, flash, ring, splat and blast at once
 * @property {(opts:object)=>{atEnd:boolean, skip:()=>void, stop:()=>void}} rollCredits  opts: crew, pick, result, blocks, note, againLabel, now, onAgain
 * @property {()=>void} showTitle @property {{video:object, screen:object}} film @property {object} arenaLook  ARENA_LOOK (copied values, B11)
 */
/** @typedef {{now:number, after:(sec:number,fn:Function,tag?:string)=>number, every:(sec:number,fn:Function,tag?:string)=>number, cancel:(id:number)=>void, cancelTag:(tag:string)=>void, clear:()=>void, tick:(dt:number)=>void}} Timers */
/** @typedef {{start:(gen:Generator,name?:string)=>Task, tick:()=>void, cancelAll:(prefix?:string)=>void, count:number, list:Task[]}} Co
 *  @typedef {{id:number, name:string, done:boolean, result:any, error:any, cancelled:boolean, cancel:()=>void}} Task
 *  A generator yields: seconds (number), a predicate, a handle with `done`, or null (one tick). A child task
 *  that threw throws into the parent that waits on it (yields its handle). An error that ends a root task
 *  (ROOT_PREFIX), or a task no live task waits on, shows 'Something went wrong.' with RETRY (B16). */
/** @typedef {{on:(e:string,f:Function)=>(()=>void), emit:(e:string,d?:any)=>void, clear:()=>void}} Bus */
/** @typedef {{day:string, hour:number, speed:number, frozen:boolean, night:boolean, set:(day?:string, hhmm?:string|number)=>void, advance:(rdt:number,k?:number)=>void, label:()=>string}} Day */
/** @typedef {{add:(o:{id?:string,pos:{x:number,y?:number,z:number}|(()=>object),r?:number,mode?:string,hold?:number,prio?:number,label?:string,tag?:string,when?:()=>boolean,act?:Function})=>string, remove:(id:string)=>void, clear:(tag?:string)=>void, update:(hero:Hero)=>object|null, current:object|null}} Interact
 *  update() picks the nearest option within r (flat distance) whose mode matches, with |dy| < 2.5 when both have a y (D6). */
/** @typedef {{play:(base:string,o?:{wait?:number})=>{done:boolean, played:boolean}, skip:()=>void, active:boolean}} Film */

/* ------------------------------------------------------------------ LOOK (look/look.js, render.js) */
/**
 * @typedef {object} Look  S.look
 * @property {(name:string, o?:{dur?:number, clock?:boolean})=>void} set  a LOOKS preset; tweens over dur. clock:true lets
 *   DAY/DUSK/NIGHT/DAWN follow S.day (they also do when the clock agrees with the name)
 * @property {(on:boolean)=>void} legend  daytime fight ink bleed: uInk to 1 in 0.6 s, back in 1.2 s
 * @property {(on:boolean, dur?:number)=>void} vortex  the 1.2 s dissolve to ink with neon kept
 * @property {(dur:number)=>void} dawn  ink drains from the ground up
 * @property {string} name  the current preset
 * @property {{legend:boolean, vortex:boolean}} overlay  overlay flags (B6)
 * @property {{flash:number, hurt:number, grey:number, neonBoost:number, smear:number}} base  written to the post pass each frame while in the story
 * @property {boolean} clockDriven  DAY/DUSK/NIGHT/DAWN follow S.day
 * @property {(center:object, camPos:object)=>void} followLights
 * @property {(q:0|1|2)=>void} setQuality  sets S.q and emits 'quality'
 * @property {()=>void} reset  back to ARENA: post uniforms, fog and background (ARENA_LOOK), toon ramp, depth 0.1/3000
 * @property {(rdt:number)=>void} update  LOOK calls it from its own 'look' phase handler; nobody else calls it
 * @property {object} sun  the key light and the only shadow caster: the sun by day, the moon's bearing by night
 * @property {object} moon  a shadowless fill from the camera's side (also S.look.fill) @property {object} fill @property {object} hemi
 * @property {{sun:object, moon:object, hemi:object, spots:object[], points:object[]}} lights  the fixed story light set (C5): only intensity and position change
 * @property {(on:boolean)=>void} headlights  the van's two spots (VEHICLES positions lights.spots)
 *   lights.points: set userData.pinned when you place one; a pinned point keeps the position and intensity its
 *   owner sets (WORLD lights the interiors this way), an unpinned one follows the look near the focus.
 * @property {{uFogColor:{value:object}, uFogNear:{value:number}, uFogFar:{value:number}, uSunDir:{value:object}, uTime:{value:number}}} uniforms
 *   live values for custom shaders (the story fog is one linear THREE.Fog, so fog:true also works)
 * @property {{solid:(mat:object)=>object, glow:(mat:object)=>object}} KEY  render.js KEY: solid keeps a crimson material's
 *   colour in the ink (it writes alpha 0); glow keys an additive crimson glow. Custom shaders write alpha 1 or more.
 * Beyond the contract (real LOOK only): tier and QUALITY (look/quality.js), params (the live preset values),
 * active, debugKey(on), and S.test.look / S.test.audio for QA.
 * render.js (LOOK) adds post uniforms with defaults that reproduce the arena, KEY.solid/glow, setQuality, adaptConfig.
 */
/** @typedef {{sfx:(name:string,o?:{at?:object,gain?:number,surface?:string})=>void, loop:(name:string,o?:{at?:object})=>{set:(p:object)=>void, stop:()=>void}, cue:(name:string|null)=>void, wind:(region:string)=>void}} Audio  S.audio
 *  cue: 'day' | 'night' | 'chase' | 'memory' | 'boss', 'auto' (the default: picked from the look and the fight) or null. */

/* ------------------------------------------------------------------ WORLD (world/*.js) */
/**
 * @typedef {object} World  S.world. x,z in [-HALF, HALF], +x east, -z north, y up, meters. SCALE is always 1 (C1).
 * @property {boolean} ready @property {number} progress 0..1 @property {number} SCALE @property {number} HALF
 * @property {object} group  every Sedona object; never add to the arena group
 * @property {boolean} visible
 * @property {(x:number,z:number)=>number} height  terrain only
 * @property {(x:number,z:number,out?:object)=>object} normal
 * @property {(x:number,z:number,yHint?:number)=>number} surface  highest walkable top at or below yHint+0.8; inside an interior volume terrain is ignored (C3)
 * @property {(x:number,z:number)=>'asphalt'|'dirt'|'rock'|'sand'|'water'|'scrub'} surfaceType
 * @property {(x:number,z:number)=>number} roadDist @property {(x:number,z:number)=>string} regionAt
 * @property {(x:number,z:number)=>({y:number, depth:number}|null)} water
 * @property {(id:string)=>({x:number,y:number,z:number,yaw:number,r:number}|null)} place  a PLACES, SPAWNS or CAIRNS id
 * @property {Colliders} colliders @property {Roads} roads
 * @property {object} mapImage  a 1024 canvas @property {(x:number,z:number)=>[number,number]} toMap
 * @property {(placeId:string)=>void} reveal @property {Set<string>} revealed
 * @property {{enter:(id:string)=>{x:number,y:number,z:number,yaw:number}, exit:(id:string)=>{x:number,y:number,z:number,yaw:number}, wall:(id:string)=>object}} interiors  wall(id) is the evidence-wall Mesh MISSIONS textures (B6)
 * @property {(v:boolean)=>void} setVisible
 * @property {(rdt:number, camera:object, focus:object)=>void} update  WORLD calls it from its own 'world' phase handler; nobody else calls it
 * @property {()=>object} bridgeSilhouette  a low-poly bridge for world scenes (the arena has its own)
 * @property {{lights:(on:boolean)=>void, gate:(open:boolean)=>void, on:boolean}} ranch  the Hart Ranch floodlights (B6); the gate blocks FR 9 until gate(true)
 * @property {number} mapVersion  goes up on every redraw of mapImage
 * interiors also has open(id, on) (door interacts outside free roam), points and roomAt(x, y, z). Add each saved
 * revealed id with reveal(id) (it redraws the map). Real WORLD only: colliders.walkTop, colliders.removeTag,
 * roads.list, roads.net, ranch.bunkDoor, town.pumps, and world/sedona.js exports WORLD_PALETTE.
 * @typedef {object} Colliders
 * @property {(x:number,z:number,r:number,o?:object)=>number} addCircle
 * @property {(o:{x:number,z:number,w:number,d:number,yaw?:number,y0?:number,top?:number,walk?:boolean})=>number} addBox
 * @property {(ax:number,az:number,bx:number,bz:number,o?:object)=>number} addSegment
 * @property {(o:{x0:number,x1:number,y0:number,y1:number,z0:number,z1:number,id?:string})=>number} addVolume  interiors (C3)
 * @property {(x:number,y:number,z:number)=>object|null} inVolume
 * @property {(id:number)=>void} remove @property {(x:number,z:number,r:number,cb:Function)=>void} query
 * @property {(p:object, r:number, yFeet?:number)=>boolean} resolveCircle  pushes p out; true on contact
 * @property {(obb:object)=>({nx:number,nz:number,depth:number}|null)} resolveOBB
 * @property {(a:object, b:object, o?:{terrain?:boolean})=>number|null} raycast  t in 0..1 of the first hit; outdoors it hits the ground too
 * @typedef {object} Roads
 * @property {(x:number,z:number)=>{x:number,z:number,road:string|null,dist:number}} nearest
 * @property {(from:object|string, to:object|string)=>{x:number,z:number}[]} route  A* over the road graph
 * @property {(roadId:string, s:number, lane:number)=>object} sample @property {object[]} lanes @property {(x:number,z:number)=>number} speedLimit
 * places.js exports PLACES, SPAWNS, PATROLS, KAZOOS (51), CAIRNS, SAFEHOUSES, REGIONS, INTERIORS and WORLD {SCALE:1, HALF:1000, SEED:51}.
 */

/* ------------------------------------------------------------------ CAST (cast/*.js, actors.js) */
/**
 * @typedef {object} Actor  the arena Actor API, shared by GLB bodies, code-built bodies and capsule placeholders
 * @property {string} [id] @property {object} root @property {object} model @property {Object<string,object>} clips
 * @property {string} cur @property {number} t  clip time of the current action @property {boolean} done
 * @property {(name:string, o?:{fade?:number,loop?:boolean,speed?:number,at?:number,restart?:boolean})=>object|null} play
 * @property {(dt:number)=>void} update @property {(name:string)=>object|undefined} bone @property {(k:number)=>void} setGlow
 * @property {boolean} visible (setter) @property {(name:string, clip:object)=>void} [addClip] @property {(cuts:object)=>void} [addCuts] @property {()=>void} [dispose]
 * @property {(speed:number, o?:{turn?:number, crouch?:number, upper?:boolean})=>void} [move]  story actors: procedural stride matched
 *   to speed (m/s), laid over the current clip; call it every frame (A2)
 * @property {boolean} [useCdt]  animate on the combat dt (fighters) instead of rdt
 * Placeholders expose the same clip names and durations as the real body (D2). Clip names are prefixed:
 * 'ronin:combo', 'gabe:punches', 'bear:sweep', 'lib:walk'. Combat reads timing from the spec tables.
 * @typedef {object} Cast  S.cast
 * @property {(ids:string[])=>{done:boolean, progress:number}} preload @property {(id:string)=>boolean} ready  true once id's real body is loaded
 * @property {(id:string, o?:{pos?:object,yaw?:number,parent?:object,tint?:number,props?:string[],lod?:boolean,arenaScale?:boolean,variant?:number,crowd?:boolean,costume?:boolean})=>Actor} spawn
 *   variant: which body of a multi-body id (gang, civA, civB; see variants(id)); crowd: crowd LOD rules (D4);
 *   costume: force the crew costume on or off (default: by chapter, see autoCostume)
 *   Works before the body is loaded: it returns an Actor at once (a placeholder with the same clip names and
 *   durations, D2) and swaps the real body into that same Actor when it arrives. spawn('gabe') returns the
 *   registered arena Gabe at story scale (about 1.95 m, B9); arenaScale:true keeps the arena scale (the cold open).
 * @property {(id:string)=>Actor|null} get  a registered arena actor (else a live one) by id, with no side effects
 * @property {(a:Actor)=>void} despawn  registered arena actors are only hidden (B9)
 * @property {(id:string, actor:Actor)=>void} register  arena actors, registered by the director. CAST animates
 *   every live actor and every visible registered actor in its 'anim' phase (on story time), so the arena
 *   actors keep moving after game.js hands the page over.
 * @property {{make:(name:string,o?:object)=>object, attach:(a:Actor,name:string,bone?:string,o?:object)=>object, detach:(a:Actor,name:string)=>void, names?:string[]}} props
 * @property {(a:Actor, on?:boolean)=>void} costume  the crew costume (D3): kasa, haori, sash, foam katana
 * @property {boolean} autoCostume  true (default): crew bodies wear the costume in the D3 chapters on their own
 * @property {(from:Actor, id:string, o?:object)=>Actor} replace  a new actor of id where from stands (the C0 cut from the arena ronin to the pick's crew body in costume)
 * @property {(a:Actor, speed:number, o?:object)=>void} move  a.move(speed, o) when the actor has one
 * @property {(id:string)=>number} variants  how many bodies an id has (1 for most)
 * @property {(a:Actor, name:string, k?:number)=>void} pose  procedural poses: sitDrive, sitPass, kneel, crouch, photo, phone, talk, handsOpen, dazed, knocked
 * @property {(a:Actor, k:number)=>void} drain  neon drain; also scales limbGlow sprites by 1-k (B10)
 * @property {(a:Actor, k:number)=>void} inkShadow
 * @property {(a:Actor, kind:'rattlesnake'|'scorpion')=>{tail:object, set:(state:object)=>void}} vortexParts
 * @property {(camPos:object)=>void} lodUpdate  CAST calls it from its own 'anim' phase handler
 * @property {{add:(a:Actor,o?:object)=>void, remove:(a:Actor)=>void, board:(v:Vehicle)=>void}} followers
 * @property {{update:(rdt:number,focus:object)=>void, scatter:(x:number,z:number,r:number)=>void, setDensity:(k:number)=>void}} crowd  CAST calls crowd.update from its own 'ai' phase handler
 * The story Gabe is the arena gabe actor at about 1.95 m while in the story (B9); showTitle restores it.
 */

/* ------------------------------------------------------------------ VEHICLES (vehicles/*.js) */
/**
 * @typedef {object} Vehicle
 * @property {string} id @property {string} kind @property {object} pos @property {number} yaw @property {object} vel
 * @property {number} speed @property {number} damage 0..100 @property {boolean} wrecked @property {boolean} protect @property {number} bumps
 * @property {{throttle:number, brake:number, steer:number, handbrake:boolean}} controls
 * @property {Array<object|null>} seats  10 seats: S0 driver, S1 front, S2..S9 rows
 * @property {boolean} lights @property {()=>void} horn @property {(x:number,z:number,yaw:number,y?:number)=>void} setPose  y: a height hint for surface() (under a deck)
 * @property {number|null} [maxContact]  protected: any contact above this speed (m/s) emits 'hitProtected' (E4)
 * @property {boolean} [rolling]  rolls with no parking brake (F4)
 * @property {(side:'driver'|'passenger'|'slide'|'rear')=>object} doorPoint @property {(o:object)=>void} setLook  VAN_LOOKS flags
 * @property {object} obj @property {(evt:string, fn:Function)=>(()=>void)} on
 *   events: 'hit', 'bump', 'hitProtected' {by, speed, reason: 'contact'|'hard'|'bumps'}, 'wrecked', and also 'enter', 'exit',
 *   'seat', 'unseat', 'land', 'pit', 'horn', 'noticed' (tail), 'raceDone', 'drowned'. controls.reverse: the brake reverses
 *   at a standstill only when it is true.
 * @typedef {object} Vehicles  S.vehicles
 * @property {(kind:string, o?:{pos?:object,place?:string,yaw?:number,tint?:number,look?:object,protect?:boolean,bumpLimit?:number,maxSpeed?:number,maxContact?:number,seats?:number})=>Vehicle} spawn
 * @property {(v:Vehicle)=>void} despawn @property {Vehicle[]} list @property {Vehicle|null} player  the crew van
 * @property {object[]} sweeps  swept paths for dodging, written by VEHICLES in 'physics'
 * @property {object[]} people  soft circles {x,z,r,dive(dir),id?} (id: remembers who was asked to dive). CAST (crowd, followers) and COMBAT (the hero on
 *   foot, enemies) push theirs in 'ai'; VEHICLES reads the list in 'physics' and then empties it, so each
 *   physics step sees one fresh set (one tick old)
 * @property {(evt:string, fn:Function)=>(()=>void)} on
 * @typedef {{enter:(v:Vehicle,seat?:number)=>boolean, exit:()=>({x:number,z:number}|null), riding:Vehicle|null, seat:(a:Actor,v:Vehicle,i:number)=>void, unseat:(a:Actor)=>void, seatsOf:(v:Vehicle)=>Array<object|null>, autopilot:(on:boolean, route?:object[]|string|object)=>void}} Drive  S.drive
 *  exit(o?:{door}) tries that door first. autopilot route: points, a place id or {x, z}. Also heroSeat (-1 on foot),
 *  state ('foot', 'riding' or the enter/exit animation) and autoGas (holds the gas for touch players).
 * @typedef {{setDensity:(k:number)=>void, clear:()=>void, cars:Vehicle[]}} Traffic  S.traffic (ambient only; mission traffic is spawned by missions, C2)
 * @typedef {{route:Function, tail:Function, convoy:Function, pursue:Function, flee:Function, race:Function, stop:(v:Vehicle)=>void}} Drivers  S.drivers
 * Vehicles run on rdt (scaled by S.timeScale), never on the combat dt.
 */

/* ------------------------------------------------------------------ COMBAT (combat/*.js, fx.js) */
/**
 * @typedef {object} Hero  S.hero
 * @property {'foot'|'drive'|'passenger'|'photo'} mode @property {object} pos  Vector3 @property {number} face
 * @property {Actor|null} actor @property {boolean} crouch @property {number} hp @property {number} maxHp @property {number} st
 * @property {number} canteen @property {number} canteenMax @property {string} weapon  a WEAPON_IDS id
 * @property {(crewId:string)=>void} setBody @property {(x:number, z:number, yaw?:number, y?:number)=>void} place  y: the height hint for surface() (a room at -300) @property {(m:string)=>void} setMode
 * @property {boolean} down
 * @typedef {object} Fighter
 * @property {string} id @property {Actor} a @property {object} pos @property {number} face @property {number} hp @property {number} maxHp
 * @property {number} posture @property {string} state @property {string} team @property {object} def @property {string} group
 * @property {boolean} alert @property {boolean} tied @property {boolean} downed @property {number|null} nextHit
 * @typedef {object} Combat  S.combat
 * @property {Fighter|null} player @property {Fighter[]} enemies @property {boolean} active @property {Fighter|null} boss
 * @property {(o?:{arena?:object,legend?:boolean,music?:boolean})=>void} begin
 * @property {(foeId:string, o?:FoeOpts)=>Fighter} spawn  foeId is a FOE_IDS id; 'legend' needs o.variant (E9)
 * @typedef {{pos?:object, place?:string, yaw?:number, group?:string, alert?:boolean, patrol?:string, weapon?:string, flashlight?:boolean, variant?:string}} FoeOpts
 *   variant: which Legend a 'legend' foe is, a LEGEND_IDS id (javelina, vulture, gila, tarantula); only for 'legend'.
 *   MISSIONS forwards every one of these fields from a MissionDef spawn or a wave entry to S.combat.spawn.
 * @property {(group?:string)=>void} clear @property {()=>void} end @property {(id:string)=>void} setWeapon
 * @property {(id:string, o?:{uses?:number})=>void} give @property {(d:number)=>void} lockCycle
 * @property {(evt:'down'|'takedown'|'tied'|'heroDown'|'bossPhase'|'finisher', fn:Function)=>(()=>void)} on
 * @typedef {{watch:(f:Fighter,cfg?:object)=>void, unwatch:(f:Fighter)=>void, level:()=>number, spotted:boolean, list:object[], on:(evt:'spotted',fn:Function)=>(()=>void), exposure:number}} Stealth  S.stealth
 * Attack tokens stay at 2 on every tier (C2). Hitstop and slow motion set S.hitstop/S.slowT and scale only cdt.
 * fx.js (foundation, B12): every spawner reads pos.groundY (default 0 keeps the arena identical); clearFX().
 */

/* ------------------------------------------------------------------ MISSIONS (missions/*.js) */
/**
 * @typedef {object} Missions  S.missions
 * @property {(id:string, o?:{mission?:string, step?:number, reason?:string})=>void} startChapter  runs the chapter, then the next in CHAPTER_ORDER
 * @property {(id:string, o?:{step?:number})=>void} start @property {()=>void} pass @property {(reason:string)=>void} fail
 * @property {()=>void} retry  never a no-op, and it works when no mission is active (after the root task died):
 *   it restarts the current (else the last) mission of this chapter from its last checkpoint, else from its
 *   first step; with no mission it restarts the chapter; in free roam it restarts free roam. It restarts at
 *   once or by the next tick. A checkpoint belongs to one mission of one chapter: clear it when that mission
 *   passes and when a chapter starts, so RETRY never goes back to an earlier chapter.
 * @property {()=>void} quit  leave the mission for free roam
 * @property {{id:string, step:number, type:string, state:string}|null} active
 * @property {(id:string)=>boolean} done @property {()=>string[]} available @property {()=>object[]} markers
 * @property {(cairnId:string)=>void} travel @property {(hhmm:string)=>void} wait @property {(on:boolean)=>void} autopilot
 * @property {string|null} chapter  the chapter now playing (B6)
 * @property {number} timeScale  the day clock's time-lapse factor, the only one (B6): nobody writes S.day.speed
 * MISSIONS owns S.ready (B2) and reads S.content at run time. It keeps one root task (ROOT_PREFIX) alive while
 * the story plays: the chapter chain, or free roam.
 * @typedef {{play:(id:string, o?:{cast?:object})=>{done:boolean}, skip:()=>void, active:boolean}} Cine  S.cine
 * @typedef {{open:(o?:object)=>void, close:()=>void, shoot:()=>object|null, active:boolean, gallery:object[], best:(slot:string)=>object|null, thumb:(id:string)=>string, reference:(placeId:string)=>object|null}} Photo  S.photo
 * @typedef {{set:(slot:string, photoId:string)=>void, get:(slot:string)=>string|null, slots:Object<string,string|null>}} Evidence  S.evidence
 * @typedef {{get:()=>SaveV1, write:()=>boolean, clear:()=>void, has:()=>boolean, summary:()=>{chapter:number,title:string}, checkpoint:()=>object, restore:(cp:object)=>void}} Save  S.save
 *   write() writes nothing and returns false until a chapter runs (S.missions.chapter is set), so the boot's
 *   loading never replaces the save that CONTINUE is loading. api.save() (hide, pagehide, SWITCH GAME)
 *   also waits for the boot to end.
 * @typedef {{add:(id:string, o:{x:number,z:number,y?:number,r?:number,kind?:'ring'|'pillar'|'both'})=>void, remove:(id:string)=>void, clear:()=>void, list:object[]}} Markers3D  S.markers3d (missions/markers3d.js, B6): crimson ground ring and keyed pillar
 * @typedef {object} MissionRuntime  m, passed to steps and content scripts
 * @property {Story} S @property {MissionDef} def @property {(ref:string)=>any} spawn @property {(id:string)=>any} get
 * @property {(text:string)=>void} objective @property {(id:string, o:object)=>void} marker @property {(id:string)=>void} unmark
 * @property {(lines:string[], o?:{block?:boolean})=>{done:boolean}} say @property {(who:string, line:string)=>void} subs
 * @property {(o:object)=>{done:boolean}} card @property {(id:string)=>{done:boolean}} cine @property {(sec:number)=>number} wait
 * @property {(fn:()=>boolean)=>(()=>boolean)} until @property {(reason:string)=>void} fail @property {(k:string, v?:any)=>any} flag
 * @property {(slot:string, photo:object)=>void} evidence @property {(name:string)=>void} look @property {(day:string, hhmm:string)=>void} clock
 * @property {Hero} hero @property {Vehicle|null} van @property {()=>void} cp
 */

/* ------------------------------------------------------------------ UI (ui/*.js, story.css) */
/**
 * @typedef {object} Ui  S.ui, DOM inside #story
 * @property {(text:string|null)=>void} objective @property {(sec:number|null)=>void} timer
 * @property {(id:string, v:number, o?:object)=>void} meter @property {(id:string)=>void} clearMeter
 * @property {(label:string|null, key?:string, hold01?:number)=>void} prompt
 * @property {(id:string, o:{x:number,z:number,y?:number,kind?:string,label?:string})=>void} marker @property {(id:string)=>void} unmark
 * @property {(who:string, text:string, dur?:number)=>void} subs
 * @property {(lines:Array<{who:string,text:string}|string>, o?:{portraits?:boolean, block?:boolean})=>{done:boolean}} say
 *   block (default true): a modal dialogue box that sets S.freeze while open. block:false plays the lines as
 *   subtitles, one after another, with no freeze (while driving); done when the last line ends.
 * @property {(title:string, options:string[])=>{done:boolean, index:number}} choose
 * @property {(kind:string, data:{title?:string,sub?:string,kanji?:string,dur?:number,choices?:string[]})=>{done:boolean, choice:number}} card
 *   Every choice (choose, a card with choices, the menu) works by keyboard and pad as well as by tap: the
 *   arrows or the d-pad ('up', 'down', 'left', 'right') move the focus and 'use' picks it.
 * @property {(f:Fighter|null)=>void} boss @property {(text:string|null)=>void} stamp @property {(text:string)=>void} clockTag
 * @property {(state:object)=>void} evidence @property {(list:object[])=>void} seats @property {(mps:number)=>void} speed @property {(k:number)=>void} damage
 * @property {(p:number|null)=>void} loading @property {(to:number, dur:number)=>{done:boolean}} fade
 * @property {(text:string, hot?:boolean)=>void} toast @property {(text:string|null)=>void} hint
 * @property {(on:boolean, o?:object)=>void} photoFrame @property {(name:string)=>void} touchSet
 * @property {{open:()=>void, close:()=>void, isOpen:boolean}} menu  opening sets S.mode 'menu'; SAVE & QUIT calls S.exit()
 * @property {{open:()=>void, close:()=>void}} map @property {{open:()=>void, close:()=>void}} board
 * @property {()=>void} advanceAll  completes every open say, choose and card handle (B6)
 * @typedef {object} Input  S.input
 * @property {string} context @property {(c:string)=>void} setContext
 * @property {(a:string)=>boolean} pressed  true on the tick the action went down @property {(a:string)=>boolean} held
 * @property {(...actions:string[])=>void} consume  the actions are handled: pressed() is false for them for the
 *   rest of this tick (see PHASE_ORDER; E is both 'use' and 'exit', so consume both)
 * @property {(name:'move'|'look'|'steer')=>{x:number,y:number}} axis @property {'key'|'pad'|'touch'} device
 * @property {(e:KeyboardEvent, down:boolean)=>void} key  fed by the game.js seam @property {(pad:object)=>void} pad  fed each frame
 * @property {(actions:Object<string,boolean|object>)=>void} set  QA @property {()=>void} clear @property {()=>void} update  called by the director at the top of each tick
 */

/* ------------------------------------------------------------------ CONTENT (content/*.js) */
/**
 * @typedef {object} Content  S.content: CHAPTERS, MISSIONS, LINES, CINES, SCRIPTS, CREDITS, line(id, vars)
 * @property {Object<string,ChapterDef>} CHAPTERS @property {Object<string,MissionDef>} MISSIONS @property {Object<string,string|object>} LINES
 * @property {Object<string,CineDef>} CINES @property {Object<string,Function>} SCRIPTS  generator functions (m, step)
 * @property {object} CREDITS  rollCredits options (result, blocks, note, againLabel)
 * @property {(id:string, vars?:object)=>string} line
 * @typedef {object} ChapterDef
 * @property {string} id @property {number} n  shown as CHAPTER n @property {string} title @property {string} [kanji] @property {number} [act]
 * @property {number|'pick'} pov  crew index or the player's pick @property {{day:string, time:string}} when @property {string} look
 * @property {string[]} missions @property {string} [cine]  interlude cine id @property {string} [start]  place id for the hero
 * @property {boolean} [arena]  plays in the arena (c0) @property {number} [drain]  Gabe's neon drain for the chapter (B10)
 */

/**
 * @typedef {object} MissionDef
 * @property {string} id @property {string} chapter @property {string} [title] @property {string} [giver]
 * @property {Array<{id:string, cast?:string, kind?:string, foe?:string, place?:string, pos?:{x:number,z:number}, yaw?:number, look?:object, protect?:boolean, bumpLimit?:number, maxSpeed?:number, maxContact?:number, player?:boolean, variant?:string, group?:string, alert?:boolean, patrol?:string, weapon?:string, flashlight?:boolean}>} [spawns]
 *   one of cast (an actor), kind (a vehicle; player:true makes it S.vehicles.player) or foe (a fighter; the
 *   FoeOpts fields apply, and a 'legend' foe needs variant, a LEGEND_IDS id)
 * @property {StepDef[]} steps
 * @property {{vanWrecked?:boolean, heroDown?:boolean, leaveArea?:{place:string, r:number}}} [fail]
 * @property {{unlock?:string[], flags?:object, save?:boolean}} [onPass]
 * @property {number} [budget]  stepped-time budget in seconds for story.mjs
 * @property {string[]} [cast]  cast ids on screen, for the content lint (D4)
 * @typedef {object} StepDef  common fields, then the params of its type (STEP_PARAMS)
 * @property {string} type @property {string} [id] @property {boolean} [cp]  checkpoint at this step
 * @property {string} [objective] @property {number} [timeLimit] @property {any} [qa]  autopilot hint
 * @typedef {{flags?:object, evidence?:object, clock?:{day?:string, time?:string}, day?:string, look?:string, weapon?:string, ability?:string, seats?:object[], vanLook?:object, unlock?:string[], spawn?:string[], despawn?:string[], traffic?:number, crowd?:number, save?:boolean}} SetOps
 */
// Step params: [required, optional]. A value may name a place id (string) or give {x, z}.
// talk.block: false plays the lines as subtitles with no freeze (Ui.say). fight/defend waves: an array of
// waves, each an array of {foe, variant?, place?, pos?, ...FoeOpts}; fight.boss names the foe id in the waves
// that gets the boss bar; fight.legend is the daytime ink bleed (Look.legend). A Legend fight (E9):
// { type: 'fight', legend: true, boss: 'legend', waves: [[{ foe: 'legend', variant: 'javelina', place: 'cairn_airport' }]] }.
export const STEP_PARAMS = Object.freeze({
  cine: [['id'], ['cast']],
  talk: [['lines'], ['block', 'who']],
  card: [['title'], ['kind', 'sub', 'kanji', 'dur']],
  goto: [['to'], ['r', 'mode', 'label']],
  drive: [['to'], ['r', 'vehicle', 'route', 'park', 'maxDamage']],
  enter: [['vehicle'], ['seat']],
  exit: [[], ['vehicle']],
  wait: [[], ['sec', 'until', 'lapse']],
  stakeout: [['zone', 'until'], ['r', 'events', 'lapse']],
  photo: [['subject'], ['kind', 'min', 'slot', 'store', 'count', 'match', 'window']],
  tail: [['target', 'to'], ['near', 'far', 'notice']],
  lose: [['pursuers'], ['sec', 'dist']],
  chase: [['target', 'goal'], ['hits', 'pit', 'protect', 'bumpLimit', 'maxSpeed', 'maxContact']],
  race: [['gates', 'target'], ['void', 'vehicle', 'rubber']],
  fight: [['waves'], ['arena', 'legend', 'music', 'boss', 'pickups', 'until']],
  defend: [['protect', 'waves'], ['boss', 'arena']],
  stealth: [['guards'], ['onSpotted', 'to', 'r', 'deepInk']],
  interact: [['at', 'label'], ['hold', 'window', 'watchers', 'mode']],
  escort: [['followers', 'to'], ['cover', 'drive', 'smooth', 'vehicle']],
  collect: [['items'], ['need', 'photo']],
  choice: [['title', 'options'], []],
  set: [[], ['flags', 'evidence', 'clock', 'day', 'look', 'weapon', 'ability', 'seats', 'vanLook', 'unlock', 'spawn', 'despawn', 'traffic', 'crowd', 'save']],
  script: [['fn'], ['args']],
});
export const STEP_COMMON = Object.freeze(['type', 'id', 'cp', 'objective', 'timeLimit', 'qa', 'fail', 'when']);

/**
 * @typedef {object} CineDef
 * @property {string} id @property {boolean} [arena]  plays in the arena (C0) @property {string} [look] @property {object} [cast]
 * @property {number} dur
 * @property {Array<{at:number,dur:number,from:object,to:object,look?:object,fov?:number,ease?:string,shake?:number}>} [shots]
 * @property {Array<{at:number,who:string,do:string,args?:any}>} [actors]  do: play, moveTo, face, pose, prop, show, hide, glow, drain, place
 * @property {Array<{at:number,who:string,line:string,block?:boolean}>} [lines]
 * @property {Array<{at:number,set:string,dur?:number}>} [looks]
 * @property {Array<{at:number,kind:string,title:string,sub?:string,kanji?:string}>} [cards]
 * @property {Array<{at:number,kind:string,pos?:object}>} [fx] @property {Array<{at:number,name:string}>} [sfx]
 * @property {{at:number,src:string}} [film]  engine fallback when it cannot play
 * @property {{actors?:object, hero?:object, van?:object, look?:string}} [end]  applied on finish or skip
 */
export const CINE_ACTOR_DOS = Object.freeze(['play', 'moveTo', 'face', 'pose', 'prop', 'show', 'hide', 'glow', 'drain', 'place', 'say']);

/* ------------------------------------------------------------------ the save */
/**
 * @typedef {object} SaveV1  localStorage 'crimson.story.v1'. MISSIONS owns reading, repair and writing.
 * @property {1} v @property {number} seed  the rng seed of the session that wrote it (for bug reports; CONTINUE does not reseed)
 * @property {number} pick  crew index; CONTINUE plays as this pick (begin() applies it with ctx.setCrewPick before 'start')
 * @property {string} chapter  the chapter CONTINUE resumes (never c0 or i0)
 * @property {{id:string, step:number}|null} mission
 * @property {string[]} done @property {Object<string,any>} flags
 * @property {{face:string|null, place:string|null, date:string|null, link:string|null}} evidence  photo ids
 * @property {string} day @property {number} time  hours 0..24
 * @property {{x:number, z:number, yaw:number, mode:string}} hero
 * @property {{kind:string, x:number, z:number, yaw:number, dmg:number, look:object}|null} van
 * @property {string[]} seats @property {number} hp @property {number} canteen @property {number} canteenMax
 * @property {string[]} weapons @property {string} weapon @property {{bearCall:boolean}} abilities
 * @property {string} kazoos  51 characters of 0 or 1 @property {string[]} cairns @property {string[]} revealed
 * @property {Object<string,number>} trials
 * @property {Array<{id:string, subject:string, kind:string, score:number, mission:string, t:number}>} photos
 * @property {Object<string,string>} thumbs  small data URLs for f5Photo and evidence slots (D7)
 * @property {{deaths:number, deflects:number, takedowns:number, photos:number, km:number, playTime:number}} stats
 * @property {boolean} assist @property {object[]} quarantine  unknown ids kept, not dropped
 * @property {{chapter:number, title:string}} summary  shown on the title as CHAPTER n · TITLE
 * @property {number} updated  Date.now() of the write
 */
export function blankSaveV1() {
  return { v: 1, seed: 0, pick: 2, chapter: 'f1', mission: null, done: [], flags: {}, evidence: { face: null, place: null, date: null, link: null },
    day: 'thu', time: 14.17, hero: { x: 0, z: 0, yaw: 0, mode: 'foot' }, van: null, seats: [], hp: 100, canteen: 5, canteenMax: 5,
    weapons: ['fists'], weapon: 'fists', abilities: { bearCall: false }, kazoos: '0'.repeat(51), cairns: [], revealed: [], trials: {},
    photos: [], thumbs: {}, stats: { deaths: 0, deflects: 0, takedowns: 0, photos: 0, km: 0, playTime: 0 }, assist: false, quarantine: [],
    summary: { chapter: 3, title: 'Ten Seats' }, updated: 0 };
}
// field -> the typeof it must have ('array' for arrays, '?' suffix for nullable)
export const SAVE_SCHEMA = Object.freeze({ v: 'number', seed: 'number', pick: 'number', chapter: 'string', mission: 'object?', done: 'array', flags: 'object', evidence: 'object', day: 'string', time: 'number', hero: 'object', van: 'object?', seats: 'array', hp: 'number', canteen: 'number', canteenMax: 'number', weapons: 'array', weapon: 'string', abilities: 'object', kazoos: 'string', cairns: 'array', revealed: 'array', trials: 'object', photos: 'array', thumbs: 'object', stats: 'object', assist: 'boolean', quarantine: 'array', summary: 'object', updated: 'number' });

/* ------------------------------------------------------------------ validators */
const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
export function checkType(v, want) {
  if (want === 'any') return true;
  const opt = want.endsWith('?'), base = opt ? want.slice(0, -1) : want, t = typeOf(v);
  if (opt && (v === null || v === undefined)) return true;
  if (base === 'object') return t === 'object' || t === 'array' || t === 'function';
  return t === base;
}
export function validateSave(s) {
  const bad = [];
  if (!s || typeof s !== 'object') return ['not an object'];
  if (s.v !== 1) bad.push(`v is ${s.v}`);
  for (const [k, t] of Object.entries(SAVE_SCHEMA)) if (!checkType(s[k], t)) bad.push(`${k} should be ${t}`);
  if (typeof s.kazoos === 'string' && !/^[01]{51}$/.test(s.kazoos)) bad.push('kazoos should be 51 characters of 0 or 1');
  if (COLD_OPEN.includes(s.chapter)) bad.push(`chapter ${s.chapter} is part of the cold open`);
  return bad;
}
const isPoint = (p) => p && typeof p === 'object' && Number.isFinite(p.x) && Number.isFinite(p.z);
// ids: { places, lines, cines, scripts, missions } (objects or Sets); a missing table skips that check.
const has = (tbl, id) => (tbl instanceof Set ? tbl.has(id) : Object.prototype.hasOwnProperty.call(tbl, id));
function checkRef(bad, where, v, tbl, kind) {
  if (typeof v === 'string') { if (tbl && !has(tbl, v)) bad.push(`${where}: unknown ${kind} '${v}'`); }
  else if (!isPoint(v)) bad.push(`${where}: needs a ${kind} id or {x, z}`);
}
// a foe entry: a FOE_IDS id; 'legend' needs a LEGEND_IDS variant, and only 'legend' takes one (E9)
function checkFoe(bad, w, f) {
  if (!FOE_IDS.includes(f.foe)) { bad.push(`${w}: unknown foe '${f.foe}'`); return; }
  if (f.foe === 'legend' && !LEGEND_IDS.includes(f.variant)) bad.push(`${w}: a legend foe needs a variant (${LEGEND_IDS.join(', ')}), not '${f.variant}'`);
  if (f.foe !== 'legend' && f.variant != null) bad.push(`${w}: only a legend foe takes a variant ('${f.foe}' has '${f.variant}')`);
}
export function validateMission(def, ids = {}) {
  const bad = [];
  if (!def || typeof def !== 'object') return ['not an object'];
  if (typeof def.id !== 'string' || !def.id) bad.push('id missing');
  const W = `mission ${def.id}`;
  if (def.chapter != null && !CHAPTER_ORDER.includes(def.chapter)) bad.push(`${W}: unknown chapter '${def.chapter}'`);
  if (!Array.isArray(def.steps) || !def.steps.length) bad.push(`${W}: steps missing`);
  const spawnIds = new Set();
  for (const [i, sp] of (def.spawns || []).entries()) {
    const w = `${W} spawn ${i}`;
    if (typeof sp.id !== 'string') bad.push(`${w}: id missing`); else spawnIds.add(sp.id);
    if (sp.cast && !CAST_IDS.includes(sp.cast)) bad.push(`${w}: unknown cast '${sp.cast}'`);
    if (sp.kind && !VEHICLE_KINDS.includes(sp.kind)) bad.push(`${w}: unknown vehicle kind '${sp.kind}'`);
    if (sp.foe || sp.variant != null) checkFoe(bad, w, sp);
    if (sp.place != null) checkRef(bad, w, sp.place, ids.places, 'place'); else if (sp.pos && !isPoint(sp.pos)) bad.push(`${w}: bad pos`);
  }
  for (const [i, s] of (def.steps || []).entries()) {
    const w = `${W} step ${i} (${s && s.type})`;
    if (!s || !STEP_TYPES.includes(s.type)) { bad.push(`${w}: unknown step type`); continue; }
    const [req, opt] = STEP_PARAMS[s.type];
    for (const k of req) if (s[k] == null) bad.push(`${w}: needs '${k}'`);
    for (const k of Object.keys(s)) if (!req.includes(k) && !opt.includes(k) && !STEP_COMMON.includes(k)) bad.push(`${w}: unknown param '${k}'`);
    if (s.type === 'cine' && ids.cines && !has(ids.cines, s.id)) bad.push(`${w}: unknown cine '${s.id}'`);
    if (s.type === 'talk') for (const l of [].concat(s.lines || [])) if (ids.lines && !has(ids.lines, typeof l === 'string' ? l : l.line)) bad.push(`${w}: unknown line '${typeof l === 'string' ? l : l.line}'`);
    if (s.type === 'script' && ids.scripts && !has(ids.scripts, s.fn)) bad.push(`${w}: unknown script '${s.fn}'`);
    if ((s.type === 'goto' || s.type === 'drive' || s.type === 'tail' || s.type === 'escort') && s.to != null) checkRef(bad, w, s.to, ids.places, 'place');
    if (s.type === 'interact' && s.at != null) checkRef(bad, w, s.at, ids.places, 'place');
    if (s.type === 'stakeout' && s.zone != null) checkRef(bad, w, s.zone, ids.places, 'place');
    if (s.type === 'race') for (const g of [].concat(s.gates || [])) checkRef(bad, w, g, ids.places, 'gate');
    if (s.type === 'photo' && s.slot != null && !EVIDENCE.includes(s.slot)) bad.push(`${w}: unknown evidence slot '${s.slot}'`);
    if (s.type === 'photo' && s.match != null) checkRef(bad, w, s.match, ids.places, 'place');
    if (s.type === 'fight' || s.type === 'defend') for (const wave of [].concat(s.waves || [])) for (const f of [].concat(wave)) if (f && (f.foe || f.variant != null)) checkFoe(bad, w, f);
    if (s.type === 'fight' && s.boss != null && !FOE_IDS.includes(s.boss)) bad.push(`${w}: unknown boss '${s.boss}'`);
    if (s.type === 'stealth') for (const g of [].concat(s.guards || [])) if (g && (g.foe || g.variant != null)) checkFoe(bad, w, g);
    if ((s.type === 'enter' || s.type === 'exit') && typeof s.vehicle === 'string' && s.vehicle !== 'player' && !spawnIds.has(s.vehicle)) bad.push(`${w}: vehicle '${s.vehicle}' is not a spawn`);
    if (s.type === 'choice' && !(Array.isArray(s.options) && s.options.length)) bad.push(`${w}: options missing`);
    if (s.type === 'set') bad.push(...validateSetOps(s, w, ids));
  }
  return bad;
}
export function validateSetOps(o, w = 'set', ids = {}) {
  const bad = [];
  if (o.look != null && !LOOKS.includes(o.look)) bad.push(`${w}: unknown look '${o.look}'`);
  if (o.weapon != null && !WEAPON_IDS.includes(o.weapon)) bad.push(`${w}: unknown weapon '${o.weapon}'`);
  if (o.ability != null && !ABILITIES.includes(o.ability)) bad.push(`${w}: unknown ability '${o.ability}'`);
  if (o.evidence) for (const k of Object.keys(o.evidence)) if (!EVIDENCE.includes(k)) bad.push(`${w}: unknown evidence slot '${k}'`);
  if (o.vanLook) for (const k of Object.keys(o.vanLook)) if (!VAN_LOOKS.includes(k)) bad.push(`${w}: unknown van look '${k}'`);
  if (o.unlock) for (const id of o.unlock) if (ids.missions && !has(ids.missions, id)) bad.push(`${w}: unlocks unknown mission '${id}'`);
  return bad;
}
export function validateCine(def, ids = {}) {
  const bad = [];
  if (!def || typeof def !== 'object') return ['not an object'];
  const W = `cine ${def.id}`;
  if (typeof def.id !== 'string' || !def.id) bad.push('id missing');
  if (!(def.dur > 0)) bad.push(`${W}: dur must be above 0`);
  if (def.look != null && !LOOKS.includes(def.look)) bad.push(`${W}: unknown look '${def.look}'`);
  const inTime = (x, w) => { if (!(Number.isFinite(x.at) && x.at >= 0 && x.at <= def.dur)) bad.push(`${w}: at ${x.at} is outside 0..${def.dur}`); };
  for (const [i, s] of (def.shots || []).entries()) { inTime(s, `${W} shot ${i}`); if (s.look != null && typeof s.look !== 'object') bad.push(`${W} shot ${i}: look must be a point`); }
  for (const [i, a] of (def.actors || []).entries()) {
    inTime(a, `${W} actor ${i}`);
    if (!CINE_ACTOR_DOS.includes(a.do)) bad.push(`${W} actor ${i}: unknown do '${a.do}'`);
    if (typeof a.who !== 'string') bad.push(`${W} actor ${i}: who missing`);
    else if (!CAST_IDS.includes(a.who) && !['pick', 'hero', 'van', 'crew'].includes(a.who) && !(def.cast && a.who in def.cast)) bad.push(`${W} actor ${i}: unknown who '${a.who}'`);
  }
  for (const [i, l] of (def.lines || []).entries()) { inTime(l, `${W} line ${i}`); if (ids.lines && !has(ids.lines, l.line)) bad.push(`${W} line ${i}: unknown line '${l.line}'`); }
  for (const [i, l] of (def.looks || []).entries()) { inTime(l, `${W} look ${i}`); if (!LOOKS.includes(l.set)) bad.push(`${W} look ${i}: unknown look '${l.set}'`); }
  for (const [i, c] of (def.cards || []).entries()) { inTime(c, `${W} card ${i}`); if (!CARD_KINDS.includes(c.kind)) bad.push(`${W} card ${i}: unknown kind '${c.kind}'`); if (typeof c.title !== 'string') bad.push(`${W} card ${i}: title missing`); }
  for (const [i, f] of (def.fx || []).entries()) inTime(f, `${W} fx ${i}`);
  for (const [i, f] of (def.sfx || []).entries()) inTime(f, `${W} sfx ${i}`);
  if (def.film) { inTime(def.film, `${W} film`); if (typeof def.film.src !== 'string') bad.push(`${W} film: src missing`); }
  if (def.end && def.end.look != null && !LOOKS.includes(def.end.look)) bad.push(`${W} end: unknown look '${def.end.look}'`);
  return bad;
}

/* ------------------------------------------------------------------ CONTRACT (checked by contract.mjs) */
// 'path type': the member at S.<path> must exist with that type. Types: function, object, number, boolean,
// string, array, any; a '?' suffix allows null. Grouped by owner.
const F = 'function';
const fns = (base, names) => names.map((n) => `${base}.${n} ${F}`);
export const CONTRACT = Object.freeze([
  // foundation (index.js, core/*, and the game.js seam)
  'THREE object', 'ctx object', 'game object', 'scene object', 'camera object', 'renderer object', 'time number', 'frame number',
  ...fns('ctx', ['setCrewPick', 'setArenaVisible', 'setBridgeSilhouette', 'restoreArenaLook', 'followLights', 'groundHeight', 'showCard', 'pop', 'updateFX', 'clearFX', 'rollCredits', 'showTitle']),
  'ctx.crewPick number', 'ctx.actors object', 'ctx.fx object', 'ctx.arenaLook object',
  'timers object', ...fns('timers', ['after', 'every', 'cancel', 'cancelTag', 'clear', 'tick']), 'timers.now number',
  ...fns('bus', ['on', 'emit', 'clear']), 'rng function',
  ...fns('day', ['set', 'advance', 'label']), 'day.day string', 'day.hour number', 'day.speed number', 'day.frozen boolean', 'day.night boolean',
  'flags object', 'q number', 'mode string', 'modal string?', 'freeze boolean', 'lockControl boolean',
  'hitstop number', 'slow number', 'slowT number', 'timeScale number',
  ...fns('interact', ['add', 'remove', 'clear', 'update']), 'interact.current object?',
  ...fns('film', ['play', 'skip']), 'film.active boolean', 'focus object', 'ready boolean', 'test object',
  ...fns('co', ['start', 'tick', 'cancelAll']), 'co.count number', 'co.list array', 'register function', 'cameras.add function', 'cameras.current object?',
  'api object', 'exit function', 'pkgs object',
  // look
  ...fns('look', ['set', 'legend', 'vortex', 'dawn', 'followLights', 'setQuality', 'reset', 'update', 'headlights']),
  'look.name string', 'look.clockDriven boolean', 'look.overlay object', 'look.overlay.legend boolean', 'look.overlay.vortex boolean',
  'look.base object', 'look.base.flash number', 'look.base.hurt number', 'look.base.grey number', 'look.base.neonBoost number', 'look.base.smear number',
  'look.sun object', 'look.moon object', 'look.hemi object', 'look.lights object', 'look.lights.spots array', 'look.lights.points array',
  'look.uniforms object', ...fns('look.KEY', ['solid', 'glow']),
  // audio
  ...fns('audio', ['sfx', 'loop', 'cue', 'wind']),
  // world
  'world.ready boolean', 'world.progress number', 'world.SCALE number', 'world.HALF number', 'world.group object', 'world.visible boolean',
  ...fns('world', ['height', 'normal', 'surface', 'surfaceType', 'roadDist', 'regionAt', 'water', 'place', 'toMap', 'reveal', 'setVisible', 'update', 'bridgeSilhouette']),
  ...fns('world.colliders', ['addCircle', 'addBox', 'addSegment', 'addVolume', 'inVolume', 'remove', 'query', 'resolveCircle', 'resolveOBB', 'raycast']),
  ...fns('world.roads', ['nearest', 'route', 'sample', 'speedLimit']), 'world.roads.lanes array',
  'world.mapImage object', 'world.mapVersion number', 'world.revealed object', ...fns('world.interiors', ['enter', 'exit', 'wall', 'open']), ...fns('world.ranch', ['lights', 'gate']),
  // cast
  ...fns('cast', ['preload', 'ready', 'spawn', 'get', 'despawn', 'register', 'pose', 'drain', 'inkShadow', 'vortexParts', 'lodUpdate', 'costume', 'replace', 'move', 'variants']), 'cast.autoCostume boolean',
  ...fns('cast.props', ['make', 'attach', 'detach']), ...fns('cast.followers', ['add', 'remove', 'board']), ...fns('cast.crowd', ['update', 'scatter', 'setDensity']),
  // vehicles
  ...fns('vehicles', ['spawn', 'despawn', 'on']), 'vehicles.list array', 'vehicles.player object?', 'vehicles.sweeps array', 'vehicles.people array',
  ...fns('drive', ['enter', 'exit', 'seat', 'unseat', 'seatsOf', 'autopilot']), 'drive.riding object?',
  ...fns('traffic', ['setDensity', 'clear']), 'traffic.cars array',
  ...fns('drivers', ['route', 'tail', 'convoy', 'pursue', 'flee', 'race', 'stop']),
  // combat
  'hero.mode string', 'hero.pos object', 'hero.face number', 'hero.actor object?', 'hero.crouch boolean', 'hero.hp number', 'hero.maxHp number', 'hero.st number',
  'hero.canteen number', 'hero.canteenMax number', 'hero.weapon string', 'hero.down boolean', ...fns('hero', ['setBody', 'place', 'setMode']),
  'combat.player object?', 'combat.enemies array', 'combat.active boolean', 'combat.boss object?',
  ...fns('combat', ['begin', 'spawn', 'clear', 'end', 'setWeapon', 'give', 'lockCycle', 'on']),
  ...fns('stealth', ['watch', 'unwatch', 'level', 'on']), 'stealth.spotted boolean', 'stealth.list array', 'stealth.exposure number',
  // missions
  ...fns('missions', ['startChapter', 'start', 'pass', 'fail', 'retry', 'quit', 'done', 'available', 'markers', 'travel', 'wait', 'autopilot']),
  'missions.active object?', 'missions.chapter string?', 'missions.timeScale number',
  ...fns('cine', ['play', 'skip']), 'cine.active boolean',
  ...fns('photo', ['open', 'close', 'shoot', 'best', 'thumb', 'reference']), 'photo.active boolean', 'photo.gallery array',
  ...fns('evidence', ['set', 'get']), 'evidence.slots object',
  ...fns('save', ['get', 'write', 'clear', 'has', 'summary', 'checkpoint', 'restore']),
  ...fns('markers3d', ['add', 'remove', 'clear']), 'markers3d.list array',
  // ui
  ...fns('ui', ['objective', 'timer', 'meter', 'clearMeter', 'prompt', 'marker', 'unmark', 'subs', 'say', 'choose', 'card', 'boss', 'stamp', 'clockTag', 'evidence', 'seats', 'speed', 'damage', 'loading', 'fade', 'toast', 'hint', 'photoFrame', 'touchSet', 'advanceAll']),
  ...fns('ui.menu', ['open', 'close']), 'ui.menu.isOpen boolean', ...fns('ui.map', ['open', 'close']), ...fns('ui.board', ['open', 'close']),
  'input.context string', 'input.device string', ...fns('input', ['setContext', 'pressed', 'held', 'consume', 'axis', 'key', 'pad', 'set', 'clear', 'update']),
  // content
  'content.CHAPTERS object', 'content.MISSIONS object', 'content.LINES object', 'content.CINES object', 'content.SCRIPTS object', 'content.CREDITS object', 'content.line function',
  // QA handles. The gate tests (boss, render, handoff, contract) use only these and the ids game.js owns,
  // never a package's own DOM, so a package can replace its stub without breaking a gate.
  'test.ready boolean', 'test.mode string', 'test.chapter string?', 'test.mission object?', 'test.skip function', 'test.autopilot function',
  'test.clock object', 'test.hero object', 'test.S object',
  ...fns('test.world', ['height', 'surface', 'teleport', 'regionAt', 'routeLen', 'info']),
  ...fns('test.van', ['enter', 'exit', 'drive', 'teleport']), 'test.van.pos object?', 'test.van.yaw number?', 'test.van.speed number', 'test.van.damage number', 'test.van.seats array',
  ...fns('test.cast', ['heightRatio', 'bones']),
  ...fns('test.combat', ['spawn', 'ko', 'tokens', 'lock']), 'test.combat.enemies array',
  ...fns('test.missions', ['goto', 'resolve', 'pass', 'fail']), 'test.missions.list array',
  ...fns('test.photo', ['aim', 'shoot']),
  ...fns('test.save', ['get', 'write', 'clear', 'load']),
  // UI: card is the open card's title (null when none), objective the objective line ('' when none),
  // choose(i) answers the open card or choice with option i as a click would (true if one was open), and
  // quit() does what the menu's SAVE & QUIT does.
  ...fns('test.ui', ['visible', 'overlaps', 'choose', 'quit']), 'test.ui.input object', 'test.ui.card string?', 'test.ui.objective string',
  // CONTENT: the credits handle ({atEnd, skip, stop}) while the story's credits roll, else null
  'test.credits object?',
  ...fns('test.perf', ['info', 'tier']),
]);
// Returns the problems with S against CONTRACT (an empty list means it holds).
export function checkContract(S) {
  const bad = [];
  for (const line of CONTRACT) {
    const [path, want] = line.split(' ');
    let v = S, ok = true;
    for (const k of path.split('.')) { if (v == null || !(k in Object(v))) { ok = false; break; } v = v[k]; }
    if (!ok) { bad.push(`S.${path} is missing`); continue; }
    if (!checkType(v, want)) bad.push(`S.${path} should be ${want}, is ${typeOf(v)}`);
  }
  return bad;
}
