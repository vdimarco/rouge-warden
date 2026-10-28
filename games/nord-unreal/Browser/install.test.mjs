import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initInstall } from './install.js';

const settle = () => new Promise(resolve => setImmediate(resolve));
function fixture({ standalone = false, iosStandalone = false, storage = new Map(), storageFailure = false } = {}) {
  const body = { dataset: { state: 'offline' } };
  const nodes = new Map();
  const observers = [];
  let trailerOpen = false;
  let heldTouch = false;
  let heldFrame = false;
  const document = Object.assign(new EventTarget(), {
    body, activeElement: body, hidden: false, pointerLockElement: null,
    getElementById: id => nodes.get(id),
    querySelector: selector => {
      if (selector.includes('dialog[open]') && trailerOpen) return {};
      if (selector.includes('#frame[data-pressed="true"]') && heldFrame) return nodes.get('frame');
      if (selector.includes('#touch-controls [data-pressed="true"]') && heldTouch) return {};
      return null;
    }
  });
  for (const id of ['install-app', 'install-help', 'menu-close', 'install-nudge', 'install-nudge-button',
    'install-nudge-dismiss', 'install-nudge-help', 'menu', 'intro', 'crew-picker', 'video', 'trailer-dialog', 'touch-controls', 'frame']) {
    const node = Object.assign(new EventTarget(), {
      hidden: !['install-app', 'menu-close', 'video'].includes(id), disabled: false,
      textContent: id === 'install-help' ? 'Browser install / Safari Share instructions' : '',
      focus() { document.activeElement = node; },
      contains: target => target === node || id === 'install-nudge' && ['install-nudge-button', 'install-nudge-dismiss', 'install-nudge-help'].some(child => nodes.get(child) === target)
    });
    let disabled = false;
    Object.defineProperty(node, 'disabled', {
      get: () => disabled,
      set(value) {
        disabled = value;
        if (value && document.activeElement === node) document.activeElement = body;
      }
    });
    nodes.set(id, node);
  }
  const button = nodes.get('install-app');
  const help = nodes.get('install-help');
  const close = nodes.get('menu-close');
  const displayMode = Object.assign(new EventTarget(), { matches: standalone });
  const timers = new Map();
  const epoch = 1_800_000_000_000;
  let now = 0;
  let timerId = 0;
  const win = Object.assign(new EventTarget(), {
    document,
    navigator: { standalone: iosStandalone },
    performance: { now: () => now },
    Date: { now: () => epoch + now },
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout: id => timers.delete(id),
    MutationObserver: class {
      constructor(callback) { this.targets = new Set(); observers.push({ callback, targets: this.targets }); }
      observe(target) { assert.ok(target, 'observed DOM nodes must exist'); this.targets.add(target); }
    },
    localStorage: {
      getItem(key) { if (storageFailure) throw new Error('Storage denied'); return storage.get(key) ?? null; },
      setItem(key, value) { if (storageFailure) throw new Error('Storage denied'); storage.set(key, String(value)); }
    },
    matchMedia: query => {
      assert.equal(query, '(display-mode: standalone)');
      return displayMode;
    }
  });
  const mutate = (target = body) => { for (const observer of observers) if (observer.targets.has(target)) observer.callback(); };
  initInstall(win);
  return {
    button, help, close, win, nodes, storage, timers,
    get now() { return now; },
    get wallNow() { return epoch + now; },
    click: (id = 'install-app') => nodes.get(id).dispatchEvent(new Event('click')),
    mode(value) { displayMode.matches = value; displayMode.dispatchEvent(new Event('change')); },
    installed: () => win.dispatchEvent(new Event('appinstalled')),
    state(value) { body.dataset.state = value; mutate(); },
    overlay(id, open) { nodes.get(id).hidden = !open; mutate(nodes.get(id)); },
    intro(value) { nodes.get('intro').hidden = !value; if (value) body.dataset.intro = 'open'; else delete body.dataset.intro; mutate(nodes.get('intro')); },
    trailer(open) { trailerOpen = open; mutate(nodes.get('trailer-dialog')); },
    background(value) { document.hidden = value; document.dispatchEvent(new Event('visibilitychange')); },
    pointerLock(value) { document.pointerLockElement = value ? nodes.get('video') : null; document.dispatchEvent(new Event('pointerlockchange')); },
    heldTouch(value) { heldTouch = value; document.dispatchEvent(new Event(value ? 'pointerdown' : 'pointerup')); mutate(nodes.get('touch-controls')); },
    heldFrame(value) { heldFrame = value; document.dispatchEvent(new Event(value ? 'pointerdown' : 'pointerup')); mutate(nodes.get('frame')); },
    escape() { const event = Object.assign(new Event('keydown', { cancelable: true }), { key: 'Escape' }); document.dispatchEvent(event); return event; },
    tick(ms) {
      const end = now + ms;
      let calls = 0;
      while (true) {
        const pending = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!pending) break;
        assert.ok(++calls < 10_000, 'timer loop must make progress');
        const [id, timer] = pending;
        timers.delete(id);
        now = timer.at;
        timer.callback();
      }
      now = end;
    },
    offer(prompt, userChoice) {
      const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt, userChoice });
      win.dispatchEvent(event);
      return event;
    }
  };
}

test('native install is deferred until a click and acceptance hides the action', async () => {
  const f = fixture();
  let calls = 0;
  const event = f.offer(() => { calls++; }, Promise.resolve({ outcome: 'accepted' }));
  assert.equal(event.defaultPrevented, true);
  assert.equal(calls, 0);
  f.click();
  assert.equal(calls, 1, 'prompt runs synchronously in the click gesture');
  assert.equal(f.button.disabled, true);
  await settle();
  assert.equal(f.button.hidden, true);
  assert.equal(f.help.hidden, true);
  assert.equal(f.button.disabled, false);
});

test('duplicate clicks cannot reuse a prompt; dismissal restores the action and consumes the event', async () => {
  const f = fixture();
  let calls = 0;
  let choose;
  f.offer(() => { calls++; }, new Promise(resolve => { choose = resolve; }));
  f.click(); f.click();
  assert.equal(calls, 1);
  choose({ outcome: 'dismissed' });
  await settle();
  assert.equal(f.button.hidden, false);
  assert.equal(f.button.disabled, false);
  f.click();
  assert.equal(calls, 1);
  assert.equal(f.help.hidden, false, 'a consumed prompt falls back to browser instructions');
  f.offer(() => { calls++; }, Promise.resolve({ outcome: 'accepted' }));
  assert.equal(f.help.hidden, true);
  f.click(); await settle();
  assert.equal(calls, 2, 'a fresh browser offer may be used');
  assert.equal(f.button.hidden, true);
});

test('prompt throws or rejections show instructions without an unhandled error or retrying the consumed event', async () => {
  for (const failure of ['throw', 'prompt rejection', 'choice rejection', 'both reject']) {
    const f = fixture();
    let calls = 0;
    const choice = ['choice rejection', 'both reject'].includes(failure) ? Promise.reject(new Error(failure)) : Promise.resolve({ outcome: 'accepted' });
    f.offer(() => {
      calls++;
      if (failure === 'throw') throw new Error(failure);
      if (['prompt rejection', 'both reject'].includes(failure)) return Promise.reject(new Error(failure));
    }, choice);
    f.click(); await settle();
    assert.equal(f.button.hidden, false, failure);
    assert.equal(f.button.disabled, false, failure);
    assert.equal(f.help.hidden, false, failure);
    f.click(); await settle();
    assert.equal(calls, 1, failure);
  }
});

test('unsupported browsers reveal the existing manual instructions only on request', () => {
  const f = fixture();
  assert.equal(f.button.hidden, false);
  assert.equal(f.help.hidden, true);
  f.click();
  assert.equal(f.help.hidden, false);
  assert.equal(f.help.textContent, 'Browser install / Safari Share instructions');
  assert.equal(f.button.disabled, false);
});

test('standalone on launch and display-mode changes hide the button and help', () => {
  for (const options of [{ standalone: true }, { iosStandalone: true }]) {
    const f = fixture(options);
    assert.equal(f.button.hidden, true);
    f.click();
    assert.equal(f.help.hidden, true);
  }
  const f = fixture();
  f.click();
  f.mode(true);
  assert.equal(f.button.hidden, true);
  assert.equal(f.help.hidden, true);
  f.mode(false);
  assert.equal(f.button.hidden, false);
});

test('appinstalled wins over a late failed prompt and future offers', async () => {
  const f = fixture();
  let reject;
  f.offer(() => new Promise((resolve, fail) => { reject = fail; }), Promise.resolve({ outcome: 'dismissed' }));
  f.click();
  f.installed();
  assert.equal(f.button.hidden, true);
  reject(new Error('late rejection'));
  await settle();
  assert.equal(f.button.hidden, true);
  assert.equal(f.help.hidden, true);
  let calls = 0;
  f.offer(() => { calls++; }, Promise.resolve({ outcome: 'accepted' }));
  f.click(); await settle();
  assert.equal(calls, 0);
});

test('hiding the focused install action returns focus to Close without stealing other focus', async () => {
  for (const state of ['accepted', 'appinstalled', 'standalone']) {
    const f = fixture();
    f.overlay('menu', true);
    f.button.focus();
    if (state === 'accepted') {
      f.offer(() => {}, Promise.resolve({ outcome: 'accepted' }));
      f.click();
      assert.equal(f.win.document.activeElement, f.win.document.body, 'disabling the focused button blurs it');
      await settle();
    } else if (state === 'appinstalled') f.installed();
    else f.mode(true);
    assert.equal(f.button.hidden, true, state);
    assert.equal(f.win.document.activeElement, f.close, state);
  }
  const f = fixture();
  const other = {};
  f.win.document.activeElement = other;
  f.installed();
  assert.equal(f.win.document.activeElement, other);
});

test('dismissed or failed prompts restore an owned focus lost by disabling the button', async () => {
  for (const result of ['dismissed', 'prompt rejection', 'choice rejection']) {
    const f = fixture();
    f.overlay('menu', true);
    let choose, failPrompt, failChoice;
    const choice = new Promise((resolve, reject) => { choose = resolve; failChoice = reject; });
    f.offer(() => result === 'prompt rejection' ? new Promise((resolve, reject) => { failPrompt = reject; }) : undefined, choice);
    f.button.focus();
    f.click();
    assert.equal(f.win.document.activeElement, f.win.document.body, result);
    if (result === 'prompt rejection') failPrompt(new Error(result));
    else if (result === 'choice rejection') failChoice(new Error(result));
    else choose({ outcome: 'dismissed' });
    await settle();
    assert.equal(f.button.disabled, false, result);
    assert.equal(f.button.hidden, false, result);
    assert.equal(f.win.document.activeElement, f.button, result);
  }
});

test('prompt completion never steals focus moved to another control', async () => {
  for (const result of ['accepted', 'dismissed', 'appinstalled']) {
    const f = fixture();
    let choose;
    f.offer(() => {}, new Promise(resolve => { choose = resolve; }));
    f.button.focus();
    f.click();
    const other = {};
    f.win.document.activeElement = other;
    if (result === 'appinstalled') f.installed();
    choose({ outcome: result === 'accepted' ? 'accepted' : 'dismissed' });
    await settle();
    assert.equal(f.win.document.activeElement, other, result);
  }
});

test('appinstalled during a pending prompt restores Close focus once and a late failure keeps it', async () => {
  const f = fixture();
  f.overlay('menu', true);
  let fail;
  f.offer(() => new Promise((resolve, reject) => { fail = reject; }), Promise.resolve({ outcome: 'dismissed' }));
  f.button.focus();
  f.click();
  assert.equal(f.win.document.activeElement, f.win.document.body);
  f.installed();
  assert.equal(f.win.document.activeElement, f.close);
  fail(new Error('late failure'));
  await settle();
  assert.equal(f.button.hidden, true);
  assert.equal(f.win.document.activeElement, f.close);
  f.win.document.activeElement = f.win.document.body;
  f.installed();
  assert.equal(f.win.document.activeElement, f.win.document.body, 'completed prompts release focus ownership');
});

const reminderKey = 'gta-north-install-reminder';
const week = 7 * 24 * 60 * 60 * 1000;
function startPlaying(f) {
  f.state('playing');
  f.nodes.get('video').focus();
}

test('reminder waits for two cumulative visible playing minutes and never prompts or steals focus on its own', () => {
  const f = fixture();
  let calls = 0;
  f.offer(() => { calls++; }, Promise.resolve({ outcome: 'accepted' }));
  f.tick(300_000);
  assert.equal(f.nodes.get('install-nudge').hidden, true, 'title time does not count');
  startPlaying(f);
  f.tick(119_999);
  assert.equal(f.nodes.get('install-nudge').hidden, true);
  f.tick(1);
  assert.equal(f.nodes.get('install-nudge').hidden, false);
  assert.equal(calls, 0);
  assert.equal(f.win.document.activeElement, f.nodes.get('video'));
  assert.equal(f.storage.get(reminderKey), String(f.wallNow));
});

test('background, disconnect and each overlay pause elapsed play time and hide an already shown reminder', () => {
  const blockers = [
    ['background', (f, open) => f.background(open)],
    ['disconnected', (f, open) => f.state(open ? 'disconnected' : 'playing')],
    ['menu', (f, open) => f.overlay('menu', open)],
    ['intro', (f, open) => f.intro(open)],
    ['crew-picker', (f, open) => f.overlay('crew-picker', open)],
    ['trailer', (f, open) => f.trailer(open)]
  ];
  for (const [name, block] of blockers) {
    const f = fixture();
    startPlaying(f);
    f.tick(40_000);
    block(f, true);
    f.tick(200_000);
    assert.equal(f.nodes.get('install-nudge').hidden, true, name);
    block(f, false);
    f.tick(79_999);
    assert.equal(f.nodes.get('install-nudge').hidden, true, name);
    f.tick(1);
    assert.equal(f.nodes.get('install-nudge').hidden, false, name);
    const shownAt = f.storage.get(reminderKey);
    block(f, true);
    assert.equal(f.nodes.get('install-nudge').hidden, true, name);
    block(f, false);
    assert.equal(f.nodes.get('install-nudge').hidden, false, name);
    assert.equal(f.storage.get(reminderKey), shownAt, 'resuming the same reminder does not refresh its cooldown');
  }
});

test('a threshold reached with pointer lock, a held action or a frame look-drag waits for a free moment', () => {
  for (const input of ['pointerLock', 'heldTouch', 'heldFrame']) {
    const f = fixture();
    startPlaying(f);
    f[input](true);
    f.tick(150_000);
    assert.equal(f.nodes.get('install-nudge').hidden, true, input);
    assert.equal(f.storage.has(reminderKey), false, 'deferred reminders have not been shown');
    f[input](false);
    assert.equal(f.nodes.get('install-nudge').hidden, false, input);
    assert.equal(f.storage.get(reminderKey), String(f.wallNow));
  }
});

test('Not now and Escape dismiss for the page session and preserve gameplay focus', () => {
  for (const method of ['button', 'Escape']) {
    const f = fixture();
    startPlaying(f);
    f.tick(120_000);
    if (method === 'button') {
      f.nodes.get('install-nudge-dismiss').focus();
      f.click('install-nudge-dismiss');
      assert.equal(f.win.document.activeElement, f.nodes.get('video'));
    } else {
      const event = f.escape();
      assert.equal(event.defaultPrevented, true);
      assert.equal(f.win.document.activeElement, f.nodes.get('video'));
    }
    assert.equal(f.nodes.get('install-nudge').hidden, true, method);
    f.state('disconnected'); f.state('playing'); f.tick(week + 1);
    assert.equal(f.nodes.get('install-nudge').hidden, true, 'dismissal survives state changes and cooldown expiry within one page');
    assert.equal(f.button.hidden, false, 'menu installation remains available');
  }
});

test('a shown reminder sets a seven-day cooldown shared with the next page', () => {
  const f = fixture();
  startPlaying(f); f.tick(120_000);
  const recent = fixture({ storage: f.storage });
  startPlaying(recent); recent.tick(120_000);
  assert.equal(recent.nodes.get('install-nudge').hidden, true);
  const expired = fixture({ storage: new Map([[reminderKey, String(1_800_000_000_000 - week)]]) });
  startPlaying(expired); expired.tick(120_000);
  assert.equal(expired.nodes.get('install-nudge').hidden, false, 'the exact seven-day boundary permits a reminder after play');
});

test('malformed timestamps and denied localStorage do not break reminder display or dismissal', () => {
  for (const options of [
    { storageFailure: true },
    { storage: new Map([[reminderKey, 'not a timestamp']]) },
    { storage: new Map([[reminderKey, 'Infinity']]) }
  ]) {
    const f = fixture(options);
    startPlaying(f); f.tick(120_000);
    assert.equal(f.nodes.get('install-nudge').hidden, false);
    f.click('install-nudge-dismiss');
    f.background(true); f.tick(week); f.background(false);
    assert.equal(f.nodes.get('install-nudge').hidden, true);
  }
});

test('installed apps suppress reminders on launch and after a pending or displayed reminder', () => {
  for (const options of [{ standalone: true }, { iosStandalone: true }]) {
    const f = fixture(options);
    startPlaying(f); f.tick(120_000);
    assert.equal(f.nodes.get('install-nudge').hidden, true);
  }
  const pending = fixture();
  startPlaying(pending); pending.tick(60_000); pending.installed(); pending.tick(120_000);
  assert.equal(pending.nodes.get('install-nudge').hidden, true);
  const shown = fixture();
  startPlaying(shown); shown.tick(120_000);
  shown.nodes.get('install-nudge-button').focus();
  shown.installed();
  assert.equal(shown.nodes.get('install-nudge').hidden, true);
  assert.equal(shown.win.document.activeElement, shown.nodes.get('video'));
});

test('reminder installation shares the click-only native flow and unsupported instructions', async () => {
  const unsupported = fixture();
  startPlaying(unsupported); unsupported.tick(120_000);
  assert.equal(unsupported.nodes.get('install-nudge-help').hidden, true);
  unsupported.click('install-nudge-button');
  assert.equal(unsupported.nodes.get('install-nudge-help').hidden, false);
  assert.equal(unsupported.nodes.get('install-nudge-help').textContent, unsupported.help.textContent);

  const f = fixture();
  let calls = 0;
  let choose;
  f.offer(() => { calls++; }, new Promise(resolve => { choose = resolve; }));
  startPlaying(f); f.tick(120_000);
  assert.equal(calls, 0);
  f.nodes.get('install-nudge-button').focus();
  f.click('install-nudge-button'); f.click('install-nudge-button'); f.click();
  assert.equal(calls, 1);
  assert.equal(f.button.disabled, true);
  assert.equal(f.nodes.get('install-nudge-button').disabled, true);
  choose({ outcome: 'dismissed' });
  await settle();
  assert.equal(f.nodes.get('install-nudge').hidden, false);
  assert.equal(f.win.document.activeElement, f.nodes.get('install-nudge-button'));
  assert.equal(f.button.disabled, false);
  f.offer(() => { calls++; }, Promise.resolve({ outcome: 'accepted' }));
  f.click('install-nudge-button'); await settle();
  assert.equal(calls, 2);
  assert.equal(f.nodes.get('install-nudge').hidden, true);
  assert.equal(f.button.hidden, true);
  assert.equal(f.win.document.activeElement, f.nodes.get('video'));
});
