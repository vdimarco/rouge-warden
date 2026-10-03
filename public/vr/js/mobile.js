// One-thumb flat-screen play. Phone motion aims; a tap fires immediately.
import * as THREE from 'three';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function createMobile(canvas, active) {
  const enabled = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const state = { turn: 0, pitch: 0, moveX: 0, moveY: 0, hold: false, reel: 0, yank: 0, jump: false, menu: false, fire: false, aim: null };
  if (!enabled) return { enabled, sample: () => state, reset() {}, start() {}, miss() {}, target() {} };
  let sensors = false, latched = false, drag = null, wasActive = false, ready = false;
  let lastYaw = null, lastPitch = null, targetYaw = 0, targetPitch = 0, smoothYaw = 0, smoothPitch = 0;
  let pull = 0, cooldown = 0;
  const q = new THREE.Quaternion(), correction = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  const screenQ = new THREE.Quaternion(), euler = new THREE.Euler(), zAxis = new THREE.Vector3(0, 0, 1);
  const panel = document.createElement('div'); panel.id = 'phoneControls'; panel.hidden = true;
  panel.innerHTML = `<div class="phone-top"><button data-action="motion">Motion aim</button><button data-action="center">Center</button><button data-action="menu" aria-label="Pause game">Pause</button></div><div class="phone-crosshair" aria-hidden="true"></div><div class="phone-bottom"><p class="phone-hint" role="status">Point at a building and tap Swing. Auto-jump is on.</p><button data-action="throw" aria-label="Swing or release rope">SWING<span>Auto-jump · one hand</span></button><small>Drag to look · tap a building to switch ropes</small></div>`;
  document.body.append(panel);
  const button = name => panel.querySelector(`[data-action="${name}"]`), hint = panel.querySelector('.phone-hint');
  function label() {
    button('throw').innerHTML = latched ? 'LET GO<span>Keep your momentum</span>' : 'SWING<span>Auto-jump · one hand</span>';
    button('throw').classList.toggle('held', latched);
    button('throw').setAttribute('aria-pressed', String(latched));
  }
  function center() { lastYaw = lastPitch = null; targetYaw = targetPitch = smoothYaw = smoothPitch = 0; }
  function reset() {
    latched = false; drag = null; pull = 0; center();
    Object.assign(state, { turn:0, pitch:0, moveX:0, moveY:0, hold:false, reel:0, yank:0, jump:false, menu:false, fire:false, aim:null });
    label();
  }
  async function start() {
    try {
      const requests = [window.DeviceOrientationEvent, window.DeviceMotionEvent].map(C => C?.requestPermission ? C.requestPermission().catch(() => 'denied') : Promise.resolve(C ? 'granted' : 'denied'));
      const result = await Promise.all(requests);
      sensors = result.some(x => x === 'granted'); center();
      button('motion').textContent = sensors ? 'Motion on' : 'Motion aim';
      hint.textContent = sensors ? 'Point and tap Swing. The jump and pull are automatic.' : 'Drag to look. Tap a building to jump and swing.';
    } catch { sensors = false; hint.textContent = 'Drag to look. Tap a building to jump and swing.'; }
  }
  button('motion').onclick = () => { if (sensors) { sensors = false; center(); button('motion').textContent = 'Motion aim'; hint.textContent = 'Drag to look. Tap a building to swing.'; } else start(); };
  button('center').onclick = () => { center(); hint.textContent = 'Aim centered. Tap Swing when the ring is green.'; };
  button('menu').onclick = () => { state.menu = true; };
  function cast(aim = null) {
    latched = true; state.fire = true; state.aim = aim; label();
    hint.textContent = 'Pulling you into the swing. Tap LET GO to fly.';
  }
  button('throw').onclick = () => {
    if (!active()) return;
    if (latched) { latched = false; state.fire = false; state.aim = null; label(); hint.textContent = 'Aim at the next building and tap Swing.'; }
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
    if (drag.distance > 8) { state.turn -= dx * .004; state.pitch -= dy * .004; }
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
    miss(keepRope = false) { latched=keepRope; state.fire=false; label(); hint.textContent=keepRope ? 'Keeping this rope. Tap a closer building to switch.' : 'Aim at a closer building. The green ring shows where you can attach.'; },
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
