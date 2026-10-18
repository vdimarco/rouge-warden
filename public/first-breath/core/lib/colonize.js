// First Breath: the villous tree by space colonization (design.md 6.4, 14.2), after Runions, Lane and Prusinkiewicz,
// "Modeling Trees with a Space Colonization Algorithm" (2007) and Runions et al., venation (SIGGRAPH 2005), with
// pipe-model widths (w_parent^n = Σ w_child^n). Seeded attraction points pull the nearest node within d_i; each
// pulled node grows a child D toward the mean direction of its points; points within d_k of a node are used up.
// The caps are built in: at most 400 points, 260 nodes and 2 iterations per growTree() call (one call per step).
// Each point remembers its nearest node, so an iteration costs points × new nodes, not points × all nodes. Pure.
//
// Contract choices (16.2 names only createTree and growTree):
// - createTree({ seed, root: { x, y }, region, points, N, D, di, dk, maxNodes, leafW }) with 6.4's numbers as
//   defaults (N 400, D 6, d_i 48, d_k 12, 260 nodes). region is a disc { x, y, r } (default: r 150 round the root)
//   or a box { x0, y0, x1, y1 }; points, when given, are [{ x, y }] or [x, y] pairs and replace the region.
// - growTree(tree, { active, iterations = 2 }) → the number of nodes it added. active is a list of discs
//   [{ x, y, r }]: only points inside one of them pull (6.4: within 60 u of the tip or of a pool being linked by
//   itself); with no list every point pulls.
// - The tree is { nodes: Float32Array (x, y, parent, width per node, room for 260), n, view, version, ... };
//   view is nodes.subarray(0, 4n), ready for the draw list's tree strip ({ kind: "tree", nodes: tree.view,
//   version: tree.version, pulse }). The root's parent is −1.
// - Extra exports: TREE (the defaults and caps), addNode(tree, x, y, parent) for a node the stage places itself
//   (the steered tip), and nearestNode(tree, x, y).
import { stream } from "../rng.js";

export const TREE = Object.freeze({ N: 400, D: 6, di: 48, dk: 12, maxNodes: 260, itersPerStep: 2, leafW: 1, pipeN: 2.5 });

export function createTree(opts = {}) {
  const N = Math.max(0, Math.min(TREE.N, Math.floor(opts.N ?? TREE.N)));
  const maxNodes = Math.max(1, Math.min(TREE.maxNodes, Math.floor(opts.maxNodes ?? TREE.maxNodes)));
  const root = opts.root || { x: 0, y: 0 };
  const r = stream(opts.seed ?? 1, "tree");
  const given = Array.isArray(opts.points) ? opts.points.slice(0, TREE.N) : null;
  const count = given ? given.length : N;
  const px = new Float32Array(count), py = new Float32Array(count);
  if (given) {
    given.forEach((p, i) => { px[i] = Array.isArray(p) ? p[0] : p.x; py[i] = Array.isArray(p) ? p[1] : p.y; });
  } else {
    const g = opts.region || { x: root.x, y: root.y, r: 150 };
    for (let i = 0; i < count; i++) {
      if (Number.isFinite(g.r)) {
        const rad = g.r * Math.sqrt(r()), a = 2 * Math.PI * r();
        px[i] = g.x + rad * Math.cos(a); py[i] = g.y + rad * Math.sin(a);
      } else {
        px[i] = g.x0 + (g.x1 - g.x0) * r(); py[i] = g.y0 + (g.y1 - g.y0) * r();
      }
    }
  }
  const tree = {
    nodes: new Float32Array(maxNodes * 4), n: 0, view: null, version: 0, maxNodes,
    D: opts.D ?? TREE.D, di: opts.di ?? TREE.di, dk: opts.dk ?? TREE.dk, leafW: opts.leafW ?? TREE.leafW,
    px, py, alive: new Uint8Array(count).fill(1), near: new Int32Array(count).fill(-1),
    nearD2: new Float32Array(count).fill(Infinity),
    ax: new Float32Array(maxNodes), ay: new Float32Array(maxNodes), sum: new Float32Array(maxNodes),
  };
  put(tree, root.x, root.y, -1);
  widths(tree);
  return tree;
}

// Add one node, update the points' nearest node, and use up the points within d_k of it.
function put(tree, x, y, parent) {
  const i = tree.n;
  tree.nodes[4 * i] = x; tree.nodes[4 * i + 1] = y; tree.nodes[4 * i + 2] = parent; tree.nodes[4 * i + 3] = tree.leafW;
  tree.n++;
  const dk2 = tree.dk * tree.dk;
  for (let p = 0; p < tree.px.length; p++) {
    if (!tree.alive[p]) continue;
    const dx = tree.px[p] - x, dy = tree.py[p] - y, d2 = dx * dx + dy * dy;
    if (d2 < dk2) tree.alive[p] = 0;
    else if (d2 < tree.nearD2[p]) { tree.nearD2[p] = d2; tree.near[p] = i; }
  }
  return i;
}

// Pipe-model widths: leaves get leafW; each parent gets (Σ child^n)^(1/n). Children always come after parents.
function widths(tree) {
  const { nodes, sum, n } = tree, k = TREE.pipeN;
  sum.fill(0, 0, n);
  for (let i = n - 1; i >= 0; i--) {
    const w = sum[i] > 0 ? Math.pow(sum[i], 1 / k) : tree.leafW;
    nodes[4 * i + 3] = w;
    const p = nodes[4 * i + 2];
    if (p >= 0) sum[p] += Math.pow(w, k);
  }
  tree.view = nodes.subarray(0, 4 * n);
}

export function nearestNode(tree, x, y) {
  let best = -1, bd = Infinity;
  for (let i = 0; i < tree.n; i++) {
    const dx = tree.nodes[4 * i] - x, dy = tree.nodes[4 * i + 1] - y, d2 = dx * dx + dy * dy;
    if (d2 < bd) { bd = d2; best = i; }
  }
  return best;
}

// A node the stage places itself; → its index, or −1 at the cap.
export function addNode(tree, x, y, parent) {
  if (tree.n >= tree.maxNodes || !Number.isFinite(x) || !Number.isFinite(y)) return -1;
  const p = Number.isInteger(parent) && parent >= 0 && parent < tree.n ? parent : nearestNode(tree, x, y);
  const i = put(tree, x, y, p);
  widths(tree);
  tree.version++;
  return i;
}

const inside = (active, x, y) => {
  for (const a of active) { const dx = x - a.x, dy = y - a.y; if (dx * dx + dy * dy <= a.r * a.r) return true; }
  return false;
};

export function growTree(tree, { active = null, iterations = TREE.itersPerStep } = {}) {
  const iters = Math.max(0, Math.min(TREE.itersPerStep, Math.floor(iterations)));
  const di2 = tree.di * tree.di, minGap2 = (tree.D * 0.25) ** 2;
  let added = 0;
  for (let it = 0; it < iters && tree.n < tree.maxNodes; it++) {
    const n0 = tree.n;
    tree.ax.fill(0, 0, n0); tree.ay.fill(0, 0, n0);
    for (let p = 0; p < tree.px.length; p++) {
      if (!tree.alive[p] || tree.nearD2[p] > di2) continue;
      if (active && !inside(active, tree.px[p], tree.py[p])) continue;
      const v = tree.near[p], d = Math.sqrt(tree.nearD2[p]) || 1;
      tree.ax[v] += (tree.px[p] - tree.nodes[4 * v]) / d;
      tree.ay[v] += (tree.py[p] - tree.nodes[4 * v + 1]) / d;
    }
    let grew = 0;
    for (let v = 0; v < n0 && tree.n < tree.maxNodes; v++) {
      const len = Math.hypot(tree.ax[v], tree.ay[v]);
      if (len < 1e-6) continue;
      const x = tree.nodes[4 * v] + (tree.D * tree.ax[v]) / len, y = tree.nodes[4 * v + 1] + (tree.D * tree.ay[v]) / len;
      let clash = false;
      for (let j = 0; j < tree.n && !clash; j++) {
        const dx = tree.nodes[4 * j] - x, dy = tree.nodes[4 * j + 1] - y;
        clash = dx * dx + dy * dy < minGap2;
      }
      if (clash) continue;
      put(tree, x, y, v);
      grew++;
    }
    if (!grew) break;
    added += grew;
  }
  if (added) { widths(tree); tree.version++; }
  return added;
}
