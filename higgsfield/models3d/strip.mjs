// Keeps only the largest connected part (the body) of a turned Tripo model and centres it on x = z = 0, so the
// auto-rigger sees one centred humanoid. Props are added back after rigging by process-hero.mjs (propsFrom).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, compactPrimitive } from '@gltf-transform/functions';
const [input, output] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS), doc = await io.read(input);
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0], pos = prim.getAttribute('POSITION'), n = pos.getCount();
const ix = prim.getIndices().getArray(), parent = Int32Array.from({ length: n }, (_, i) => i);
const find = i => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
for (let t = 0; t < ix.length; t += 3) { union(ix[t], ix[t + 1]); union(ix[t + 1], ix[t + 2]); }
const key = new Map(), p = [0, 0, 0];
for (let i = 0; i < n; i++) { pos.getElement(i, p); const k = p.map(v => v.toFixed(4)).join(); if (key.has(k)) union(i, key.get(k)); else key.set(k, i); }
const count = new Map(); for (let i = 0; i < n; i++) { const r = find(i); count.set(r, (count.get(r) || 0) + 1); }
const body = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
const keep = new Uint8Array(n); for (let i = 0; i < n; i++) keep[i] = find(i) === body ? 1 : 0;
const tris = []; for (let t = 0; t < ix.length; t += 3) if (keep[ix[t]] && keep[ix[t + 1]] && keep[ix[t + 2]]) tris.push(ix[t], ix[t + 1], ix[t + 2]);
// Centre the body: shift every vertex (unused prop vertices go with it; prune drops nothing, but they are unreferenced).
let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
for (let i = 0; i < n; i++) if (keep[i]) { pos.getElement(i, p); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); } }
const cx = (lo[0] + hi[0]) / 2, cz = (lo[2] + hi[2]) / 2;
for (let i = 0; i < n; i++) { pos.getElement(i, p); pos.setElement(i, [p[0] - cx, p[1], p[2] - cz]); }
prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(tris)).setBuffer(prim.getIndices().getBuffer()));
compactPrimitive(prim);
await doc.transform(prune());
await io.write(output, doc);
console.log(input, 'body', count.get(body), 'of', n, 'shift', cx.toFixed(3), cz.toFixed(3));
