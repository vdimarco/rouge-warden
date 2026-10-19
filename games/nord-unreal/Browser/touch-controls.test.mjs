import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as wait } from 'node:timers/promises';
import { setupTouchControls, gradedLevel, steerKeys, pedalEdges } from './touch-controls.js';

function fixture() {
  const window = new EventTarget();
  const document = Object.assign(new EventTarget(), { defaultView: window, hidden: false });
  const attributes = new Map();
  const gyroButton = Object.assign(new EventTarget(), {
    setAttribute: (key, value) => attributes.set(key, value), getAttribute: key => attributes.get(key)
  });
  const gyroStatus = { textContent: '' };
  document.getElementById = id => id === 'gyro-look' ? gyroButton : id === 'gyro-status' ? gyroStatus : buttons.get(id);
  Object.assign(window, { isSecureContext: true, DeviceMotionEvent: {}, screen: { orientation: { angle: 0 } } });
  const root = Object.assign(new EventTarget(), { dataset: {}, ownerDocument: document, contains: target => controls.includes(target) });
  const controls = [];
  const messages = [];
  const deltas = [];
  const video = { videoWidth: 1280, videoHeight: 720 };
  const stream = {
    toStreamerHandlers: new Map(['KeyDown', 'KeyUp', 'MouseMove', 'MouseEnter', 'MouseDown', 'MouseUp'].map(name => [name, values => messages.push([name, ...values])])),
    webRtcController: { coordinateConverter: { translateSigned: (x, y) => { deltas.push([x, y]); return { x: x * 100, y: y * 100 }; } },
      videoPlayer: { getVideoElement: () => video } }
  };
  function control(dataset) {
    const captures = new Set();
    const styles = new Map();
    const attributes = new Map();
    const nodes = new Map(['b', 'span', 'svg'].map(name => [name, { textContent: '', innerHTML: name, dataset: {} }]));
    const target = {
      setAttribute: (name, value) => attributes.set(name, value), getAttribute: name => attributes.get(name),
      querySelector: name => nodes.get(name),
      dataset, styles, closest(selector) {
        return ['stick', 'key', 'mouse', 'toggle'].some(kind => selector.includes(`[data-${kind}]`) && dataset[kind]) ? this : null;
      },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
      style: { setProperty: (key, value) => styles.set(key, value) },
      setPointerCapture: id => captures.add(id), hasPointerCapture: id => captures.has(id), releasePointerCapture: id => captures.delete(id)
    };
    controls.push(target);
    return target;
  }
  function pointer(type, target, pointerId = 1, clientX = 50, clientY = 50, timeStamp) {
    const event = new Event(type, { cancelable: true });
    Object.defineProperties(event, Object.fromEntries(Object.entries({ target, pointerId, clientX, clientY, button: 0, pointerType: 'touch' }).map(([key, value]) => [key, { value }])));
    if (timeStamp !== undefined) Object.defineProperty(event, 'timeStamp', { value: timeStamp });
    surface.dispatchEvent(event);
    return event;
  }
  function click(target, detail = 0) {
    const event = new Event('click');
    Object.defineProperties(event, { target: { value: target }, detail: { value: detail } });
    root.dispatchEvent(event);
  }
  const ui = { move: control({ stick: 'move' }), steering: control({ stick: 'steer' }),
    gas: control({ key: '16' }), brake: control({ key: '32' }), use: control({ key: '69' }),
    fire: control({ key: '70' }), aim: control({ mouse: '2' }), weapon: control({ key: '81' }), auto: control({ toggle: 'auto' }),
    combat: { hidden: false } };
  const buttons = new Map([['touch-gas', ui.gas], ['touch-brake', ui.brake], ['touch-use', ui.use], ['touch-auto', ui.auto]]);
  root.querySelector = selector => selector === '.touch-steering' ? ui.steering : selector === '.touch-combat' ? ui.combat : ui.move;
  const surface = Object.assign(new EventTarget(), control({}));
  surface.contains = target => target === surface || controls.includes(target);
  function motion(timeStamp, rotationRate, accelerationIncludingGravity = { x: 0, y: 9.8, z: 0 }) {
    const event = new Event('devicemotion');
    Object.defineProperties(event, Object.fromEntries(Object.entries({ timeStamp, rotationRate, accelerationIncludingGravity }).map(([key, value]) => [key, { value }])));
    window.dispatchEvent(event);
  }
  return { ui, video, root, surface, gyroButton, gyroStatus, motion, document, window, messages, deltas, control, pointer, click,
    ...setupTouchControls({ root, surface, stream }) };
}

test('touch input stays disabled until actual play and disabling releases held keys', () => {
  const f = fixture();
  const action = f.control({ key: '69' });
  assert.equal(f.root.hidden, true);
  f.pointer('pointerdown', action);
  assert.deepEqual(f.messages, []);
  f.setEnabled(true);
  f.pointer('pointerdown', action);
  f.setEnabled(false);
  f.pointer('pointerup', action);
  assert.deepEqual(f.messages, [['KeyDown', 69, 0], ['KeyUp', 69]]);
  assert.equal(f.root.hidden, true);
});

test('movement deadzone, diagonals, direction changes and simultaneous actions use native keys', () => {
  const f = fixture();
  const move = f.control({ stick: 'move' });
  const sprint = f.control({ key: '16' });
  f.setEnabled(true);
  f.pointer('pointerdown', move);
  f.pointer('pointermove', move, 1, 55, 55);
  assert.deepEqual(f.messages, []);
  f.pointer('pointermove', move, 1, 90, 10);
  f.pointer('pointerdown', sprint, 2);
  f.pointer('pointermove', move, 1, 90, 10);
  assert.deepEqual(f.messages, [['KeyDown', 68, 0], ['KeyDown', 87, 0], ['KeyDown', 16, 0]]);
  f.pointer('pointermove', move, 1, 10, 90);
  assert.deepEqual(f.messages.slice(3), [['KeyUp', 68], ['KeyUp', 87], ['KeyDown', 65, 0], ['KeyDown', 83, 0]]);
  f.pointer('pointercancel', move);
  assert.deepEqual(f.messages.slice(-2), [['KeyUp', 65], ['KeyUp', 83]]);
  assert.equal(move.styles.get('--stick-x'), '0px');
  f.pointer('pointerup', sprint, 2);
  assert.deepEqual(f.messages.at(-1), ['KeyUp', 16]);
});

test('a second finger cannot steal a stick and duplicate action holds release only after both fingers leave', () => {
  const f = fixture();
  const move = f.control({ stick: 'move' });
  const action = f.control({ key: '32' });
  f.setEnabled(true);
  f.pointer('pointerdown', move, 1, 50, 0);
  f.pointer('pointerdown', move, 2, 50, 100);
  f.pointer('pointermove', move, 2, 50, 100);
  f.pointer('pointerdown', action, 3);
  f.pointer('pointerdown', action, 4);
  f.pointer('pointerup', action, 3);
  assert.deepEqual(f.messages, [['KeyDown', 87, 0], ['KeyDown', 32, 0]]);
  assert.equal(action.dataset.pressed, 'true');
  f.pointer('pointerup', action, 4);
  assert.equal(action.dataset.pressed, 'false');
  f.pointer('lostpointercapture', move, 1);
  assert.deepEqual(f.messages.slice(-2), [['KeyUp', 32], ['KeyUp', 87]]);
});

test('look drag uses Epic video-coordinate normalization and bounded signed protocol deltas', () => {
  const f = fixture();
  const look = f.surface;
  f.setEnabled(true);
  // The first finger on the game moves; it rests in the deadzone so the second finger's look is measured alone.
  f.pointer('pointerdown', f.surface, 9, 300, 300);
  f.pointer('pointerdown', look, 1, 80, 40);
  f.pointer('pointermove', look, 1, 90, 35);
  f.pointer('pointermove', look, 1, 1000, -1000);
  f.pointer('pointercancel', look);
  f.pointer('pointermove', look, 1, 1100, 0);
  assert.deepEqual(f.deltas, [[10, -5], [910, -1035]]);
  assert.deepEqual(f.messages, [['MouseEnter'], ['MouseMove', 32768, 32768, 1000, -500], ['MouseMove', 32768, 32768, 32767, -32767]]);
});

test('touching or dragging an install reminder descendant leaves UI input uncaptured', () => {
  const f = fixture();
  f.setEnabled(true);
  const nudge = f.control({});
  for (const part of ['padding', 'text', 'icon']) {
    const target = part === 'padding' ? nudge : f.control({});
    target.closest = selector => selector.split(',').some(value => value.trim() === '#install-nudge') ? nudge : null;
    const down = f.pointer('pointerdown', target, 1, 20, 20);
    assert.equal(down.defaultPrevented, false, part);
    assert.equal(f.surface.hasPointerCapture(1), false, part);
    const move = f.pointer('pointermove', target, 1, 50, 40);
    assert.equal(move.defaultPrevented, false, part);
    f.pointer('pointerup', target);
    assert.deepEqual(f.messages, [], part);
    assert.deepEqual(f.deltas, [], part);
    assert.notEqual(f.surface.dataset.pressed, 'true', part);
  }
});

test('dragging the game image looks while another finger moves; a second look finger cannot steal it', () => {
  const f = fixture();
  const move = f.control({ stick: 'move' });
  const look = f.surface;
  f.setEnabled(true);
  f.pointer('pointerdown', move, 1, 50, 0);
  f.pointer('pointerdown', f.surface, 2, 20, 20);
  f.pointer('pointermove', f.surface, 2, 40, 30);
  f.pointer('pointerdown', look, 3);
  f.pointer('pointermove', look, 3, 90, 90);
  assert.deepEqual(f.deltas, [[20, 10]]);
  assert.deepEqual(f.messages.slice(0, 2), [['KeyDown', 87, 0], ['MouseEnter']]);
  f.pointer('pointercancel', f.surface, 2);
  f.pointer('pointermove', f.surface, 2, 80, 60);
  assert.equal(f.deltas.length, 1);
  f.setEnabled(false);
  assert.deepEqual(f.messages.at(-1), ['KeyUp', 87]);
});

test('gyro needs an explicit permission click and maps portrait, landscape and flat-phone rotation', async () => {
  const f = fixture();
  let requests = 0;
  f.window.DeviceMotionEvent.requestPermission = async () => { requests++; return 'granted'; };
  f.setEnabled(true);
  f.motion(0, { alpha: 0, beta: 0, gamma: 30 });
  assert.deepEqual(f.messages, []);
  f.gyroButton.dispatchEvent(new Event('click'));
  await wait(0);
  assert.equal(requests, 1);
  f.motion(0, { alpha: 0, beta: 0, gamma: 30 });
  assert.equal(f.gyroButton.getAttribute('aria-pressed'), 'true');
  f.motion(20, { alpha: 0, beta: 0, gamma: 30 });
  assert.deepEqual(f.messages.at(-1), ['MouseMove', 32768, 32768, -184, 0]);
  f.window.screen.orientation.angle = 90;
  f.window.dispatchEvent(new Event('orientationchange'));
  f.motion(40, { alpha: 0, beta: 30, gamma: 0 }, { x: 9.8, y: 0, z: 0 });
  assert.equal(f.messages.filter(message => message[0] === 'MouseMove').length, 1, 'rotation rebaselines without a camera jump');
  f.motion(60, { alpha: 0, beta: 30, gamma: 0 }, { x: 9.8, y: 0, z: 0 });
  assert.deepEqual(f.messages.at(-1), ['MouseMove', 32768, 32768, -184, 0]);
  f.motion(80, { alpha: 30, beta: 0, gamma: 0 }, { x: 0, y: 0, z: 9.8 });
  assert.deepEqual(f.messages.at(-1), ['MouseMove', 32768, 32768, -184, 0], 'a flat phone turns around its vertical axis');
  f.gyroButton.dispatchEvent(new Event('click'));
  f.motion(100, { alpha: 30, beta: 0, gamma: 0 });
  assert.equal(f.messages.filter(message => message[0] === 'MouseMove').length, 3);
  assert.equal(f.gyroButton.getAttribute('aria-pressed'), 'false');
});

test('gyro rejects unavailable/denied sensors, malformed rates, stale samples and background/menu input', async () => {
  const f = fixture();
  f.setEnabled(true);
  f.window.DeviceMotionEvent = undefined;
  f.gyroButton.dispatchEvent(new Event('click'));
  assert.match(f.gyroStatus.textContent, /unavailable/);
  f.window.DeviceMotionEvent = { requestPermission: async () => 'denied' };
  f.gyroButton.dispatchEvent(new Event('click'));
  await wait(0);
  assert.match(f.gyroStatus.textContent, /denied/);
  assert.equal(f.gyroButton.disabled, false);
  f.window.DeviceMotionEvent.requestPermission = async () => 'granted';
  f.gyroButton.dispatchEvent(new Event('click'));
  await wait(0);
  for (const rotationRate of [null, { alpha: null, beta: 0, gamma: 10 }, { alpha: 0, beta: Infinity, gamma: 10 }]) f.motion(20, rotationRate);
  f.motion(100, { alpha: 0, beta: 0, gamma: 10 });
  f.motion(1000, { alpha: 0, beta: 0, gamma: 10 });
  assert.deepEqual(f.messages, [['MouseEnter']]);
  f.root.inert = true;
  f.motion(1020, { alpha: 0, beta: 0, gamma: 10 });
  f.root.inert = false;
  f.document.hidden = true;
  f.motion(1040, { alpha: 0, beta: 0, gamma: 10 });
  f.document.hidden = false;
  f.window.dispatchEvent(new Event('blur'));
  f.motion(1060, { alpha: 0, beta: 0, gamma: 10 });
  assert.deepEqual(f.messages, [['MouseEnter']]);
  f.window.dispatchEvent(new Event('focus'));
  f.motion(1080, { alpha: 0, beta: 0, gamma: 10 });
  f.motion(1100, { alpha: 0, beta: 0, gamma: 100000 });
  assert.deepEqual(f.messages.at(-1), ['MouseMove', 32768, 32768, -3072, 0], 'sensor spikes are bounded');
  f.setEnabled(false);
  f.motion(1120, { alpha: 0, beta: 0, gamma: 10 });
  assert.equal(f.messages.filter(message => message[0] === 'MouseMove').length, 1);
});

test('a permission response cannot enable gyro after disconnect', async () => {
  const f = fixture();
  let grant;
  f.window.DeviceMotionEvent.requestPermission = () => new Promise(resolve => { grant = resolve; });
  f.setEnabled(true);
  f.gyroButton.dispatchEvent(new Event('click'));
  f.setEnabled(false);
  grant('granted');
  await wait(0);
  f.motion(20, { alpha: 0, beta: 0, gamma: 30 });
  assert.deepEqual(f.messages, []);
  assert.equal(f.gyroButton.getAttribute('aria-pressed'), 'false');
  assert.equal(f.gyroButton.disabled, true);
});

test('blur, resize, pagehide, hidden document and explicit release all prevent stuck movement', () => {
  for (const reason of ['blur', 'resize', 'pagehide', 'hidden', 'explicit']) {
    const f = fixture();
    const action = f.control({ key: '87' });
    f.setEnabled(true);
    f.pointer('pointerdown', action);
    if (reason === 'hidden') {
      f.document.hidden = true;
      f.document.dispatchEvent(new Event('visibilitychange'));
    } else if (reason === 'explicit') f.releaseAll();
    else f.window.dispatchEvent(new Event(reason));
    f.pointer('pointerup', action);
    assert.deepEqual(f.messages, [['KeyDown', 87, 0], ['KeyUp', 87]], reason);
  }
});

test('keyboard and assistive clicks hold actions across ticks without repeating pointer clicks or releasing held keys', async () => {
  const f = fixture();
  const action = f.control({ key: '69' });
  f.click(action);
  assert.deepEqual(f.messages, [], 'disabled controls ignore assistive clicks');
  f.setEnabled(true);
  f.click(action, 1);
  f.click(f.control({ key: '900' }));
  f.click(f.control({ stick: 'move' }));
  assert.deepEqual(f.messages, [], 'normal pointer clicks and invalid action keys cannot add native input');
  f.click(action);
  f.click(action);
  assert.deepEqual(f.messages, [['KeyDown', 69, 0]], 'assistive clicks start one held activation');
  assert.equal(action.dataset.pressed, 'true');
  f.pointer('pointerdown', action);
  f.click(action);
  await wait(150);
  assert.deepEqual(f.messages, [['KeyDown', 69, 0]], 'activation expiry cannot release a key still held by a finger');
  assert.equal(action.dataset.pressed, 'true');
  f.pointer('pointerup', action);
  assert.deepEqual(f.messages.at(-1), ['KeyUp', 69]);
  assert.equal(action.dataset.pressed, 'false');
  f.click(action);
  assert.deepEqual(f.messages.at(-1), ['KeyDown', 69, 0]);
  await wait(150);
  assert.deepEqual(f.messages.at(-1), ['KeyUp', 69], 'an unheld assistive activation releases after its pulse');
  assert.equal(action.dataset.pressed, 'false');
});

test('releaseAll cancels a pending assistive activation without delayed duplicate releases', async () => {
  const f = fixture();
  const action = f.control({ key: '32' });
  f.setEnabled(true);
  f.click(action);
  assert.deepEqual(f.messages, [['KeyDown', 32, 0]]);
  f.releaseAll();
  assert.deepEqual(f.messages, [['KeyDown', 32, 0], ['KeyUp', 32]]);
  assert.equal(action.dataset.pressed, 'false');
  await wait(150);
  assert.deepEqual(f.messages, [['KeyDown', 32, 0], ['KeyUp', 32]]);
});

test('a permitted sensor that sends no samples stays off with an explanation', async () => {
  const f = fixture();
  f.setEnabled(true);
  f.gyroButton.dispatchEvent(new Event('click'));
  assert.equal(f.gyroButton.getAttribute('aria-pressed'), 'false');
  await wait(2600);
  assert.match(f.gyroStatus.textContent, /No motion data/);
  assert.equal(f.gyroButton.disabled, false);
  assert.equal(f.gyroButton.getAttribute('aria-pressed'), 'false');
  assert.deepEqual(f.messages, []);
});


test('adaptive video sizes keep the same native drag gain in each orientation', () => {
  for (const sizes of [[[1280, 720], [800, 450], [640, 360]], [[576, 1280], [360, 800], [288, 640]]]) {
    const f = fixture();
    f.setEnabled(true);
    f.pointer('pointerdown', f.surface, 9, 300, 300);
    const gains = [];
    for (const [width, height] of sizes) {
      f.video.videoWidth = width; f.video.videoHeight = height;
      f.pointer('pointerdown', f.surface, 1, 20, 20);
      f.pointer('pointermove', f.surface, 1, 30, 20);
      gains.push(f.messages.at(-1)[3] * width);
      f.pointer('pointerup', f.surface, 1);
    }
    assert.deepEqual(gains, [gains[0], gains[0], gains[0]]);
  }
});


test('actual driving mode separates steering and pedals, prioritizes brake and ignores repeated/invalid state', () => {
  const f = fixture();
  f.setEnabled(true);
  f.pointer('pointerdown', f.ui.gas);
  f.setDriving(true);
  assert.deepEqual(f.messages, [['KeyDown', 16, 0], ['KeyUp', 16]]);
  assert.equal(f.ui.move.hidden, true);
  assert.equal(f.ui.steering.hidden, false);
  assert.equal(f.ui.gas.dataset.key, '87');
  assert.equal(f.ui.brake.dataset.key, '83');
  assert.equal(f.ui.use.querySelector('b').textContent, 'Exit');
  const left = f.control({ key: '65' });
  f.pointer('pointerdown', f.ui.gas);
  f.pointer('pointerdown', left, 2, 25, 50);
  f.setDriving(true);
  f.setDriving('false');
  assert.deepEqual(f.messages.slice(-2), [['KeyDown', 87, 0], ['KeyDown', 97, 0]], 'the Left button centre is a gentle left');
  f.pointer('pointerup', left, 2);
  assert.deepEqual(f.messages.at(-1), ['KeyUp', 97]);
  f.pointer('pointerdown', f.ui.brake, 3);
  assert.deepEqual(f.messages.slice(-2), [['KeyUp', 87], ['KeyDown', 83, 0]]);
  f.pointer('pointerup', f.ui.brake, 3);
  assert.deepEqual(f.messages.slice(-2), [['KeyUp', 83], ['KeyDown', 87, 0]]);
  f.setDriving(false);
  assert.deepEqual(f.messages.at(-1), ['KeyUp', 87]);
  assert.equal(f.ui.move.hidden, false);
  assert.equal(f.ui.steering.hidden, true);
  assert.equal(f.ui.gas.dataset.key, '16');
  assert.equal(f.ui.brake.dataset.key, '32');
  assert.equal(f.ui.brake.querySelector('svg').innerHTML, 'svg');
});

test('driving controls release on menu, rotation, blur, cancel and disconnect', () => {
  for (const reason of ['menu', 'resize', 'blur', 'cancel', 'disconnect']) {
    const f = fixture();
    f.setEnabled(true); f.setDriving(true);
    const right = f.control({ key: '68' });
    f.pointer('pointerdown', f.ui.gas); f.pointer('pointerdown', right, 2, 75, 50);
    if (reason === 'menu') f.releaseAll();
    else if (reason === 'disconnect') f.setEnabled(false);
    else if (reason === 'cancel') { f.pointer('pointercancel', f.ui.gas); f.pointer('pointercancel', right, 2); }
    else f.window.dispatchEvent(new Event(reason));
    assert.deepEqual(f.messages.slice(-2), [['KeyUp', 87], ['KeyUp', 100]], reason);
    assert.equal(f.ui.gas.dataset.pressed, 'false');
    assert.equal(f.ui.steering.dataset.pressed, 'false');
  }
});


test('double-tapping Move sprints during the second hold and releases on stopping', () => {
  const f = fixture(); f.setEnabled(true); f.setDriving(false);
  f.pointer('pointerdown', f.ui.move, 1, 50, 50, 100);
  f.pointer('pointerup', f.ui.move, 1, 50, 50, 140);
  f.pointer('pointerdown', f.ui.move, 1, 50, 50, 300);
  f.pointer('pointermove', f.ui.move, 1, 50, 0, 320);
  assert.ok(f.messages.some(m => m[0] === 'KeyDown' && m[1] === 16));
  assert.equal(f.ui.gas.getAttribute('aria-pressed'), 'true');
  f.pointer('pointerup', f.ui.move, 1, 50, 0, 500);
  assert.ok(f.messages.some(m => m[0] === 'KeyUp' && m[1] === 16));
  assert.equal(f.ui.gas.getAttribute('aria-pressed'), 'false');
});

test('double-tapped Sprint stays active with Move and vehicle/menu transitions clear it', () => {
  const f = fixture(); f.setEnabled(true); f.setDriving(false);
  f.pointer('pointerdown', f.ui.move, 1, 50, 0, 50);
  f.pointer('pointerdown', f.ui.gas, 2, 50, 50, 100);
  f.pointer('pointerup', f.ui.gas, 2, 50, 50, 140);
  f.pointer('pointerdown', f.ui.brake, 3, 50, 50, 160);
  f.pointer('pointerup', f.ui.brake, 3, 50, 50, 200);
  f.pointer('pointerdown', f.ui.gas, 2, 50, 50, 280);
  f.pointer('pointerup', f.ui.gas, 2, 50, 50, 320);
  assert.equal(f.ui.gas.getAttribute('aria-pressed'), 'true');
  assert.notDeepEqual(f.messages.at(-1), ['KeyUp', 16]);
  f.setDriving(true);
  assert.ok(f.messages.some(m => m[0] === 'KeyUp' && m[1] === 16));
  assert.equal(f.ui.gas.getAttribute('aria-pressed'), 'false');
  f.releaseAll();
});

test('driving pedal and Exit drags hold their actions without turning the camera', () => {
  for (const [name, key] of [['gas', 87], ['brake', 83], ['use', 69]]) {
    const f = fixture(); f.setEnabled(true); f.setDriving(true);
    f.pointer('pointerdown', f.ui[name], 1, 40, 40);
    f.pointer('pointermove', f.ui[name], 1, 60, 45);
    assert.deepEqual(f.deltas, [], name);
    assert.deepEqual(f.messages, [['KeyDown', key, 0]], `${name} stays held without camera input`);
    f.pointer('pointerup', f.ui[name], 1, 60, 45);
    assert.deepEqual(f.messages.at(-1), ['KeyUp', key], name);
  }
});

test('dragging a held action looks without releasing it or stealing an existing look finger', () => {
  const f = fixture(); f.setEnabled(true); f.setDriving(false);
  f.pointer('pointerdown', f.ui.move, 1, 50, 0);
  f.pointer('pointerdown', f.ui.gas, 2, 40, 40);
  f.pointer('pointermove', f.ui.gas, 2, 60, 45);
  assert.deepEqual(f.deltas, [[20, 5]]);
  assert.ok(!f.messages.some(m => m[0] === 'KeyUp'));
  f.pointer('pointerdown', f.surface, 3, 40, 40);
  f.pointer('pointermove', f.ui.gas, 2, 70, 45);
  assert.equal(f.deltas.length, 1);
  f.pointer('pointercancel', f.surface, 3);
  f.pointer('pointermove', f.ui.gas, 2, 75, 45);
  assert.deepEqual(f.deltas.at(-1), [5, 0]);
  f.releaseAll();
  assert.ok(f.messages.some(m => m[0] === 'KeyUp' && m[1] === 16));
  assert.ok(f.messages.some(m => m[0] === 'KeyUp' && m[1] === 87));
});


test('swimming presents Stroke and restores Jump/Brake across movement states', () => {
  const f = fixture(); f.setEnabled(true); f.setDriving(false);
  f.setSwimming(true);
  assert.equal(f.ui.brake.querySelector('b').textContent, 'Stroke');
  assert.equal(f.ui.brake.dataset.key, '32');
  f.setSwimming('false');
  assert.equal(f.ui.brake.querySelector('b').textContent, 'Stroke');
  f.setDriving(true); f.setSwimming(false);
  assert.equal(f.ui.brake.querySelector('b').textContent, 'Brake');
  f.setDriving(false); f.setSwimming(true);
  assert.equal(f.ui.brake.querySelector('b').textContent, 'Stroke');
  f.setSwimming(false);
  assert.equal(f.ui.brake.querySelector('b').textContent, 'Jump');
});


test('assistive activation can cancel a latched sprint and inert menus cannot send keys', () => {
  const f = fixture(); f.setEnabled(true); f.setDriving(false);
  f.pointer('pointerdown', f.ui.move, 1, 50, 0, 50);
  f.pointer('pointerdown', f.ui.gas, 2, 50, 50, 100); f.pointer('pointerup', f.ui.gas, 2, 50, 50, 130);
  f.pointer('pointerdown', f.ui.gas, 2, 50, 50, 250); f.pointer('pointerup', f.ui.gas, 2, 50, 50, 280);
  assert.equal(f.ui.gas.getAttribute('aria-pressed'), 'true');
  f.click(f.ui.gas);
  assert.equal(f.ui.gas.getAttribute('aria-pressed'), 'false');
  assert.deepEqual(f.messages.at(-1), ['KeyUp', 16]);
  f.releaseAll(); const count=f.messages.length; f.root.inert=true; f.click(f.ui.brake);
  assert.equal(f.messages.length,count);
});


test('Sprint taps tolerate finger jitter but a look drag returning to its start is not a tap', () => {
  for (const distance of [3, 30]) {
    const f = fixture(); f.setEnabled(true); f.setDriving(false);
    f.pointer('pointerdown', f.ui.move, 1, 50, 0, 50);
    f.pointer('pointerdown', f.ui.gas, 2, 50, 50, 100);
    f.pointer('pointermove', f.ui.gas, 2, 50 + distance, 50, 115);
    f.pointer('pointermove', f.ui.gas, 2, 50, 50, 125);
    f.pointer('pointerup', f.ui.gas, 2, 50, 50, 140);
    f.pointer('pointerdown', f.ui.gas, 2, 50, 50, 250);
    f.pointer('pointerup', f.ui.gas, 2, 50, 50, 280);
    assert.equal(f.ui.gas.getAttribute('aria-pressed'), String(distance === 3));
    f.releaseAll();
  }
});

 test('wheel drag crosses center and reverses without lifting while Gas stays held', () => {
  const f = fixture();
  f.setEnabled(true); f.setDriving(true);
  f.pointer('pointerdown', f.ui.gas, 2);
  f.pointer('pointerdown', f.ui.steering, 1, 10, 50);
  f.pointer('pointermove', f.ui.steering, 1, 50, 50);
  f.pointer('pointermove', f.ui.steering, 1, 90, 50);
  assert.deepEqual(f.messages, [['KeyDown', 87, 0], ['KeyDown', 98, 0], ['KeyUp', 98], ['KeyDown', 101, 0]]);
  f.pointer('pointercancel', f.ui.steering);
  assert.deepEqual(f.messages.at(-1), ['KeyUp', 101]);
  assert.equal(f.ui.steering.styles.get('--steer-angle'), '0deg');
  f.pointer('pointerdown', f.ui.steering, 1, 10, 50);
  f.window.dispatchEvent(new Event('blur'));
  assert.deepEqual(f.messages.slice(-2), [['KeyUp', 87], ['KeyUp', 98]]);
  assert.equal(f.ui.steering.styles.get('--steer-angle'), '0deg');
});

test('on foot the first finger anywhere on the game moves from where it lands and a second finger looks', () => {
  const f = fixture(); f.setEnabled(true); f.setDriving(false);
  f.pointer('pointerdown', f.surface, 1, 300, 400);
  assert.equal(f.ui.move.dataset.floating, 'true');
  assert.equal(f.ui.move.styles.get('--float-x'), '300px');
  assert.equal(f.ui.move.styles.get('--float-y'), '400px');
  assert.deepEqual(f.messages, []);
  f.pointer('pointermove', f.surface, 1, 305, 395);
  assert.deepEqual(f.messages, [], 'small jitter stays in the deadzone');
  f.pointer('pointermove', f.surface, 1, 300, 340);
  assert.deepEqual(f.messages, [['KeyDown', 87, 0]], 'dragging up from the landing point walks forward');
  f.pointer('pointerdown', f.surface, 2, 600, 200);
  f.pointer('pointermove', f.surface, 2, 620, 210);
  assert.deepEqual(f.deltas, [[20, 10]], 'the second finger turns the camera');
  assert.deepEqual(f.messages.slice(1), [['MouseEnter'], ['MouseMove', 32768, 32768, 2000, 1000]]);
  f.pointer('pointerup', f.surface, 1, 300, 340);
  assert.deepEqual(f.messages.at(-1), ['KeyUp', 87]);
  assert.equal(f.ui.move.dataset.floating, undefined);
  assert.equal(f.ui.move.styles.get('--stick-x'), '0px');
  f.pointer('pointerdown', f.surface, 3, 100, 100);
  assert.equal(f.ui.move.dataset.floating, 'true', 'with no move finger down, the next finger moves again');
  f.releaseAll();
});

test('double-tapping anywhere on the game latches sprint for the second hold', () => {
  const f = fixture(); f.setEnabled(true); f.setDriving(false);
  f.pointer('pointerdown', f.surface, 1, 300, 400, 100);
  f.pointer('pointerup', f.surface, 1, 300, 400, 150);
  f.pointer('pointerdown', f.surface, 1, 310, 405, 300);
  f.pointer('pointermove', f.surface, 1, 310, 340, 320);
  assert.ok(f.messages.some(m => m[0] === 'KeyDown' && m[1] === 16));
  f.pointer('pointerup', f.surface, 1, 310, 340, 500);
  assert.ok(f.messages.some(m => m[0] === 'KeyUp' && m[1] === 16));
});

test('the wheel is a stick: up accelerates, down brakes then reverses, diagonals steer at the same time', () => {
  const f = fixture(); f.setEnabled(true); f.setDriving(true);
  f.pointer('pointerdown', f.ui.steering, 1, 50, 50);
  assert.deepEqual(f.messages, [], 'the center is neutral');
  f.pointer('pointermove', f.ui.steering, 1, 50, 10);
  assert.deepEqual(f.messages, [['KeyDown', 87, 0]], 'up accelerates');
  assert.equal(f.ui.steering.styles.get('--steer-y'), '-7px');
  f.pointer('pointermove', f.ui.steering, 1, 10, 10);
  assert.deepEqual(f.messages.at(-1), ['KeyDown', 98, 0], 'up-left accelerates and steers left');
  f.pointer('pointermove', f.ui.steering, 1, 50, 90);
  assert.deepEqual(f.messages.slice(-3), [['KeyUp', 98], ['KeyUp', 87], ['KeyDown', 83, 0]], 'down brakes, then the game reverses');
  f.pointer('pointerup', f.ui.steering, 1, 50, 90);
  assert.deepEqual(f.messages.at(-1), ['KeyUp', 83]);
  assert.equal(f.ui.steering.styles.get('--steer-y'), '0px');
});

test('in a car the first finger anywhere drives from where it lands and a second finger looks', () => {
  const f = fixture(); f.setEnabled(true); f.setDriving(true);
  f.pointer('pointerdown', f.surface, 1, 300, 400);
  assert.equal(f.ui.steering.dataset.floating, 'true');
  assert.equal(f.ui.move.dataset.floating, undefined);
  assert.equal(f.ui.steering.styles.get('--float-x'), '300px');
  f.pointer('pointermove', f.surface, 1, 260, 350);
  assert.deepEqual(f.messages, [['KeyDown', 98, 0], ['KeyDown', 87, 0]], 'up-left from the landing point accelerates and steers left');
  f.pointer('pointerdown', f.surface, 2, 600, 200);
  f.pointer('pointermove', f.surface, 2, 610, 200);
  assert.deepEqual(f.deltas, [[10, 0]], 'the second finger turns the camera');
  f.pointer('pointerup', f.surface, 1, 260, 350);
  assert.deepEqual(f.messages.slice(-2), [['KeyUp', 98], ['KeyUp', 87]]);
  assert.equal(f.ui.steering.dataset.floating, undefined);
  f.releaseAll();
});

// Steering keys the wheel can hold: A, NumPad2, NumPad1 (left 1, 0.66, 0.33) and NumPad4, NumPad5, D (right 0.33, 0.66, 1).
const steeringCodes = new Set(steerKeys.values());
function steeringHeld(messages) {
  const held = new Set();
  return messages.map(([name, code]) => {
    if (name === 'KeyDown') held.add(code);
    else if (name === 'KeyUp') held.delete(code);
    return [...held].filter(key => steeringCodes.has(key)).length;
  });
}
function heldInputs(messages) {
  const held = new Set();
  for (const [name, code] of messages) {
    if (name === 'KeyDown' || name === 'MouseDown') held.add(name === 'MouseDown' ? `mouse${code}` : code);
    else if (name === 'KeyUp' || name === 'MouseUp') held.delete(name === 'MouseUp' ? `mouse${code}` : code);
  }
  return held;
}
function interrupt(f, reason, target, pointerId = 1) {
  if (['pointerup', 'pointercancel', 'lostpointercapture'].includes(reason)) f.pointer(reason, target, pointerId);
  else if (reason === 'hidden') { f.document.hidden = true; f.document.dispatchEvent(new Event('visibilitychange')); }
  else if (reason === 'menu') {
    const event = new Event('click');
    Object.defineProperty(event, 'target', { value: { closest: selector => selector === '[data-menu-toggle]' ? {} : null } });
    f.document.dispatchEvent(event);
  } else if (reason === 'explicit') f.releaseAll();
  else if (reason === 'disconnect') f.setEnabled(false);
  else if (reason === 'exit') f.setDriving(false);
  else f.window.dispatchEvent(new Event(reason));
}

test('graded steering has three levels per side at 0.18, 0.45 and 0.75 of the wheel reach', () => {
  for (const [x, level] of [[0, 0], [.17, 0], [.18, 1], [.3, 1], [.449, 1], [.45, 2], [.6, 2], [.749, 2], [.75, 3], [1, 3]]) {
    assert.equal(gradedLevel(x, 0), level, `right ${x}`);
    assert.equal(gradedLevel(-x, 0), -level || 0, `left ${x}`);
  }
  for (const value of [NaN, Infinity, undefined]) assert.equal(gradedLevel(value, 2), 0);
  assert.deepEqual([-3, -2, -1, 1, 2, 3].map(level => steerKeys.get(level)), [65, 98, 97, 100, 101, 68]);
  assert.equal(steerKeys.has(0), false, 'the centre holds no steering key');
});

test('steering hysteresis holds a level 0.06 below its edge and resets when the wheel crosses centre', () => {
  for (const [previous, x, level] of [
    [1, .15, 1], [1, .121, 1], [1, .11, 0], [2, .4, 2], [2, .38, 1], [3, .7, 3], [3, .68, 2],
    [0, .17, 0], [1, .44, 1], [1, .45, 2], [1, .8, 3], [3, .3, 1],
    [3, -.2, -1], [-2, .3, 1], [-1, -.13, -1], [-1, -.1, 0], [-3, -.7, -3]
  ]) assert.equal(gradedLevel(x, previous), level, `level ${previous} at ${x}`);
  // Gas and brake use the same rule with one edge.
  assert.equal(gradedLevel(-.28, 0, pedalEdges), -1);
  assert.equal(gradedLevel(-.24, -1, pedalEdges), -1);
  assert.equal(gradedLevel(-.2, -1, pedalEdges), 0);
  assert.equal(gradedLevel(.25, 0, pedalEdges), 0);
});

test('dragging the wheel steps through graded levels, holds one steering key and ignores thumb jitter', () => {
  const f = fixture(); f.setEnabled(true); f.setDriving(true);
  // The 100 px mock wheel reaches 70 px: level 1 from 12.6 px, level 2 from 31.5 px, full lock from 52.5 px.
  f.pointer('pointerdown', f.ui.steering, 1, 50, 50);
  f.pointer('pointermove', f.ui.steering, 1, 58, 50);
  assert.deepEqual(f.messages, [], 'the old 9 px digital edge no longer steers');
  const steps = [[64, [['KeyDown', 100, 0]]], [60, []], [64, []],
    [83, [['KeyUp', 100], ['KeyDown', 101, 0]]], [80, []], [82, []],
    [105, [['KeyUp', 101], ['KeyDown', 68, 0]]], [100, []],
    [70, [['KeyUp', 68], ['KeyDown', 100, 0]]],
    [10, [['KeyUp', 100], ['KeyDown', 98, 0]]], [-10, [['KeyUp', 98], ['KeyDown', 65, 0]]],
    [36, [['KeyUp', 65], ['KeyDown', 97, 0]]]];
  for (const [x, expected] of steps) {
    const before = f.messages.length;
    f.pointer('pointermove', f.ui.steering, 1, x, 50);
    assert.deepEqual(f.messages.slice(before), expected, `thumb at ${x - 50} px`);
  }
  assert.equal(f.ui.steering.dataset.steer, '-1');
  f.pointer('pointerup', f.ui.steering, 1, 36, 50);
  assert.deepEqual(f.messages.at(-1), ['KeyUp', 97]);
  assert.ok(steeringHeld(f.messages).every(count => count <= 1), 'never two steering keys at once');
  assert.equal(heldInputs(f.messages).size, 0);
  assert.equal(f.ui.steering.dataset.steer, undefined);
});

test('every interruption releases a graded steering key and recentres the wheel', () => {
  for (const reason of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur', 'resize', 'orientationchange', 'pagehide',
    'hidden', 'menu', 'explicit', 'disconnect', 'exit']) {
    const f = fixture(); f.setEnabled(true); f.setDriving(true);
    f.pointer('pointerdown', f.ui.gas, 2);
    f.pointer('pointerdown', f.surface, 1, 300, 300);
    f.pointer('pointermove', f.surface, 1, 340, 300);
    assert.deepEqual(f.messages.at(-1), ['KeyDown', 101, 0], reason);
    interrupt(f, reason, f.surface);
    assert.ok(f.messages.some(([name, code]) => name === 'KeyUp' && code === 101), `${reason} releases NumPad5`);
    assert.equal([...heldInputs(f.messages)].some(key => steeringCodes.has(key)), false, `${reason} leaves no steering key held`);
    assert.equal(f.ui.steering.styles.get('--steer-angle'), '0deg', reason);
    assert.equal(f.ui.steering.dataset.floating, undefined, reason);
    assert.equal(f.ui.steering.dataset.steer, undefined, reason);
    if (!reason.startsWith('pointer') && reason !== 'lostpointercapture') assert.equal(heldInputs(f.messages).size, 0, `${reason} releases Gas too`);
  }
});

test('a keyboard-style Left pulse cannot add a second steering key while the wheel steers', async () => {
  const f = fixture(); f.setEnabled(true); f.setDriving(true);
  const left = f.control({ key: '65' });
  f.pointer('pointerdown', f.ui.steering, 1, 50, 50);
  f.pointer('pointermove', f.ui.steering, 1, 75, 50);
  assert.deepEqual(f.messages, [['KeyDown', 100, 0]]);
  f.click(left);
  assert.deepEqual(f.messages, [['KeyDown', 100, 0]], 'the wheel keeps the only steering key');
  f.pointer('pointerup', f.ui.steering, 1, 75, 50);
  assert.deepEqual(f.messages.slice(1), [['KeyUp', 100], ['KeyDown', 65, 0]], 'the pulse steers once the wheel lets go');
  await wait(150);
  assert.deepEqual(f.messages.at(-1), ['KeyUp', 65]);
  assert.ok(steeringHeld(f.messages).every(count => count <= 1));
});

test('Auto gas holds Gas until Brake, the toggle or the wheel pulled down turns it off', () => {
  const f = fixture(); f.setEnabled(true);
  f.pointer('pointerdown', f.ui.auto);
  assert.deepEqual(f.messages, [], 'Auto does nothing on foot');
  f.setDriving(true);
  assert.equal(f.ui.auto.hidden, false);
  assert.equal(f.ui.auto.getAttribute('aria-pressed'), 'false', 'Auto starts off');
  const down = f.pointer('pointerdown', f.ui.auto, 4);
  assert.equal(down.defaultPrevented, true);
  assert.deepEqual(f.messages, [['KeyDown', 87, 0]]);
  assert.equal(f.ui.auto.getAttribute('aria-pressed'), 'true');
  assert.equal(f.ui.gas.dataset.pressed, 'true', 'Gas shows as held');
  f.pointer('pointerup', f.ui.auto, 4);
  f.click(f.ui.auto, 1);
  assert.equal(f.ui.auto.getAttribute('aria-pressed'), 'true', 'the tap’s own click does not toggle it back');
  f.pointer('pointerdown', f.ui.gas, 2); f.pointer('pointerup', f.ui.gas, 2);
  assert.deepEqual(f.messages, [['KeyDown', 87, 0]], 'lifting Gas keeps auto gas held');
  f.pointer('pointerdown', f.ui.brake, 3);
  assert.deepEqual(f.messages.slice(1), [['KeyUp', 87], ['KeyDown', 83, 0]], 'Brake releases Gas');
  assert.equal(f.ui.auto.getAttribute('aria-pressed'), 'false', 'Brake turns Auto off');
  f.pointer('pointerup', f.ui.brake, 3);
  assert.deepEqual(f.messages.slice(3), [['KeyUp', 83]], 'Gas stays released after Brake');
  f.pointer('pointerdown', f.ui.auto, 4);
  f.pointer('pointerdown', f.ui.auto, 5);
  assert.deepEqual(f.messages.slice(4), [['KeyDown', 87, 0], ['KeyUp', 87]], 'a second tap turns Auto off');
  f.pointer('pointerdown', f.ui.auto, 4);
  f.pointer('pointerdown', f.ui.steering, 1, 50, 50);
  f.pointer('pointermove', f.ui.steering, 1, 70, 50);
  assert.deepEqual(f.messages.slice(-2), [['KeyDown', 87, 0], ['KeyDown', 100, 0]], 'steering keeps auto gas');
  f.pointer('pointermove', f.ui.steering, 1, 70, 90);
  assert.deepEqual(f.messages.slice(-2), [['KeyUp', 87], ['KeyDown', 83, 0]], 'pulling the wheel down brakes');
  f.pointer('pointerup', f.ui.steering, 1, 70, 90);
  assert.equal(f.ui.auto.getAttribute('aria-pressed'), 'false');
  assert.equal(heldInputs(f.messages).size, 0);
  f.click(f.ui.auto);
  assert.deepEqual(f.messages.at(-1), ['KeyDown', 87, 0], 'keyboard and switch access toggle Auto');
  f.click(f.ui.auto);
  assert.deepEqual(f.messages.at(-1), ['KeyUp', 87]);
});

test('Auto gas turns off on every release path and stays off afterwards', () => {
  for (const reason of ['blur', 'resize', 'orientationchange', 'pagehide', 'hidden', 'menu', 'explicit', 'disconnect', 'exit']) {
    const f = fixture(); f.setEnabled(true); f.setDriving(true);
    f.pointer('pointerdown', f.ui.auto, 4);
    assert.deepEqual(f.messages, [['KeyDown', 87, 0]], reason);
    interrupt(f, reason, f.ui.auto, 4);
    assert.deepEqual(f.messages.at(-1), ['KeyUp', 87], reason);
    assert.equal(f.ui.auto.getAttribute('aria-pressed'), 'false', reason);
    f.document.hidden = false;
    f.setEnabled(true); f.setDriving(true);
    f.pointer('pointerdown', f.ui.steering, 1, 50, 50);
    f.pointer('pointerup', f.ui.steering, 1, 50, 50);
    assert.equal(f.messages.length, 2, `${reason}: Auto does not come back by itself`);
  }
});

test('on foot Fire holds F, Weapon taps Q and Aim holds the right mouse button; combat hides in a car', () => {
  const f = fixture(); f.setEnabled(true); f.setDriving(false);
  assert.equal(f.ui.combat.hidden, false);
  assert.equal(f.ui.auto.hidden, true);
  f.pointer('pointerdown', f.ui.fire, 1);
  assert.deepEqual(f.messages, [['KeyDown', 70, 0]]);
  assert.equal(f.ui.fire.dataset.pressed, 'true');
  f.pointer('pointerup', f.ui.fire, 1);
  assert.deepEqual(f.messages.at(-1), ['KeyUp', 70]);
  assert.equal(f.ui.fire.dataset.pressed, 'false');
  f.pointer('pointerdown', f.ui.weapon, 2); f.pointer('pointerup', f.ui.weapon, 2);
  assert.deepEqual(f.messages.slice(2), [['KeyDown', 81, 0], ['KeyUp', 81]]);
  f.pointer('pointerdown', f.ui.aim, 3);
  assert.deepEqual(f.messages.slice(4), [['MouseEnter'], ['MouseDown', 2, 32768, 32768]]);
  assert.equal(f.ui.aim.dataset.pressed, 'true');
  f.pointer('pointerdown', f.ui.fire, 4);
  f.pointer('pointermove', f.ui.aim, 3, 70, 50);
  assert.deepEqual(f.deltas, [[20, 0]], 'dragging a held Aim turns the camera');
  assert.equal(heldInputs(f.messages).has('mouse2'), true, 'and keeps aiming');
  assert.equal(heldInputs(f.messages).has(70), true, 'while firing');
  f.pointer('pointerup', f.ui.aim, 3, 70, 50);
  assert.deepEqual(f.messages.at(-1), ['MouseUp', 2, 32768, 32768]);
  f.setDriving(true);
  assert.deepEqual(f.messages.at(-1), ['KeyUp', 70], 'entering a car releases Fire');
  assert.equal(f.ui.combat.hidden, true);
  assert.equal(f.ui.auto.hidden, false);
  f.setDriving(false);
  assert.equal(f.ui.combat.hidden, false);
  assert.equal(f.ui.auto.hidden, true);
  assert.equal(heldInputs(f.messages).size, 0);
});

test('Aim and Fire release on every interruption and keyboard activation pulses them', async () => {
  for (const reason of ['pointercancel', 'lostpointercapture', 'blur', 'resize', 'orientationchange', 'pagehide', 'hidden', 'menu', 'explicit', 'disconnect']) {
    const f = fixture(); f.setEnabled(true); f.setDriving(false);
    f.pointer('pointerdown', f.ui.aim, 1);
    f.pointer('pointerdown', f.ui.fire, 2);
    interrupt(f, reason, f.ui.aim, 1);
    if (reason.includes('pointer')) interrupt(f, reason, f.ui.fire, 2);
    assert.equal(heldInputs(f.messages).size, 0, reason);
    assert.ok(f.messages.some(message => message[0] === 'MouseUp' && message[1] === 2), reason);
    assert.equal(f.ui.aim.dataset.pressed, 'false', reason);
  }
  const f = fixture(); f.setEnabled(true); f.setDriving(false);
  f.click(f.ui.aim);
  f.click(f.ui.weapon);
  assert.deepEqual(f.messages, [['MouseEnter'], ['MouseDown', 2, 32768, 32768], ['KeyDown', 81, 0]]);
  await wait(150);
  assert.deepEqual(f.messages.slice(3), [['MouseUp', 2, 32768, 32768], ['KeyUp', 81]]);
});
