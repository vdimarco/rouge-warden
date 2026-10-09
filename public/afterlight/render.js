import { SCENES, createScene } from "./scenes.js";
import { evolveFrame, hash, growthAt } from "./evolution.js";
import { WORLDS } from "./worlds.js";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function createRenderer(
  canvas,
  {
    reducedMotion = false,
    width: sourceWidth = null,
    fullRedraw = false,
    pixelRatio = null,
  } = {},
) {
  const ctx = canvas.getContext("2d"),
    instances = new Map(),
    atlases = new Map();
  let disposed = false,
    signature = "",
    unit = 1,
    previousGrid = null,
    previousColor = null,
    previousRegion = null;
  const dirty = new Uint8Array(20000),
    paint = new Uint8Array(20000);
  function resize() {
    const ratio = Math.min(pixelRatio ?? globalThis.devicePixelRatio ?? 1, 2),
      width = Math.max(
        200,
        Math.round((sourceWidth || canvas.clientWidth || 1000) * ratio),
      ),
      height = Math.round(width / 2);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      atlases.clear();
      signature = "";
      previousGrid = previousColor = null;
      previousRegion = null;
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
    if (disposed) return false;
    resize();
    const region = SCENES[state.region] ? state.region : "forest",
      world = state.worlds?.[region] || {},
      s = SCENES[region],
      clock = reducedMotion ? 0 : Number(time) || 0;
    const key = [
      region,
      Math.floor((Number(state.time ?? time) || 0) * 30),
      Math.round(state.x),
      Math.round(state.y),
      world.restored,
      world.stage,
      JSON.stringify(world.flags || {}),
      Math.ceil(state.pulse || 0),
      Math.round(state.hull || 0),
      state.phase,
      JSON.stringify(state.challenge || {}),
      JSON.stringify(state.environment || {}),
      JSON.stringify(state.actors || []),
    ].join("|");
    if (key === signature) return false;
    signature = key;
    if (!instances.has(region)) instances.set(region, createScene(region));
    const source = instances.get(region);
    const sourceClock = Math.floor(clock * 10) / 10;
    if (source.lastTime !== sourceClock || !source.cachedFrame) {
      source.color.fill(0);
      source.cachedFrame = source.frame(sourceClock, { color: source.color });
      source.lastTime = sourceClock;
    }
    const evolutionKey = [
      sourceClock,
      world.restored,
      world.stage,
      JSON.stringify(world.flags || {}),
      JSON.stringify(world.completedAt || {}),
      Math.floor((state.time || 0) * 10),
    ].join("|");
    if (source.evolutionKey !== evolutionKey || !source.evolved) {
      source.evolved = evolveFrame(
        region,
        source.cachedFrame,
        source.color,
        world,
        {
          time: sourceClock,
          stateTime: state.time || 0,
          simulation: state.environment,
          reducedMotion,
        },
      );
      source.evolutionKey = evolutionKey;
    }
    const evolved = source.evolved,
      grid = evolved.grid.slice(),
      color = evolved.color.slice(),
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
        p.kind === "person" &&
        (state.actors || []).some((a) => a.id === p.id || a.landmarkId === p.id)
      )
        continue;
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
        if (complete)
          bush(
            p.x,
            p.y,
            size *
              2 *
              (0.2 +
                0.8 * growthAt(world, p.id, state.time || 0, reducedMotion)),
            extra,
          );
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
    for (const path of state.paths || []) {
      if (!path.opened) continue;
      const points = path.points || [],
        count = Math.max(
          1,
          Math.ceil((points.length - 1) * (path.growth || 0)),
        );
      for (let j = 1; j < points.length && j <= count; j++) {
        const a = points[j - 1],
          b = points[j];
        line(a.x, a.y + 1, b.x, b.y + 1, extra + 1, 1, surface ? 4 : 3);
      }
    }
    // Terrain drag and current are expressed along their physical surface.
    for (const patch of state.terrain || []) {
      if (patch.active === false) continue;
      const radius = Math.min(13, patch.radius || 5);
      for (let j = 0; j < 18; j++) {
        const a = j * 2.4,
          r = Math.sqrt(hash(j, 17)) * radius,
          x = patch.x + Math.cos(a) * r,
          y = patch.y + Math.sin(a) * r * 0.6;
        dot(x, y, 1, patch.kind === "ice" ? extra : extra + 1);
        if (patch.flowX || patch.flowY)
          line(
            x,
            y,
            x + (patch.flowX || 0) * 0.5,
            y + (patch.flowY || 0) * 0.4,
            extra + 1,
            1,
            2,
          );
      }
    }
    for (const actor of state.actors || []) {
      if (actor.kind === "crew" || region === "coast") {
        const size = 0.6 + clamp((actor.y - 60) / 36, 0, 1) * 0.8;
        boat(
          actor.x,
          actor.y,
          size,
          ["rescued", "safe"].includes(actor.mode) ? extra + 1 : extra,
        );
        if (actor.mode === "tethered" || actor.tethered)
          line(state.x, state.y + 1, actor.x, actor.y + 1, extra + 2, 1, 2);
        for (let j = 1; j < 7; j++)
          dot(
            actor.x - j,
            actor.y + 1 + Math.sin(clock * 0.4 + j) * 0.5,
            1,
            extra + 1,
          );
      } else if (actor.kind === "seed") {
        dot(actor.x, actor.y, 3, extra + 3);
        dot(
          actor.x - (actor.vx || 1) * 0.5,
          actor.y - (actor.vy || 0) * 0.5,
          1,
          extra + 2,
        );
      } else {
        dot(actor.x, actor.y - 1, 2, extra + 2);
        dot(actor.x - 1, actor.y, 1, extra + 1);
        dot(actor.x + 1, actor.y, 1, extra + 1);
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
    // Operations inhabit the same surface as their objective, not a detached minigame.
    const operation = state.challenge;
    if (operation && operation.phase !== "complete") {
      const objective = landmarks.find(
          (p) => p.id === operation.landmarkId,
        ) || { x: state.x, y: state.y },
        progress = clamp(Number(operation.progress) || 0, 0, 1),
        focus = operation.type || region;
      if (focus === "forest") {
        const angle =
            ((Number(operation.angle) || 0) * Math.PI) / 2 - Math.PI / 2,
          targetAngle =
            (Math.round((Number(operation.target) || 0) * 3) * Math.PI) / 2 -
            Math.PI / 2;
        for (let ray = -2; ray <= 2; ray++)
          for (let j = 0; j <= 12; j += 2) {
            const q = j / 12;
            dot(
              objective.x + Math.cos(angle) * j + Math.sin(angle) * ray * q,
              objective.y -
                3 +
                Math.sin(angle) * j * 0.55 -
                Math.cos(angle) * ray * q,
              1,
              ray === 0 ? extra + 2 : extra + 1,
            );
          }
        dot(
          objective.x + Math.cos(targetAngle) * 12,
          objective.y - 3 + Math.sin(targetAngle) * 6.6,
          2,
          extra + 2,
        );
        for (let j = 0; j < 10; j++) {
          const a = (j * Math.PI) / 5,
            r = 3 + (1 - progress) * 3;
          dot(
            objective.x + Math.cos(a) * r,
            objective.y - 3 + Math.sin(a) * r * 0.5,
            1,
            extra + 2,
          );
        }
      } else if (focus === "city") {
        const cells = operation.cells || [];
        for (let j = 0; j < cells.length; j++) {
          const cell = cells[j],
            x = objective.x + (j - (cells.length - 1) / 2) * 9,
            y = objective.y - 2,
            rotation = Number(cell.rotation) || 0,
            a = (rotation * Math.PI) / 2 - Math.PI / 2,
            connected = cell.connected || rotation === cell.target;
          dot(x, y, 3, connected ? extra : extra + 3);
          line(
            x,
            y,
            x + Math.cos(a) * 4,
            y + Math.sin(a) * 3,
            connected ? extra : extra + 1,
            2,
          );
          if (j)
            line(x - 8, y + 4, x, y + 4, connected ? extra : extra + 3, 1, 2);
          if (j === operation.selected) {
            dot(x - 2, y - 2, 1, extra + 2);
            dot(x + 2, y - 2, 1, extra + 2);
          }
        }
        for (let j = 0; j < Math.floor(progress * 8); j++)
          dot(objective.x - 15 + j * 4, objective.y + 7, 2, extra);
      } else if (focus === "coast") {
        const dock = operation.escort?.dock || { x: 42, y: 89 },
          actor = (state.actors || []).find(
            (a) => a.id === operation.escort?.actorId,
          );
        if (actor) {
          line(actor.x, actor.y + 1, dock.x, dock.y, extra + 1, 1, 4);
          const r = 3;
          for (let j = 0; j < 12; j++)
            dot(
              dock.x + Math.cos((j * Math.PI) / 6) * r,
              dock.y + Math.sin((j * Math.PI) / 6) * 1.5,
              2,
              extra,
            );
        } else if (operation.variant !== "escort") {
          const signal = operation.pattern?.[operation.step] || "amber",
            signalColor =
              signal === "blue" ? 8 : signal === "white" ? 12 : extra;
          for (let j = -3; j <= 3; j++)
            dot(objective.x + j, objective.y - 5, 2, signalColor);
          for (let j = 0; j < 15; j++)
            if (j % 2 === 0)
              dot(
                objective.x + Math.sin(j * 0.7) * 2,
                objective.y + j,
                1,
                signalColor,
              );
        }
      } else if (focus === "fjord") {
        const q = clamp(Number(operation.value) || 0, 0, 1),
          window = operation.window || [0.3, 0.7],
          r = 3 + q * 9;
        for (let j = 0; j < 30; j++) {
          const a = (j / 30) * Math.PI * 2;
          dot(
            objective.x + Math.cos(a) * r,
            objective.y + Math.sin(a) * r * 0.5,
            1,
            q >= window[0] && q <= window[1] ? extra + 2 : extra + 1,
          );
        }
        for (let j = 0; j <= operation.step; j++)
          dot(objective.x - 3 + j * 3, objective.y - 3, 2, extra + 2);
      } else if (focus === "desert") {
        const angle = Number(operation.angle ?? operation.value ?? 0),
          a = (angle * Math.PI) / 4 - Math.PI / 2,
          length = 7 + progress * 5;
        line(
          objective.x,
          objective.y - 2,
          objective.x + Math.cos(a) * length,
          objective.y - 2 + Math.sin(a) * length * 0.55,
          extra + 2,
          1,
          2,
        );
        for (let j = 0; j < 18; j++) {
          const turn = (j * Math.PI) / 9;
          dot(
            objective.x + Math.cos(turn) * 8,
            objective.y + Math.sin(turn) * 4,
            1,
            extra + 3,
          );
        }
      } else if (focus === "moon") {
        const nodes = [
            [-6, 0],
            [0, -5],
            [6, 0],
          ],
          step = Number(operation.step) || 0;
        for (let j = 0; j < nodes.length; j++) {
          const [dx, dy] = nodes[j];
          dot(
            objective.x + dx,
            objective.y + dy,
            j === step % 3 ? 3 : 1,
            j < step ? extra + 1 : extra + 2,
          );
          if (j)
            line(
              objective.x + nodes[j - 1][0],
              objective.y + nodes[j - 1][1],
              objective.x + dx,
              objective.y + dy,
              extra,
              1,
              2,
            );
        }
        bush(objective.x, objective.y, 0.3 + progress * 2, extra);
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
    function drawCell(k) {
      const g = " ·•●".indexOf(grid[k]);
      if (g <= 0) return;
      const x = k % 200,
        y = Math.floor(k / 200),
        c = Math.min(color[k], s.palette.length - 1);
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
    let dirtyCount = 20000,
      paintedCells = 0;
    const full = fullRedraw || !previousGrid || previousRegion !== region;
    if (!full) {
      dirty.fill(0);
      paint.fill(0);
      dirtyCount = 0;
      for (let k = 0; k < 20000; k++) {
        if (
          grid[k] === previousGrid[k] &&
          (grid[k] === " " || color[k] === previousColor[k])
        )
          continue;
        const x = k % 200,
          y = Math.floor(k / 200);
        // Atlas dots extend one pixel across a cell boundary. Erase their old halo too.
        for (let yy = Math.max(0, y - 1); yy <= Math.min(99, y + 1); yy++)
          for (let xx = Math.max(0, x - 1); xx <= Math.min(199, x + 1); xx++) {
            const n = yy * 200 + xx;
            if (!dirty[n]) {
              dirty[n] = 1;
              dirtyCount++;
            }
          }
      }
    }
    ctx.fillStyle = s.ground;
    if (full || dirtyCount > 7000) {
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let k = 0; k < 20000; k++) {
        drawCell(k);
        if (grid[k] !== " ") paintedCells++;
      }
    } else if (dirtyCount) {
      ctx.save();
      ctx.beginPath();
      // Contiguous row runs make a compact clipping path. All repaint is clipped,
      // preventing repeated alpha accumulation on unchanged neighboring glyphs.
      for (let y = 0; y < 100; y++) {
        let x = 0;
        while (x < 200) {
          if (!dirty[y * 200 + x]) {
            x++;
            continue;
          }
          const left = x;
          while (x < 200 && dirty[y * 200 + x]) x++;
          ctx.rect(left * unit, y * unit, (x - left) * unit, unit);
        }
      }
      ctx.clip();
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let k = 0; k < 20000; k++)
        if (dirty[k]) {
          const x = k % 200,
            y = Math.floor(k / 200);
          for (let yy = Math.max(0, y - 1); yy <= Math.min(99, y + 1); yy++)
            for (let xx = Math.max(0, x - 1); xx <= Math.min(199, x + 1); xx++)
              paint[yy * 200 + xx] = 1;
        }
      for (let k = 0; k < 20000; k++)
        if (paint[k]) {
          drawCell(k);
          if (grid[k] !== " ") paintedCells++;
        }
      ctx.restore();
    }
    previousGrid = grid;
    previousColor = color;
    previousRegion = region;
    canvas.dataset.dirtyCells = String(dirtyCount);
    canvas.dataset.paintedCells = String(paintedCells);
    canvas.dataset.region = region;
    canvas.dataset.changedCells = String(evolved.changedCells);
    canvas.dataset.restored = String(evolved.restored);
    canvas.dataset.weather = state.environment?.weather || "calm";
    canvas.dataset.actors = String(state.actors?.length || 0);
    canvas.dataset.challenge = state.challenge?.type || "none";
    return dirtyCount > 0;
  }
  resize();
  return {
    render,
    resize,
    dispose() {
      disposed = true;
      instances.clear();
      atlases.clear();
      previousGrid = previousColor = null;
    },
  };
}
