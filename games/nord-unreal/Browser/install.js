export function initInstall(win = window) {
  const doc = win.document;
  const button = doc.getElementById('install-app');
  const help = doc.getElementById('install-help');
  const nudge = doc.getElementById('install-nudge');
  const nudgeButton = doc.getElementById('install-nudge-button');
  const nudgeHelp = doc.getElementById('install-nudge-help');
  const menu = doc.getElementById('menu');
  const standalone = win.matchMedia('(display-mode: standalone)');
  const reminderKey = 'gta-north-install-reminder';
  const week = 7 * 24 * 60 * 60 * 1000;
  let lastShown = 0;
  try {
    const saved = Number(win.localStorage.getItem(reminderKey));
    if (Number.isFinite(saved) && saved > 0) lastShown = saved;
  } catch {}
  let installed = false;
  let deferredPrompt = null;
  let prompting = false;
  let ownedFocus = false;
  let shown = false;
  let dismissed = false;
  let remaining = 120000;
  let startedAt = null;
  let timer;
  const lostFocus = () => ownedFocus && doc.activeElement === doc.body;
  const isInstalled = () => installed || standalone.matches || win.navigator.standalone === true;
  const playing = () => doc.body.dataset.state === 'playing' && !doc.hidden && menu.hidden
    && doc.getElementById('intro').hidden && doc.getElementById('crew-picker').hidden && !doc.querySelector('dialog[open]');
  const returnFocus = () => doc.getElementById(menu.hidden ? 'video' : 'menu-close').focus();
  function hideNudge() {
    const focused = nudge.contains(doc.activeElement);
    nudge.hidden = true;
    if (focused) returnFocus();
  }
  function sync() {
    const now = win.performance.now();
    if (startedAt !== null) remaining = Math.max(0, remaining - (now - startedAt));
    startedAt = null;
    win.clearTimeout(timer);
    button.hidden = isInstalled();
    if (button.hidden) {
      help.hidden = true;
      if (doc.activeElement === button || lostFocus()) returnFocus();
    }
    if (!playing() || isInstalled() || dismissed || (!shown && lastShown > 0 && win.Date.now() - lastShown < week)) {
      hideNudge();
      return;
    }
    if (shown) { nudge.hidden = false; return; }
    if (remaining > 0) {
      startedAt = now;
      timer = win.setTimeout(sync, remaining);
      return;
    }
    // Offer at the next free moment instead of interrupting held game controls.
    if (doc.pointerLockElement || doc.querySelector('#frame[data-pressed="true"], #touch-controls [data-pressed="true"]')) return;
    shown = true;
    nudge.hidden = false;
    try { win.localStorage.setItem(reminderKey, String(win.Date.now())); } catch {}
  }
  function dismiss() {
    dismissed = true;
    hideNudge();
    sync();
  }
  doc.getElementById('install-nudge-dismiss').addEventListener('click', dismiss);
  doc.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || nudge.hidden || event.defaultPrevented) return;
    event.preventDefault();
    dismiss();
  });
  const observer = new win.MutationObserver(sync);
  observer.observe(doc.body, { attributes: true, attributeFilter: ['data-state'] });
  for (const id of ['menu', 'intro', 'crew-picker', 'trailer-dialog']) {
    observer.observe(doc.getElementById(id), { attributes: true, attributeFilter: ['hidden', 'open'] });
  }
  observer.observe(doc.getElementById('frame'), { attributes: true, attributeFilter: ['data-pressed'] });
  observer.observe(doc.getElementById('touch-controls'), { attributes: true, subtree: true, attributeFilter: ['data-pressed'] });
  doc.addEventListener('visibilitychange', sync);
  doc.addEventListener('pointerlockchange', sync);

  win.addEventListener('beforeinstallprompt', event => {
    if (isInstalled()) return;
    event.preventDefault();
    deferredPrompt = event;
    help.hidden = nudgeHelp.hidden = true;
  });
  async function install(event) {
    if (isInstalled() || prompting) return;
    const action = event.currentTarget;
    const instructions = action === button ? help : nudgeHelp;
    if (!deferredPrompt) {
      instructions.textContent = help.textContent;
      instructions.hidden = false;
      return;
    }
    const offer = deferredPrompt;
    deferredPrompt = null;
    prompting = true;
    ownedFocus = doc.activeElement === action;
    button.disabled = nudgeButton.disabled = true;
    help.hidden = nudgeHelp.hidden = true;
    try {
      const choice = offer.userChoice;
      // A failed prompt can reject its separate choice promise too.
      choice.catch(() => {});
      await offer.prompt();
      installed = installed || (await choice).outcome === 'accepted';
    } catch {
      if (!isInstalled()) {
        instructions.textContent = help.textContent;
        instructions.hidden = false;
      }
    } finally {
      prompting = false;
      button.disabled = nudgeButton.disabled = false;
      sync();
      if (lostFocus()) {
        if (!isInstalled() && (action === button ? !menu.hidden : !nudge.hidden)) action.focus();
        else returnFocus();
      }
      ownedFocus = false;
    }
  }
  button.addEventListener('click', install);
  nudgeButton.addEventListener('click', install);
  win.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    sync();
  });
  standalone.addEventListener('change', sync);
  sync();
}

if (typeof window !== 'undefined') initInstall(window);
