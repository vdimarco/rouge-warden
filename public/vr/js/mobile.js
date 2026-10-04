// One-thumb flat-screen play. Tap a building to swing; the rope lets go by itself past the bottom of the arc.
// Drag or phone motion aims; a tap fires immediately.
import * as THREE from 'three';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function createMobile(canvas, active) {
  const enabled = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const state = { turn: 0, pitch: 0, moveX: 0, moveY: 0, hold: false, reel: 0, yank: 0, jump: false, menu: false, fire: false, aim: null };
  if (!enabled) return { enabled, sample: () => state, reset() {}, start() {}, miss() {}, target() {}, released() {}, idle: () => Infinity, rush() {}, climbing() {} };
  let sensors = false, latched = false, drag = null, wasActive = false, ready = false;
  let lastYaw = null, lastPitch = null, targetYaw = 0, targetPitch = 0, smoothYaw = 0, smoothPitch = 0;
  let pull = 0, cooldown = 0, lookAt = -1e9;
  const q = new THREE.Quaternion(), correction = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  const screenQ = new THREE.Quaternion(), euler = new THREE.Euler(), zAxis = new THREE.Vector3(0, 0, 1);
  const panel = document.createElement('div'); panel.id = 'phoneControls'; panel.hidden = true;
  panel.innerHTML = `<div class="phone-rush" aria-hidden="true"></div><div class="phone-top"><button data-action="motion">Motion aim</button><button data-action="center">Center</button><button data-action="menu" aria-label="Pause game">Pause</button></div><div class="phone-crosshair" aria-hidden="true"></div><div class="phone-climb" hidden role="group" aria-label="Climb"><button data-climb="up" aria-label="Climb up">▲</button><button data-climb="left" aria-label="Climb left">◀</button><button data-action="hop" aria-label="Jump off the wall">JUMP</button><button data-climb="right" aria-label="Climb right">▶</button><button data-climb="down" aria-label="Climb down">▼</button></div><div class="phone-bottom"><p class="phone-hint" role="status">Tap a building to swing. Keep tapping to fly.</p><button data-action="throw" aria-label="Swing or release rope">SWING<span>Or tap anywhere on the city</span></button><small>Tap to swing · the rope lets go by itself · drag to look</small></div>`;
  document.body.append(panel);
  const button = name => panel.querySelector(`[data-action="${name}"]`), hint = panel.querySelector('.phone-hint'), rushEl = panel.querySelector('.phone-rush');
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // The climb pad shows only while you hold a wall. Each arrow moves you while it is held down.
  const pad = panel.querySelector('.phone-climb'), held = { up: false, down: false, left: false, right: false };
  let onWall = false;
  const padMove = () => { state.moveY = (held.up ? 1 : 0) - (held.down ? 1 : 0); state.moveX = (held.right ? 1 : 0) - (held.left ? 1 : 0); };
  const padClear = () => { for (const k in held) held[k] = false; padMove(); };
  for (const b of pad ? pad.querySelectorAll('[data-climb]') : []) {
    const k = b.dataset.climb;
    const on = ev => { ev.preventDefault(); held[k] = true; padMove(); try { b.setPointerCapture(ev.pointerId); } catch { /* a pointer that is already gone: the arrow still works */ } };
    const off = () => { held[k] = false; padMove(); };
    b.addEventListener('pointerdown', on);
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(t, off);
    b.addEventListener('contextmenu', ev => ev.preventDefault());
  }
  if (pad) pad.querySelector('[data-action="hop"]').onclick = () => { if (active()) state.jump = true; };
  let rushK = -1, rushT = 0;
  function label() {
    button('throw').innerHTML = latched ? 'LET GO<span>Or wait: it lets go by itself</span>' : 'SWING<span>Or tap anywhere on the city</span>';
    button('throw').classList.toggle('held', latched);
    button('throw').setAttribute('aria-pressed', String(latched));
  }
  function center() { lastYaw = lastPitch = null; targetYaw = targetPitch = smoothYaw = smoothPitch = 0; }
  function reset() {
    latched = false; drag = null; pull = 0; center(); padClear();
    Object.assign(state, { turn:0, pitch:0, moveX:0, moveY:0, hold:false, reel:0, yank:0, jump:false, menu:false, fire:false, aim:null });
    label();
  }
  async function start() {
    try {
      const requests = [window.DeviceOrientationEvent, window.DeviceMotionEvent].map(C => C?.requestPermission ? C.requestPermission().catch(() => 'denied') : Promise.resolve(C ? 'granted' : 'denied'));
      const result = await Promise.all(requests);
      sensors = result.some(x => x === 'granted'); center();
      button('motion').textContent = sensors ? 'Motion on' : 'Motion aim';
      hint.textContent = sensors ? 'Point the phone and tap to swing. Keep tapping to fly.' : 'Tap a building to swing. Keep tapping to fly.';
    } catch { sensors = false; hint.textContent = 'Tap a building to swing. Keep tapping to fly.'; }
  }
  button('motion').onclick = () => { if (sensors) { sensors = false; center(); button('motion').textContent = 'Motion aim'; hint.textContent = 'Tap a building to swing. Keep tapping to fly.'; } else start(); };
  button('center').onclick = () => { center(); hint.textContent = 'Aim centered. Tap Swing when the ring is green.'; };
  button('menu').onclick = () => { state.menu = true; };
  function cast(aim = null) {
    latched = true; state.fire = true; state.aim = aim; label();
    hint.textContent = 'Swinging. Tap the next building while you fly.';
  }
  button('throw').onclick = () => {
    if (!active()) return;
    if (latched) { latched = false; state.fire = false; state.aim = null; label(); hint.textContent = 'Tap the next building to swing again.'; }
    else cast();
  };
  canvas.addEventListener('pointerdown', ev => {
    if (!active() || drag) return;
    ev.preventDefault(); canvas.setPointerCapture(ev.pointerId);
    drag = { id:ev.pointerId, x:ev.clientX, y:ev.clientY, x0:ev.clientX, y0:ev.clientY, distance:0 };
  });
  canvas.addEventListener('pointermove', ev => {
    if (drag?.id !== ev.pointerId || !active()) return;
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    drag.distance += Math.hypot(dx,dy);
    // Allow a small amount of finger movement without turning a tap into a look gesture.
    if (drag.distance > 8) { state.turn -= dx * .004; state.pitch -= dy * .004; lookAt = performance.now(); }
    drag.x = ev.clientX; drag.y = ev.clientY;
  });
  canvas.addEventListener('pointerup', ev => {
    if (drag?.id !== ev.pointerId) return;
    if (active() && drag.distance <= 8) {
      const rect = canvas.getBoundingClientRect();
      cast({ x:clamp((ev.clientX-rect.left)/rect.width*2-1,-1,1), y:clamp(1-(ev.clientY-rect.top)/rect.height*2,-1,1) });
    }
    drag = null;
  });
  for (const type of ['pointercancel','lostpointercapture']) canvas.addEventListener(type, ev => { if (drag?.id === ev.pointerId) drag = null; });
  addEventListener('deviceorientation', ev => {
    if (!sensors || !active() || !Number.isFinite(ev.beta) || !Number.isFinite(ev.gamma) || !Number.isFinite(ev.alpha)) return;
    const rad = Math.PI/180, angle = (screen.orientation?.angle || 0)*rad;
    euler.set(ev.beta*rad,ev.alpha*rad,-ev.gamma*rad,'YXZ');
    q.setFromEuler(euler).multiply(correction).multiply(screenQ.setFromAxisAngle(zAxis,-angle));
    euler.setFromQuaternion(q,'YXZ');
    const yaw=euler.y, pitch=euler.x;
    if(lastYaw !== null && Math.abs(yaw-lastYaw)+Math.abs(pitch-lastPitch) > .02) lookAt = performance.now();
    if(lastYaw !== null) { targetYaw += clamp(Math.atan2(Math.sin(yaw-lastYaw),Math.cos(yaw-lastYaw)),-.18,.18); targetPitch += clamp(pitch-lastPitch,-.14,.14); }
    lastYaw=yaw; lastPitch=pitch;
  });
  addEventListener('devicemotion', ev => {
    if(!sensors || !active() || !latched) return;
    const z=ev.acceleration?.z, now=performance.now();
    if(!Number.isFinite(z) || z<1.6 || now<cooldown) return;
    pull=Math.max(pull,clamp(z/9,.2,1));
    if(z>4) { state.yank=clamp(z*.38,1.6,4.5); cooldown=now+450; }
  });
  addEventListener('blur',reset);
  document.addEventListener('visibilitychange',reset);
  screen.orientation?.addEventListener('change',reset);
  return { enabled, reset, start,
    // Comic speed lines at the screen edges, 0 (none) to 1 (full). They crackle (a small turn every 60 ms) unless motion is reduced.
    rush(k, dt = 0) {
      if (!rushEl) return;
      k = Math.round(clamp(k, 0, 1) * 50) / 50;
      if (k !== rushK) { rushK = k; rushEl.style.opacity = String(k); }
      if (k > 0 && !still && (rushT -= dt) <= 0) { rushT = .06; rushEl.style.transform = `rotate(${(Math.random() * 7).toFixed(1)}deg) scale(${(1.02 + .06 * k).toFixed(3)})`; }
    },
    // On a wall: show the climb pad (and clear it when you leave, so no arrow stays held).
    climbing(on) {
      on = !!on;
      if (on === onWall || !pad) return;
      onWall = on; pad.hidden = !on;
      if (on) { latched = false; label(); hint.textContent = 'On the wall. Hold the arrows to climb. Tap a building to swing off.'; }
      else padClear();
    },
    // The rope let go by itself: the button goes back to SWING.
    released() { latched=false; state.fire=false; state.aim=null; label(); hint.textContent='Flying. Tap the next building.'; },
    // Seconds since the player last dragged or tilted to look. The camera follow waits for this.
    idle() { return (performance.now()-lookAt)/1000; },
    miss(keepRope = false) { latched=keepRope; state.fire=false; label(); hint.textContent=keepRope ? 'Keeping this rope. Tap a closer building to switch.' : 'Nothing in reach. Turn toward the tall buildings and tap.'; },
    target(valid, attached) {
      ready=valid; panel.classList.toggle('target-ready',ready);
      // A broken rope must never leave the button stuck on LET GO.
      if(latched && !attached && !state.fire && window.G?.P?.dead) reset();
    },
    sample(dt) {
      const on=active(); panel.hidden=!on;
      if(!on) { if(wasActive) reset(); wasActive=false; return {...state,hold:false}; }
      wasActive=true;
      const blend=1-Math.exp(-20*Math.min(dt,.05)), sy=smoothYaw, sp=smoothPitch;
      smoothYaw+=(targetYaw-smoothYaw)*blend; smoothPitch+=(targetPitch-smoothPitch)*blend;
      const out={...state,turn:state.turn+smoothYaw-sy,pitch:state.pitch+smoothPitch-sp,hold:latched,reel:pull>.12?pull:0};
      pull*=Math.exp(-6*dt); state.turn=state.pitch=state.yank=0;state.fire=state.jump=state.menu=false;state.aim=null;
      return out;
    },
  };
}
