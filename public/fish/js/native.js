// The bridge to the phone app. The store build wraps this same page in a Capacitor app, and Capacitor puts
// window.Capacitor on the page before any script runs (with window.Capacitor.Plugins, one object for each native
// plugin). This module is the only one that talks to it. The site has no bundler, so it finds the plugins by name:
//   Haptics (@capacitor/haptics), App (@capacitor/app), SplashScreen (@capacitor/splash-screen),
//   KeepAwake (@capacitor-community/keep-awake), Preferences (@capacitor/preferences), and StatusBar
//   (@capacitor/status-bar) only if an app has it. The app hides the bars natively (MainActivity on Android,
//   MainViewController on iPhone). This page never calls SystemBars: on an iPhone its hide also hides the home
//   indicator, and then the system stops deferring the bottom-edge swipe that keeps a crank stroke in the game.
// Every call is wrapped: a missing plugin, a call that throws and a promise that fails all do nothing. On the web every
// method is a no-op, and prefs.get() gives null. Safe in node too (the haptics tests import it).

const cap = () => (typeof window !== "undefined" ? window : globalThis).Capacitor || null;
const safe = (fn, d = null) => { try { return fn(); } catch (e) { return d; } };
// a native call may give a promise or nothing: a failed promise must not reach the console as an unhandled rejection
const quiet = (p) => { if (p && typeof p.then === "function") p.then(null, () => {}); return p; };

function native() { const C = cap(); return !!(C && typeof C.isNativePlatform === "function" && safe(() => C.isNativePlatform(), false)); }

// plugins found once for each Capacitor object (a test may put in a new one)
let found = new Map(), foundFor = null;
function plugin(name) {
  const C = cap();
  if (!C || !native()) return null;
  if (C !== foundFor) { found = new Map(); foundFor = C; }
  if (found.has(name)) return found.get(name);
  const p = safe(() => {
    if (typeof C.isPluginAvailable === "function" && !C.isPluginAvailable(name)) return null;
    return (C.Plugins && C.Plugins[name]) || (typeof C.registerPlugin === "function" ? C.registerPlugin(name) : null);
  });
  found.set(name, p || null);
  return p || null;
}
// call plugin.method(arg); returns its promise (or a resolved one), never throws
function call(name, method, arg) {
  const p = plugin(name);
  if (!p || typeof p[method] !== "function") return Promise.resolve(null);
  const r = safe(() => (arg === undefined ? p[method]() : p[method](arg)));
  return r && typeof r.then === "function" ? r.then((v) => v, () => null) : Promise.resolve(r);
}
// App events: the bridge gives a handle, the core runtime a promise of one
function listen(eventName, fn) {
  const p = plugin("App");
  if (!p || typeof p.addListener !== "function" || typeof fn !== "function") return;
  quiet(safe(() => p.addListener(eventName, (e) => { try { fn(e); } catch (err) { console.error(err); } })));
}

export const Native = {
  // inside the Capacitor app (iOS or Android)
  get isNative() { return native(); },
  get platform() { const P = native() && safe(() => cap().getPlatform()); return P === "ios" || P === "android" ? P : "web"; },
  // the store build: the app, or a page the app build marked (html data-build="store"). It hides the arcade parts
  get isStore() { return native() || (typeof document !== "undefined" && document.documentElement && document.documentElement.dataset.build === "store"); },
  plugin,
  // Android back. With a listener, the app no longer closes itself on back: the game decides
  onBack(fn) { listen("backButton", fn); },
  onPause(fn) { listen("pause", fn); },
  onResume(fn) { listen("resume", fn); },
  keepAwake(on) { if (native()) call("KeepAwake", on ? "keepAwake" : "allowSleep"); },
  hideSplash() { if (native()) call("SplashScreen", "hide"); },
  hideStatusBar() { if (native()) call("StatusBar", "hide"); },
  // Android: send the app to the background (iOS has no such thing)
  minimize() { if (native() && Native.platform === "android") call("App", "minimizeApp"); },
  // native storage that the phone does not clear with the web view's storage. Values are strings
  prefs: {
    get(key) {
      if (!native()) return Promise.resolve(null);
      return call("Preferences", "get", { key }).then((r) => (r && typeof r.value === "string" ? r.value : null));
    },
    set(key, value) {
      if (native() && typeof value === "string") call("Preferences", "set", { key, value });
    },
  },
};
