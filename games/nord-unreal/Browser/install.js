export function initInstall(win = window) {
  const button = win.document.getElementById('install-app');
  const help = win.document.getElementById('install-help');
  const standalone = win.matchMedia('(display-mode: standalone)');
  let installed = false;
  let deferredPrompt = null;
  let prompting = false;
  let ownedFocus = false;
  const lostFocus = () => ownedFocus && win.document.activeElement === win.document.body;
  const isInstalled = () => installed || standalone.matches || win.navigator.standalone === true;
  function sync() {
    button.hidden = isInstalled();
    if (button.hidden) {
      help.hidden = true;
      if (win.document.activeElement === button || lostFocus()) win.document.getElementById('menu-close').focus();
    }
  }

  win.addEventListener('beforeinstallprompt', event => {
    if (isInstalled()) return;
    event.preventDefault();
    deferredPrompt = event;
    help.hidden = true;
  });
  button.addEventListener('click', async () => {
    if (isInstalled() || prompting) return;
    if (!deferredPrompt) { help.hidden = false; return; }
    const event = deferredPrompt;
    deferredPrompt = null;
    prompting = true;
    ownedFocus = win.document.activeElement === button;
    button.disabled = true;
    help.hidden = true;
    try {
      const choice = event.userChoice;
      // A failed prompt can reject its separate choice promise too.
      choice.catch(() => {});
      await event.prompt();
      installed = installed || (await choice).outcome === 'accepted';
    } catch {
      if (!isInstalled()) help.hidden = false;
    } finally {
      prompting = false;
      button.disabled = false;
      sync();
      if (!button.hidden && lostFocus()) button.focus();
      ownedFocus = false;
    }
  });
  win.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    sync();
  });
  standalone.addEventListener('change', sync);
  sync();
}

if (typeof window !== 'undefined') initInstall(window);
