import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as wait } from 'node:timers/promises';
import { setupTouchControls } from './touch-controls.js';

function fixture() {
  const window = new EventTarget();
  const document = Object.assign(new EventTarget(), { defaultView: window, hidden: false });
  const root = Object.assign(new EventTarget(), { ownerDocument: document, contains: target => controls.includes(target) });
  const controls = [];
  const messages = [];
  const deltas = [];
  const stream = {
    toStreamerHandlers: new Map(['KeyDown', 'KeyUp', 'MouseMove', 'MouseEnter'].map(name => [name, values => messages.push([name, ...values])])),
    webRtcController: { coordinateConverter: { translateSigned: (x, y) => { deltas.push([x, y]); return { x: x * 100, y: y * 100 }; } } }
  };
  function control(dataset) {
    const captures = new Set();
    const styles = new Map();
    const target = {
      dataset, styles, closest() { return this; },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
      style: { setProperty: (key, value) => styles.set(key, value) },
      setPointerCapture: id => captures.add(id), hasPointerCapture: id => captures.has(id), releasePointerCapture: id => captures.delete(id)
    };
    controls.push(target);
    return target;
  }
  function pointer(type, target, pointerId = 1, clientX = 50, clientY = 50) {
    const event = new Event(type, { cancelable: true });
    Object.defineProperties(event, Object.fromEntries(Object.entries({ target, pointerId, clientX, clientY, button: 0 }).map(([key, value]) => [key, { value }])));
    root.dispatchEvent(event);
  }
  function click(target, detail = 0) {
    const event = new Event('click');
    Object.defineProperties(event, { target: { value: target }, detail: { value: detail } });
    root.dispatchEvent(event);
  }
  return { root, document, window, messages, deltas, control, pointer, click, ...setupTouchControls({ root, stream }) };
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
  const look = f.control({ stick: 'look' });
  f.setEnabled(true);
  f.pointer('pointerdown', look, 1, 80, 40);
  f.pointer('pointermove', look, 1, 90, 35);
  f.pointer('pointermove', look, 1, 1000, -1000);
  f.pointer('pointercancel', look);
  f.pointer('pointermove', look, 1, 1100, 0);
  assert.deepEqual(f.deltas, [[10, -5], [910, -1035]]);
  assert.deepEqual(f.messages, [['MouseEnter'], ['MouseMove', 32768, 32768, 1000, -500], ['MouseMove', 32768, 32768, 32767, -32767]]);
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
