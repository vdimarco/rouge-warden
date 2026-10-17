import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initInstall } from './install.js';

const settle = () => new Promise(resolve => setImmediate(resolve));
function fixture({ standalone = false, iosStandalone = false } = {}) {
  const button = Object.assign(new EventTarget(), { hidden: false, disabled: false });
  const help = { hidden: true, textContent: 'Browser install / Safari Share instructions' };
  const close = { focus() { document.activeElement = close; } };
  const body = {};
  const document = {
    body, activeElement: body,
    getElementById: id => ({ 'install-app': button, 'install-help': help, 'menu-close': close })[id]
  };
  button.focus = () => { document.activeElement = button; };
  let disabled = false;
  Object.defineProperty(button, 'disabled', {
    get: () => disabled,
    set(value) {
      disabled = value;
      if (value && document.activeElement === button) document.activeElement = body;
    }
  });
  const displayMode = Object.assign(new EventTarget(), { matches: standalone });
  const win = Object.assign(new EventTarget(), {
    document,
    navigator: { standalone: iosStandalone },
    matchMedia: query => {
      assert.equal(query, '(display-mode: standalone)');
      return displayMode;
    }
  });
  initInstall(win);
  return {
    button, help, close, win,
    click: () => button.dispatchEvent(new Event('click')),
    mode(value) { displayMode.matches = value; displayMode.dispatchEvent(new Event('change')); },
    installed: () => win.dispatchEvent(new Event('appinstalled')),
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
