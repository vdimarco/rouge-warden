import { createRenderer } from "./render.js";
import { getLandmarks } from "./simulation.js";
import { WORLDS } from "./worlds.js";

// Phaser owns the scene clock, input, camera and composition. The original ASCII
// grid is a dynamic canvas texture, so its palette and fine glyphs stay intact.
export function createWorldRuntime({
  parent,
  getState,
  step,
  onDestination,
  reducedMotion = false,
  getMission = () => ({ steps: [] }),
}) {
  const labels = document.createElement("div");
  labels.className = "world-labels";
  parent.append(labels);
  const labelNodes = new Map();
  const source = document.createElement("canvas");
  source.style.width = "1200px";
  const renderer = createRenderer(source, {
    reducedMotion,
    width: 1200,
    pixelRatio: 1,
  });
  let scene,
    lastRegion = "",
    lastOperation = "",
    elapsed = 0,
    destination = null,
    lastStage = 0,
    lastHull = 100,
    lastImpact = 0,
    lastTick = 0,
    accumulator = 0;
  class JourneyScene extends Phaser.Scene {
    constructor() {
      super("journey");
    }
    create() {
      scene = this;
      this.textures.addCanvas("landscape", source);
      this.landscape = this.add
        .image(0, 0, "landscape")
        .setOrigin(0)
        .setDisplaySize(1200, 600);
      this.route = this.add.graphics();
      this.cameras.main.setBounds(0, 0, 1200, 600);
      this.input.on("pointerdown", (pointer) => {
        if (getState().phase !== "playing") return;
        destination = this.destinationFor(pointer);
        onDestination(destination);
      });
      this.input.on("pointermove", (pointer) => {
        if (!pointer.isDown || getState().phase !== "playing") return;
        destination = this.destinationFor(pointer);
        onDestination(destination);
      });
      this.movementKeys = this.input.keyboard.addKeys(
        "W,A,S,D,UP,DOWN,LEFT,RIGHT",
      );
      this.game.canvas.setAttribute(
        "aria-label",
        "Living ASCII adventure landscape",
      );
      this.game.canvas.id = "phaser-scene";
      this.game.canvas.addEventListener("pointercancel", () => {
        destination = null;
        onDestination(null);
      });
      this.draw();
    }
    destinationFor(pointer) {
      const p = this.cameras.main.getWorldPoint(pointer.x, pointer.y),
        bounds = WORLDS[getState().region].bounds;
      return {
        x: Phaser.Math.Clamp(p.x / 6, bounds.minX, bounds.maxX),
        y: Phaser.Math.Clamp(p.y / 6, bounds.minY, bounds.maxY),
      };
    }
    draw() {
      const state = getState();
      const changed = renderer.render(state, state.time);
      if (changed !== false) this.textures.get("landscape").refresh();
      const regionChanged = lastRegion && lastRegion !== state.region;
      if (regionChanged) {
        destination = null;
        this.cameras.main.resetFX();
        if (!reducedMotion) this.cameras.main.fadeIn(650, 8, 13, 18);
      }
      lastRegion = state.region;
      const stage =
        state.worlds[state.region].stage + state.worlds[state.region].restored;
      if (!regionChanged && stage > lastStage && !reducedMotion) {
        const glint = this.add
          .text(state.x * 6, state.y * 6 - 38, "light returns", {
            fontFamily: "monospace",
            fontSize: "12px",
            color: "#ffe0a2",
          })
          .setOrigin(0.5);
        this.tweens.add({
          targets: glint,
          y: glint.y - 24,
          alpha: 0,
          duration: 1800,
          ease: "Sine.easeOut",
          onComplete: () => glint.destroy(),
        });
      }
      lastStage = stage;
      if (
        state.hull < lastHull - 0.1 &&
        state.time - lastImpact > 1 &&
        !reducedMotion
      ) {
        this.cameras.main.shake(110, 0.001);
        lastImpact = state.time;
      }
      lastHull = state.hull;
      const operation =
        state.challenge?.id || state.challenge?.landmarkId || "";
      if (operation !== lastOperation || regionChanged) {
        lastOperation = operation;
        const focus =
          !!operation &&
          state.challenge?.type !== "coast" &&
          state.challenge?.variant !== "catch";
        const zoom = focus ? 1.13 : 1;
        this.tweens.killTweensOf(this.cameras.main);
        this.tweens.add({
          targets: this.cameras.main,
          zoom,
          duration: reducedMotion ? 0 : 650,
          ease: "Sine.easeInOut",
        });
        this.cameras.main.pan(
          focus ? state.x * 6 : 600,
          focus ? state.y * 6 - 55 : 300,
          reducedMotion ? 0 : 650,
          "Sine.easeInOut",
        );
      }
      this.route.clear();
      if (
        destination &&
        state.phase === "playing" &&
        Math.hypot(destination.x - state.x, destination.y - state.y) > 2
      ) {
        const b = state.region;
        const col = ["coast", "fjord"].includes(b) ? 0x9cdbde : 0xffe0a2;
        this.route.fillStyle(col, 0.38);
        for (let i = 1; i < 18; i++) {
          const f = i / 18;
          this.route.fillCircle(
            (state.x + (destination.x - state.x) * f) * 6,
            (state.y + (destination.y - state.y) * f) * 6,
            0.9,
          );
        }
      }
      this.updateLabels(state);
      this.game.canvas.dataset.region = state.region;
      this.game.canvas.dataset.engine = "Phaser 3.90.0";
      this.game.canvas.dataset.changedCells =
        source.dataset.changedCells || "0";
      for (const key of ["weather", "actors", "challenge", "restored"])
        this.game.canvas.dataset[key] = source.dataset[key] || "";
    }
    updateLabels(state) {
      const task = getMission().steps[0],
        goal = task?.target;
      const all = getLandmarks(state).filter(
        (l) =>
          !(l.id.startsWith("boat") && state.worlds[state.region].flags[l.id]),
      );
      const display = all.map((l) => ({
        ...l,
        label:
          l.id === "cache" && state.region === "forest"
            ? "Courier pack"
            : l.id.startsWith("boat")
              ? "Crew " + (l.id.slice(-1).charCodeAt(0) - 96)
              : l.id.startsWith("bell") &&
                  !state.worlds[state.region].flags[l.id + "-revealed"]
                ? "Sonar search"
                : l.name,
      }));
      if (goal?.id === "firefly")
        display.push({ ...goal, label: "Catch this firefly" });
      display.push({ id: "you", x: state.x, y: state.y - 4, label: "YOU" });
      const active = new Set();
      for (const item of display) {
        active.add(item.id);
        let node = labelNodes.get(item.id);
        if (!node) {
          node = document.createElement(item.id === "you" ? "span" : "button");
          node.className = "world-label";
          node.dataset.landmark = item.id;
          if (item.id !== "you") {
            node.type = "button";
            node.onclick = () => {
              if (getState().phase !== "playing") return;
              const current =
                getLandmarks(getState()).find((l) => l.id === item.id) ||
                getMission().steps[0]?.target;
              if (!current) return;
              destination = { x: current.x, y: current.y };
              onDestination(destination);
            };
          }
          labels.append(node);
          labelNodes.set(item.id, node);
        }
        node.textContent = item.label;
        const camera = this.cameras.main,
          view = camera.worldView;
        node.style.left =
          (((item.x * 6 - view.x) * camera.zoom) / 1200) * 100 + "%";
        node.style.top =
          ((((item.y - 2) * 6 - view.y) * camera.zoom) / 600) * 100 + "%";
        node.classList.toggle("you", item.id === "you");
        node.classList.toggle("goal", goal?.id === item.id);
        node.classList.toggle(
          "completed",
          !!state.worlds[state.region].flags[item.id],
        );
        node.hidden = ["ready", "won", "lost"].includes(state.phase);
      }
      for (const [id, node] of labelNodes)
        if (!active.has(id)) {
          node.remove();
          labelNodes.delete(id);
        }
    }
    update(time, delta) {
      // Fixed simulation steps keep towing and currents consistent when drawing
      // takes longer. Bound catch-up after a hidden tab, rather than losing time
      // on every slow frame.
      const frameTime = Math.min(
        lastTick ? (time - lastTick) / 1000 : delta / 1000,
        0.2,
      );
      lastTick = time;
      accumulator += Math.max(0, frameTime);
      while (accumulator >= 1 / 60) {
        step(1 / 60, time);
        accumulator -= 1 / 60;
      }
      elapsed += delta;
      if (elapsed >= 33) {
        this.draw();
        elapsed = 0;
      }
    }
  }
  const game = new Phaser.Game({
    type: Phaser.CANVAS,
    parent,
    width: 1200,
    height: 600,
    backgroundColor: "#080d12",
    banner: false,
    audio: { noAudio: true },
    render: { antialias: true, roundPixels: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { keyboard: { capture: [] }, activePointers: 3 },
    scene: JourneyScene,
    fps: { target: 60, forceSetTimeOut: false },
  });
  return {
    game,
    setDestination(point) {
      destination = point;
    },
    movement() {
      const k = scene?.movementKeys;
      return k
        ? {
            dx:
              Number(k.RIGHT.isDown || k.D.isDown) -
              Number(k.LEFT.isDown || k.A.isDown),
            dy:
              Number(k.DOWN.isDown || k.S.isDown) -
              Number(k.UP.isDown || k.W.isDown),
          }
        : { dx: 0, dy: 0 };
    },
    render() {
      scene?.draw();
    },
    clearDestination() {
      destination = null;
      scene?.input.keyboard.resetKeys();
    },
    resize() {
      game.scale.refresh();
    },
    dispose() {
      renderer.dispose();
      labels.remove();
      game.destroy(true);
    },
  };
}
