// Gloam Downs: the uniform block rewrite of Ink Studio's renderer (games/gloam-downs/uniform-blocks.mjs). Node only, no browser.
//   The source rewrite: arrays move into blocks, scalars, samplers and bool arrays stay, declarations in comments are not read, arrays
//   between #if and #endif stay, a moved array keeps the precision it had, and an array in both stages goes in one shared block.
//   The buffer: with a stand-in gl that gives std140 offsets and strides, each setter writes each value to the right word, it follows
//   the uniform*v length rules, a value that does not change sends nothing, and flush() sends only the words that changed.
//   The patch: patch-resources.mjs gives the committed resources.mjs from Ink Studio's file, and unpatch gives it back.
//   Every program that the vendored copy can make: no moved array stays in the default block, each stage keeps at most 200 vectors
//   there, each block is under 16384 bytes, and each stage has at most 12 blocks.
// Run: node qa/lab/gloam-downs-uniform-blocks.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { rewrite, uniformBlocks, defaultVectors, mask } from '../../games/gloam-downs/uniform-blocks.mjs';
import { patchResources, unpatchResources } from '../../games/gloam-downs/patch-resources.mjs';
import { inkPrograms } from '../../games/gloam-downs/ink-programs.mjs';

const INK = fileURLToPath(new URL('../../public/lab/gloam-downs/ink/', import.meta.url));
let n = 0;
const pass = name => { n++; console.log('PASS ' + name); };
const V = '#version 300 es\n';
// the default-block declarations of a source that are arrays (outside comments)
const arraysIn = src => [...mask(src).matchAll(/\buniform\s+(?:\w+\s+)?\w+\s+([^;{}]+);/g)]
  .flatMap(m => m[1].split(',').map(s => /(\w+)\s*\[/.exec(s)?.[1]).filter(Boolean));

/* ---------------- the source rewrite ---------------- */
{
  const vs = V + 'precision highp float;\nuniform mat4 u_view; uniform vec4 u_a[4], u_one; uniform vec3 u_b[8];\nvoid main() { gl_Position = u_view * u_a[1] + vec4(u_b[2], 0.0) + u_one; }\n';
  const fs = V + 'precision highp float;\nuniform sampler2D u_tex[2]; uniform bool u_on[3];\nuniform vec4 u_a[4];\nout vec4 o;\nvoid main() { o = u_a[0] + texture(u_tex[1], vec2(0)) * float(u_on[2]); }\n';
  const r = rewrite(vs, fs);
  assert.deepEqual(r.blocks.map(b => [b.name, b.members.map(m => m.name)]), [['InkUniformsVF0', ['u_a']], ['InkUniformsV0', ['u_b']]]);
  assert.deepEqual(arraysIn(r.vertex), [], 'the vertex stage keeps no array in the default block');
  assert.deepEqual(arraysIn(r.fragment), ['u_tex', 'u_on'], 'samplers and bool arrays stay');
  assert.match(r.vertex, /uniform vec4 u_one;/, 'the scalar of the same statement stays');
  assert.match(r.vertex, /uniform mat4 u_view;/);
  // the shared block is the same text in both stages
  const shared = src => /layout\(std140\) uniform InkUniformsVF0 \{[^}]*\}/.exec(src)[0];
  assert.equal(shared(r.vertex), shared(r.fragment));
  assert.match(shared(r.vertex), /highp vec4 u_a\[4\];/);
  // the code that reads the arrays does not change
  assert.ok(r.vertex.includes('u_view * u_a[1] + vec4(u_b[2], 0.0) + u_one'));
  pass('arrays move into blocks; scalars, samplers and bool arrays stay; a shared block is the same in both stages');
}
{ // comments and the preprocessor
  const fs = V + 'precision highp float;\n// uniform vec4 u_old[64];\n/* uniform vec4 u_gone[32];\n */\n#define DECL uniform vec4 u_def[8];\n' +
    '#ifdef FANCY\nuniform vec4 u_cond[16];\n#endif\nuniform vec4 u_x[4]; // uniform vec4 u_tail[9];\nout vec4 o;\nvoid main() { o = u_x[0]; }\n';
  const r = rewrite(V + 'void main() {}\n', fs);
  assert.deepEqual(r.blocks.flatMap(b => b.members.map(m => m.name)), ['u_x']);
  assert.deepEqual(r.skipped, ['u_cond'], 'the array between #ifdef and #endif stays where it is');
  assert.ok(r.fragment.includes('// uniform vec4 u_old[64];') && r.fragment.includes('/* uniform vec4 u_gone[32];'), 'comments stay as they are');
  assert.ok(r.fragment.includes('#ifdef FANCY\nuniform vec4 u_cond[16];\n#endif'));
  assert.ok(r.fragment.includes('#define DECL uniform vec4 u_def[8];'));
  // the block declaration is on the line of u_x, before its comment, not in it
  assert.match(r.fragment, /\nlayout\(std140\) uniform InkUniformsF0 \{ highp vec4 u_x\[4\]; \}; +\/\/ uniform vec4 u_tail\[9\];\n/);
  pass('declarations in comments are not read, arrays between #if and #endif stay, the block goes before a comment');
}
{ // precision: a moved array keeps the precision it had at its declaration
  const fs = V + 'precision mediump float;\nuniform vec4 u_a[4];\nuniform int u_i[3];\nprecision highp float; precision highp int;\nuniform lowp vec4 u_c[2]; uniform vec4 u_d[2]; uniform int u_j[2];\nout vec4 o;\nvoid main() { o = u_a[0] + u_c[0] + u_d[0] + float(u_i[0] + u_j[0]); }\n';
  const vs = V + 'uniform vec4 u_v[2]; uniform int u_k[2];\nvoid main() { gl_Position = u_v[0] + float(u_k[0]); }\n';
  const r = rewrite(vs, fs);
  const decl = Object.fromEntries(r.blocks.flatMap(b => b.members.map(m => [m.name, m.precision])));
  assert.deepEqual(decl, { u_v: 'highp', u_k: 'highp', u_a: 'mediump', u_i: 'mediump', u_c: 'lowp', u_d: 'highp', u_j: 'highp' });
  // the block declaration is before 'precision highp float', and u_d still says highp
  assert.ok(r.fragment.indexOf('InkUniformsF0') < r.fragment.indexOf('precision highp float'));
  assert.match(r.fragment, /highp vec4 u_d\[2\];/);
  pass('a moved array keeps its precision, also when its block goes before a precision statement');
}
{ // sources that are not GLSL ES 3.00, and a shared array that does not match, come back as they are
  const old = 'precision highp float; uniform vec4 u_a[4]; void main() {}';
  assert.equal(rewrite(old, old).vertex, old);
  const a = V + 'uniform vec4 u_a[4]; void main() {}', b = V + 'precision highp float; uniform vec4 u_a[5]; void main() {}';
  const r = rewrite(a, b);
  assert.equal(r.vertex, a);
  assert.equal(r.fragment, b);
  pass('GLSL ES 1.00 and a shared array of two sizes are not changed');
}
{ // a block holds at most 960 vectors, so a large set of arrays makes two blocks
  const fs = V + 'precision highp float; uniform vec4 u_a[600]; uniform vec4 u_b[600]; out vec4 o; void main() { o = u_a[0] + u_b[0]; }';
  const r = rewrite(V + 'void main() {}', fs);
  assert.deepEqual(r.blocks.map(b => b.members.map(m => m.name)), [['u_a'], ['u_b']]);
  pass('a block over 960 vectors is split');
}

/* ---------------- the buffer, with a stand-in gl ---------------- */
// std140 for arrays: each element starts on 16 bytes; a matCxR array element is C columns of 16 bytes each
function standIn(program) {
  const calls = [];
  const gl = {
    INVALID_INDEX: 0xffffffff, UNIFORM_BUFFER: 0x8a11, DYNAMIC_DRAW: 0x88e8,
    UNIFORM_OFFSET: 1, UNIFORM_ARRAY_STRIDE: 2, UNIFORM_MATRIX_STRIDE: 3, UNIFORM_BLOCK_DATA_SIZE: 4,
    getUniformBlockIndex: (p, name) => program.blocks.findIndex(b => b.name === name) >>> 0,
    uniformBlockBinding: (p, i, b) => calls.push(['binding', program.blocks[i].name, b]),
    getActiveUniformBlockParameter: (p, i) => program.blocks[i].size,
    createBuffer: () => ({ id: calls.length }),
    deleteBuffer() {},
    bindBuffer() {},
    bufferData: (t, size) => calls.push(['data', size]),
    bufferSubData: (t, at, src, from, length) => calls.push(['sub', at, from, length, [...new Float32Array(src.buffer, from, length / 4)]]),
    bindBufferBase: (t, b, buf) => calls.push(['base', b]),
    getUniformIndices: (p, names) => names.map(nm => program.index[nm] ?? 0xffffffff),
    getActiveUniforms: (p, ids, what) => ids.map(i => program.members[i][what])
  };
  return { gl, calls };
}
{
  const vs = V + 'uniform vec3 u_c[3]; uniform mat3 u_m[2]; uniform ivec2 u_i[2]; void main() { gl_Position = vec4(u_c[0], 1) + vec4(u_m[0][0], float(u_i[0].x)); }';
  const fs = V + 'precision highp float; out vec4 o; void main() { o = vec4(0); }';
  // the layout that a std140 driver gives: u_c at 0 (3 x 16), u_m at 48 (2 x 3 columns x 16), u_i at 144 (2 x 16)
  const program = {
    blocks: [{ name: 'InkUniformsV0', size: 176 }],
    index: { 'u_c[0]': 0, 'u_m[0]': 1, 'u_i[0]': 2 },
    members: [{ 1: 0, 2: 16, 3: 0 }, { 1: 48, 2: 48, 3: 16 }, { 1: 144, 2: 16, 3: 0 }]
  };
  const { gl, calls } = standIn(program);
  const b = uniformBlocks(gl, vs, fs), setters = {};
  b.link({}, setters, []);
  assert.deepEqual(Object.keys(setters).sort(), ['u_c', 'u_i', 'u_m']);
  calls.length = 0;
  setters.u_c([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  setters.u_m([...Array(18).keys()].map(x => x + 100));
  setters.u_i(new Int32Array([7, -8, 9, 10]));
  b.flush();
  const sub = calls.find(c => c[0] === 'sub');
  const words = new Float32Array(44), ints = new Int32Array(words.buffer);
  sub[4].forEach((x, k) => { words[sub[1] / 4 + k] = x; });
  assert.deepEqual([...words.slice(0, 12)], [1, 2, 3, 0, 4, 5, 6, 0, 7, 8, 9, 0], 'vec3 elements on 16 bytes');
  assert.deepEqual([...words.slice(12, 36)], [100, 101, 102, 0, 103, 104, 105, 0, 106, 107, 108, 0, 109, 110, 111, 0, 112, 113, 114, 0, 115, 116, 117, 0], 'mat3 columns on 16 bytes');
  assert.deepEqual([...ints.slice(36, 44)], [7, -8, 0, 0, 9, 10, 0, 0], 'ivec2 elements as integers on 16 bytes');
  assert.deepEqual(calls.filter(c => c[0] === 'base'), [['base', 0]], 'flush binds the block');
  pass('the setters write vec3, mat3 and ivec2 arrays at the std140 offsets and strides');

  // the same values again: no upload, but the bind stays
  calls.length = 0;
  setters.u_c([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  setters.u_m(new Float32Array([...Array(18).keys()].map(x => x + 100)));
  b.flush();
  assert.deepEqual(calls, [['base', 0]]);
  // one changed value sends one word; 0.1 is compared as a 32-bit float, so a second 0.1 sends nothing
  setters.u_c([1, 2, 3, 4, 0.1, 6, 7, 8, 9]);
  b.flush();
  assert.deepEqual(calls.filter(c => c[0] === 'sub').map(c => c.slice(0, 4)), [['sub', 20, 20, 4]]);
  calls.length = 0;
  setters.u_c([1, 2, 3, 4, 0.1, 6, 7, 8, 9]);
  b.flush();
  assert.deepEqual(calls, [['base', 0]]);
  // -0 is not the same as 0
  setters.u_c([-0, 2, 3]);
  b.flush();
  assert.equal(calls.filter(c => c[0] === 'sub').length, 1);
  pass('a value that does not change sends nothing; flush sends only the words that changed');

  // the uniform*v rules: a length that is not a whole number of elements sets nothing, extra elements are ignored
  calls.length = 0;
  setters.u_c([5, 5]);
  setters.u_c([]);
  b.flush();
  assert.deepEqual(calls, [['base', 0]], 'a part of an element sets nothing');
  setters.u_c([1, 2, 3, 4, 5, 6, 7, 8, 9, 50, 51, 52]);
  b.flush();
  const last = calls.filter(c => c[0] === 'sub').pop();
  assert.ok(last[1] + last[3] <= 48, 'the fourth element of a [3] array is not written');
  pass('the setters follow the length rules of uniform*v');
}

/* ---------------- the patch ---------------- */
{
  const committed = fs.readFileSync(INK + 'webgl/resources.mjs', 'utf8');
  const original = unpatchResources(committed);
  assert.equal(patchResources(original), committed);
  assert.ok(!original.includes('uniformBlocks'));
  let pkg = null;
  try { pkg = createRequire(new URL('../../games/gloam-downs/', import.meta.url)).resolve('@shapeshift-labs/ink-studio/src/webgl/resources.mjs'); } catch {}
  if (pkg) assert.equal(fs.readFileSync(pkg, 'utf8'), original, 'unpatch gives Ink Studio\'s file');
  assert.throws(() => patchResources(committed), /does not fit/);
  pass(`the patch makes the committed resources.mjs, and unpatch gives the original back${pkg ? ' (the same as the pinned package)' : ''}`);
}

/* ---------------- every program of the vendored copy ---------------- */
{
  const programs = await inkPrograms(INK);
  assert.equal(programs.length, 15);
  for (const { name, vertex, fragment } of programs) {
    const r = rewrite(vertex, fragment);
    assert.deepEqual(r.skipped, [], `${name}: no array between #if and #endif`);
    const moved = new Set(r.blocks.flatMap(b => b.members.map(m => m.name)));
    for (const src of [r.vertex, r.fragment]) {
      assert.ok(arraysIn(src).every(a => !moved.has(a)), `${name}: a moved array is still declared in the default block`);
      assert.ok(defaultVectors(src) <= 200, `${name}: ${defaultVectors(src)} default-block vectors`);
      const blocks = (src.match(/layout\(std140\) uniform \w+/g) || []).length;
      assert.ok(blocks <= 12, `${name}: ${blocks} blocks in one stage`);
    }
    for (const b of r.blocks) {
      const vectors = b.members.reduce((s, m) => s + m.size * m.cols, 0);
      assert.ok(vectors * 16 <= 16384, `${name}: block ${b.name} is ${vectors * 16} bytes`);
    }
  }
  const post = rewrite(programs[1].vertex, programs[1].fragment);
  assert.ok(defaultVectors(programs[1].fragment) > 256 && defaultVectors(post.fragment) < 100, 'the resolve program was over 256 and is now under 100');
  pass(`all ${programs.length} programs: at most 200 default-block vectors in each stage, blocks under 16384 bytes, at most 12 in a stage`);
}

console.log(`\n${n} checks passed`);
