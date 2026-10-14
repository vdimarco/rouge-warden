// The painted title sequence on the title at Loon Lake. A muted clip plays in the logo's box. The menu
// under it stays clickable: the clip does not take presses, only Skip / Play and Unmute do. Reduced motion
// and Calm effects show the poster until the player asks to play. Starting a cast dismisses it.
(function () {
  var root = document.getElementById("titleIntro");
  var video = document.getElementById("titleIntroVideo");
  var act = document.getElementById("titleIntroAct");
  var sound = document.getElementById("titleIntroSound");
  var logo = document.querySelector("#title .logo");
  var title = document.getElementById("title");
  if (!root || !video || !act || !sound || !logo || !title) return;

  var reduce = matchMedia("(prefers-reduced-motion: reduce)");
  var landscape = matchMedia("(orientation: landscape)");
  var MENUS = { settings: 1, help: 1, journal: 1, places: 1, about: 1, privacy: 1 };
  var dismissed = false, sawTitle = false, optedIn = false, soundOn = false, starting = false, playGen = 0, wasAsking = false;

  function askingStill() {
    return reduce.matches || document.documentElement.dataset.calm === "1";
  }
  function holdStill() {
    return !optedIn && askingStill();
  }
  function clipSrc() {
    return landscape.matches ? "clips/title-landscape.mp4" : "clips/title-portrait.mp4";
  }
  function posterSrc() {
    return landscape.matches ? "clips/title-poster-landscape.webp" : "clips/title-poster-portrait.webp";
  }
  function paintSound() {
    video.muted = !soundOn;
    sound.setAttribute("aria-pressed", soundOn ? "true" : "false");
    sound.textContent = soundOn ? "Mute" : "Unmute";
  }
  function ensureClip() {
    var src = clipSrc();
    video.poster = posterSrc();
    if (video.getAttribute("data-clip") === src) { paintSound(); return; }
    var t = video.currentTime || 0;
    video.setAttribute("data-clip", src);
    video.src = src;
    paintSound();
    if (t > 0.2) {
      var seek = function () {
        video.removeEventListener("loadedmetadata", seek);
        paintSound();
        if (isFinite(video.duration) && t < video.duration - 0.25) video.currentTime = t;
      };
      video.addEventListener("loadedmetadata", seek);
    }
  }
  function place() {
    root.style.left = (title.offsetLeft + logo.offsetLeft) + "px";
    root.style.top = (title.offsetTop + logo.offsetTop - title.scrollTop) + "px";
    root.style.width = logo.offsetWidth + "px";
    root.style.height = logo.offsetHeight + "px";
  }
  function stop() {
    playGen++;
    starting = false;
    if (!video.paused) video.pause();
    root.classList.remove("is-playing");
  }
  // Put the decoded film down. The source tags would load it again, so their addresses go too.
  function dropClip() {
    stop();
    var sources = video.querySelectorAll("source");
    for (var i = 0; i < sources.length; i++) sources[i].removeAttribute("src");
    video.removeAttribute("src");
    video.removeAttribute("data-clip");
    video.load();
  }
  function dismiss() {
    dismissed = true;
    dropClip();
    root.hidden = true;
  }
  function startPlay() {
    if (root.hidden || holdStill() || starting || (!video.paused && !video.ended)) return;
    ensureClip();
    starting = true;
    var gen = ++playGen;
    var pending = video.play();
    if (!pending || !pending.then) { starting = false; return; }
    pending.then(function () {
      starting = false;
      if (gen !== playGen || root.hidden || holdStill()) { video.pause(); return; }
      root.classList.add("is-playing");
      act.textContent = "Skip";
    }, function () {
      starting = false;
      if (gen !== playGen) return;
      root.classList.remove("is-playing");
      act.textContent = "Play";
    });
  }
  function sync() {
    var asking = askingStill();
    if (asking && !wasAsking) optedIn = false;
    wasAsking = asking;
    var screen = document.body.dataset.screen || "";
    if (screen === "title") sawTitle = true;
    else if (sawTitle && !MENUS[screen]) dismissed = true;
    var show = !dismissed && screen === "title" && document.body.dataset.artStyle === "painted" && document.body.dataset.place === "loon" && logo.offsetWidth > 8 && logo.offsetHeight > 8;
    if (!show) {
      stop();
      root.hidden = true;
      return;
    }
    place();
    root.hidden = false;
    if (holdStill()) {
      stop();
      act.textContent = "Play";
      return;
    }
    if (video.paused || video.ended) startPlay();
    else { root.classList.add("is-playing"); act.textContent = "Skip"; }
  }

  act.addEventListener("click", function () {
    if (root.classList.contains("is-playing")) { dismiss(); return; }
    optedIn = true;
    if (dismissed) return;
    startPlay();
  });
  sound.addEventListener("click", function () {
    soundOn = !soundOn;
    paintSound();
    if (!soundOn || root.hidden) return;
    if (holdStill() || video.paused || video.ended) optedIn = true;
    startPlay();
  });
  video.addEventListener("ended", dismiss);
  video.addEventListener("playing", function () {
    if (root.hidden || holdStill()) { video.pause(); return; }
    root.classList.add("is-playing");
    act.textContent = "Skip";
  });
  addEventListener("keydown", function (e) {
    if (e.code !== "Escape" || e.repeat || root.hidden || dismissed) return;
    dismiss();
  });
  landscape.addEventListener("change", function () {
    var was = !video.paused && !video.ended;
    video.removeAttribute("data-clip");
    if (was && !root.hidden && !holdStill()) { video.pause(); startPlay(); }
    else sync();
  });
  reduce.addEventListener("change", sync);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else sync();
  });
  title.addEventListener("scroll", sync, { passive: true });
  addEventListener("resize", sync);
  if (window.ResizeObserver) new ResizeObserver(sync).observe(logo);
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ["data-screen", "data-art-style", "data-place"] });
  new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ["data-calm"] });
  paintSound();
  sync();
})();
