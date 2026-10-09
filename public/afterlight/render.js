import { SCENES, createScene } from "./scenes.js";
import { evolveFrame, hash } from "./evolution.js";
import { WORLDS } from "./worlds.js";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function createRenderer(canvas, { reducedMotion = false } = {}) {
  const ctx = canvas.getContext("2d"),
    instances = new Map(),
    atlases = new Map();
  let disposed = false,
    signature = "",
    unit = 1;
  function resize() {
    const ratio = Math.min(globalThis.devicePixelRatio || 1, 2),
      width = Math.max(200, Math.round((canvas.clientWidth || 1000) * ratio)),
      height = Math.round(width / 2);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      atlases.clear();
      signature = "";
    }
    unit = width / 200;
  }
  function atlasFor(scene) {
    if (atlases.has(scene.id)) return atlases.get(scene.id);
    const a = document.createElement("canvas"),
      ac = a.getContext("2d"),
      slot = Math.ceil(unit) + 2;
    a.width = slot * 4;
    a.height = slot * scene.palette.length;
    ac.font = `${unit / 0.6}px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace`;
    ac.textAlign = "center";
    ac.textBaseline = "middle";
    for (let c = 0; c < scene.palette.length; c++) {
      ac.fillStyle = scene.palette[c];
      for (let g = 1; g < 4; g++)
        ac.fillText(" ·•●"[g], g * slot + slot / 2, c * slot + slot / 2);
    }
    const result = { canvas: a, slot };
    atlases.set(scene.id, result);
    return result;
  }
  function render(state, time = state.time || 0) {
    if (disposed) return;
    resize();
    const region = SCENES[state.region] ? state.region : "forest",
      world = state.worlds?.[region] || {},
      s = SCENES[region],
      clock = reducedMotion ? 0 : Number(time) || 0;
    const key = [
      region,
      Math.floor((Number(state.time ?? time) || 0) * 15),
      Math.round(state.x),
      Math.round(state.y),
      world.restored,
      world.stage,
      JSON.stringify(world.flags || {}),
      Math.ceil(state.pulse || 0),
      Math.round(state.hull || 0),
      state.phase,
    ].join("|");
    if (key === signature) return;
    signature = key;
    if (!instances.has(region)) instances.set(region, createScene(region));
    const source = instances.get(region);
    if (source.lastTime !== clock || !source.cachedFrame) {
      source.cachedFrame = source.frame(clock, { color: source.color });
      source.lastTime = clock;
    }
    const base = source.cachedFrame,
      evolved = evolveFrame(region, base, source.color, world, {
        time: clock,
        reducedMotion,
      });
    const { grid, color } = evolved,
      extra = s.extra;
    function dot(x, y, d, c) {
      x = Math.round(x);
      y = Math.round(y);
      if (x < 0 || x >= 200 || y < 0 || y >= 100) return;
      const k = y * 200 + x;
      grid[k] = " ·•●"[clamp(Math.round(d), 0, 3)];
      color[k] = c;
    }
    function line(x, y, x2, y2, c, d = 2, stride = 1) {
      const n = Math.ceil(Math.hypot(x2 - x, y2 - y));
      for (let j = 0; j <= n; j += stride)
        dot(
          x + ((x2 - x) * j) / Math.max(1, n),
          y + ((y2 - y) * j) / Math.max(1, n),
          d,
          c,
        );
    }
    function footprint(x, y, size, c) {
      for (let j = -size; j <= size; j++)
        if (j % 2 === 0) dot(x + j, y + 1, 1, c);
    }
    function boat(x, y, size, c) {
      line(x - size * 2, y, x + size * 2, y, c, 2);
      dot(x, y + 1, 2, c);
      line(x, y, x, y - size * 3, c, 1);
      line(x, y - size * 3, x + size * 1.5, y - size * 0.9, c, 2);
      footprint(x, y + 1, size * 2, extra + 1);
    }
    function bush(x, y, size, c) {
      line(x, y, x, y - size * 3, c, 1);
      for (let j = 0; j < 3; j++) {
        line(
          x,
          y - size * (j + 0.5),
          x - size * (2 - j * 0.5),
          y - size * j,
          c,
          2,
        );
        line(
          x,
          y - size * (j + 0.5),
          x + size * (2 - j * 0.5),
          y - size * j,
          c,
          2,
        );
      }
      footprint(x, y, size * 2, extra + 3);
    }
    const surface = region === "coast" || region === "fjord",
      flags = world.flags || {},
      landmarks = WORLDS[region]?.landmarks || [];
    // Every device has a grounded silhouette and a small warm point when restored.
    for (const p of landmarks) {
      if (
        region === "fjord" &&
        p.id.startsWith("bell") &&
        !flags[p.id + "-revealed"]
      )
        continue;
      const complete = Boolean(flags[p.id]),
        lit = Boolean(
          flags[p.id + "-lit"] ||
          flags[p.id + "-charted"] ||
          flags[p.id + "-revealed"],
        ),
        depth = clamp((p.y - (surface ? 60 : 45)) / (surface ? 38 : 52), 0, 1),
        size = 0.6 + depth * 0.8,
        c = complete ? extra + 1 : lit ? extra : s.extra + 3;
      if (p.kind === "camp") {
        line(p.x - 3 * size, p.y, p.x, p.y - 3 * size, c, 2);
        line(p.x, p.y - 3 * size, p.x + 3 * size, p.y, c, 2);
        line(p.x - 3 * size, p.y, p.x + 3 * size, p.y, c, 1);
        dot(p.x, p.y - 1, 2, extra);
      } else if (p.kind === "person") {
        boat(p.x, p.y, size, c);
      } else if (region === "forest" && p.id.startsWith("grove")) {
        bush(p.x, p.y, size * 1.6, c);
        if (lit)
          for (let j = 0; j < 6; j++)
            dot(p.x + Math.cos(j) * 4, p.y - 4 + Math.sin(j) * 2, 1, extra + 2);
      } else if (region === "moon" && p.id.startsWith("garden")) {
        if (complete) bush(p.x, p.y, size * 2, extra);
        else {
          line(p.x - 3, p.y, p.x + 3, p.y, c, 1);
          dot(p.x, p.y - 1, 2, c);
        }
      } else if (region === "desert" && p.id.startsWith("stone")) {
        line(p.x - 1, p.y, p.x - 1, p.y - 4 * size, c, 2);
        line(p.x + 1, p.y, p.x + 1, p.y - 4 * size, c, 2);
        dot(p.x, p.y - 4 * size, 2, c);
      } else if (p.kind === "resource") {
        for (let j = -1; j <= 1; j++) {
          dot(p.x + j, p.y, 2, c);
          dot(p.x + j, p.y - 1, 2, c);
        }
        dot(p.x, p.y - 2, 1, c);
      } else {
        line(p.x, p.y, p.x, p.y - 4 * size, c, 2);
        dot(p.x - 1, p.y - 3 * size, 2, c);
        dot(p.x + 1, p.y - 3 * size, 2, c);
        footprint(p.x, p.y, 3, extra + 3);
      }
      // Ground-level halo indicates interaction distance without oversized sprites.
      if (Math.hypot(p.x - state.x, p.y - state.y) < 10)
        for (let j = 0; j < 15; j++) {
          const a = (j / 15) * Math.PI * 2;
          dot(
            p.x + Math.cos(a) * (4 + size),
            p.y + Math.sin(a) * 2,
            1,
            extra + 2,
          );
        }
    }
    for (const e of state.entities || []) {
      if (e.active === false) continue;
      const x = e.x,
        y = e.y,
        r = Math.max(1, Math.min(5, (e.radius || 4) * 0.65));
      if (e.kind === "traffic") {
        for (let yy = -2; yy <= 0; yy++)
          line(x - r, y + yy, x + r, y + yy, extra + 2, 2);
        dot(x - r, y + 1, 2, 1);
        dot(x + r, y + 1, 2, 1);
      } else if (e.kind === "sandstorm") {
        for (let j = 0; j < 35; j++) {
          const a = hash(j, 19) * Math.PI * 2,
            d = hash(j, 22) * r * 1.7;
          dot(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.65, 1, extra + 3);
        }
      } else if (e.kind === "ice" || e.kind === "reef" || e.kind === "debris") {
        for (let yy = -r * 0.5; yy <= r * 0.5; yy++)
          for (let xx = -r; xx <= r; xx++)
            if ((xx / r) ** 2 + (yy / (r * 0.55)) ** 2 < 1)
              dot(
                x + xx,
                y + yy,
                hash(xx + 31, yy + 12) > 0.6 ? 2 : 1,
                e.kind === "ice" ? extra : extra + 3,
              );
        footprint(x, y, r * 2, extra + 1);
      } else {
        for (let j = 0; j < 9; j++) {
          const a = (j / 9) * Math.PI * 2;
          dot(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.5, 2, extra + 3);
        }
      }
    }
    if ((state.pulse || 0) > 0) {
      const elapsed = 2 - state.pulse,
        r = 8 + elapsed * 25;
      for (let j = 0; j < 90; j++) {
        const a = (j / 90) * Math.PI * 2;
        if (j % 2 === 0)
          dot(
            state.x + Math.cos(a) * r,
            state.y + Math.sin(a) * r * 0.6,
            1,
            extra + 2,
          );
      }
    }
    // The traveler changes vehicle with the terrain; sizes grow toward the viewer.
    const px = state.x ?? 35,
      py = state.y ?? 87,
      depth = clamp((py - (surface ? 60 : 45)) / (surface ? 38 : 52), 0, 1),
      ps = 0.65 + depth * 0.8;
    if (surface || region === "desert") boat(px, py, ps, extra + 2);
    else {
      dot(px, py - 3 * ps, 3, extra + 2);
      line(px, py - 2 * ps, px, py, extra + 2, 2);
      dot(px - ps, py - ps, 1, extra + 2);
      dot(px + ps, py - ps, 1, extra + 2);
      dot(px - ps, py + ps, 2, extra + 2);
      dot(px + ps, py + ps, 2, extra + 2);
      footprint(px, py + 1, 3 * ps, extra + 3);
    }
    const atlas = atlasFor(s);
    ctx.fillStyle = s.ground;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < 100; y++)
      for (let x = 0; x < 200; x++) {
        const k = y * 200 + x,
          g = " ·•●".indexOf(grid[k]);
        if (g <= 0) continue;
        const c = Math.min(color[k], s.palette.length - 1);
        ctx.drawImage(
          atlas.canvas,
          g * atlas.slot,
          c * atlas.slot,
          atlas.slot,
          atlas.slot,
          x * unit - 1,
          y * unit - 1,
          unit + 2,
          unit + 2,
        );
      }
    canvas.dataset.region = region;
    canvas.dataset.changedCells = String(evolved.changedCells);
    canvas.dataset.restored = String(evolved.restored);
  }
  resize();
  return {
    render,
    resize,
    dispose() {
      disposed = true;
      instances.clear();
      atlases.clear();
    },
  };
}
