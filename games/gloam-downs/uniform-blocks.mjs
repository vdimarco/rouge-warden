// Uniform blocks for Ink Studio's WebGL 2 programs. vendor.mjs copies this file to public/lab/gloam-downs/ink/webgl/ and patches
// resources.mjs to use it. Do not edit the copy there: edit this file and run vendor.mjs again.
//
// Why: many phone GPUs (for example Qualcomm Adreno) give only 256 uniform vectors to each shader stage. Ink Studio's resolve program
// keeps more than 500 vectors of arrays (palettes, ramps, pattern data) in the default uniform block, so it does not link there.
// What: before compilation, each uniform array moves out of the default block into a std140 uniform block. The GLSL that reads the
// array does not change, because the block has no instance name. A block that has a member in both stages has the same members in
// the same order in both stages. After the link, the named setters of the program write those arrays into a buffer at the offsets and
// strides that the driver gives. set() then sends the changed buffers and binds each block before the draw that follows it.
// Rules: samplers and bool arrays stay in the default block. So do arrays between #if and #endif. Declarations in comments are not
// read. Each block has at most MAX_VECTORS vectors (16 bytes each), so a block is
// smaller than the 16384 bytes that every WebGL 2 driver supports.

const MAX_VECTORS = 960;
const VECTOR_TYPES = {
  float: [1, 1, 'f'], vec2: [2, 1, 'f'], vec3: [3, 1, 'f'], vec4: [4, 1, 'f'],
  int: [1, 1, 'i'], ivec2: [2, 1, 'i'], ivec3: [3, 1, 'i'], ivec4: [4, 1, 'i'],
  uint: [1, 1, 'u'], uvec2: [2, 1, 'u'], uvec3: [3, 1, 'u'], uvec4: [4, 1, 'u'],
  mat2: [2, 2, 'f'], mat3: [3, 3, 'f'], mat4: [4, 4, 'f'],
  mat2x2: [2, 2, 'f'], mat2x3: [3, 2, 'f'], mat2x4: [4, 2, 'f'],
  mat3x2: [2, 3, 'f'], mat3x3: [3, 3, 'f'], mat3x4: [4, 3, 'f'],
  mat4x2: [2, 4, 'f'], mat4x3: [3, 4, 'f'], mat4x4: [4, 4, 'f']
};
// a uniform statement of the default block: uniform [precision] type a[N], b, c[M];
const STATEMENT = /\buniform\s+(?:(lowp|mediump|highp)\s+)?([A-Za-z_]\w*)\s+([^;{}]+);/g;
const DECLARATOR = /^\s*([A-Za-z_]\w*)\s*(?:\[\s*(\d+)\s*\])?\s*$/;
const PRECISION = /\bprecision\s+(lowp|mediump|highp)\s+(float|int)\s*;/g;

// The source with each comment and each preprocessor line changed to spaces. Line breaks stay, so an offset in this text is the same
// offset in the source. Thus the scan does not see a declaration in a comment or in a #define.
export function mask(source) {
  const blank = text => text.replace(/[^\n]/g, ' ');
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, blank).replace(/^[ \t]*#[^\n]*/gm, blank);
}

// the ranges of the source between #if, #ifdef or #ifndef and the #endif that closes it (comments already blank)
function conditionals(text) {
  const ranges = [];
  let depth = 0, from = 0, at = 0;
  for (const line of text.split('\n')) {
    const directive = /^\s*#\s*(\w+)/.exec(line)?.[1];
    if (directive === 'if' || directive === 'ifdef' || directive === 'ifndef') { if (depth++ === 0) from = at; }
    else if (directive === 'endif' && depth > 0 && --depth === 0) ranges.push([from, at + line.length]);
    at += line.length + 1;
  }
  if (depth) ranges.push([from, text.length]);
  return ranges;
}

// The uniform arrays that one stage's source declares, and how to take them out. An array in a comment is not an array. An array
// between #if and #endif stays in the default block (in skipped), because the preprocessor decides if it exists.
// Each moved array keeps the precision it had at its declaration: the written one, or else the default precision of that point.
// So the block declarations can go before a precision statement and the precision does not change.
function scan(source, stage) {
  const arrays = [], skipped = [];
  if (!source.startsWith('#version 300 es')) return { arrays, skipped, cut: () => source };
  const comments = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, text => text.replace(/[^\n]/g, ' '));
  const inside = conditionals(comments);
  const text = mask(source);
  const defaults = [...text.matchAll(PRECISION)].map(m => ({ at: m.index, precision: m[1], type: m[2] }));
  // the precision of a declaration with no precision word: the last precision statement before it, else the default of the stage
  const precisionAt = (at, kind) => {
    const base = kind === 'f' ? 'float' : 'int';
    const last = defaults.filter(d => d.type === base && d.at < at).pop();
    if (last) return last.precision;
    if (stage === 'vertex') return 'highp';
    return base === 'int' ? 'mediump' : ''; // a fragment shader has no default float precision: then the source did not compile before
  };
  const edits = [];
  for (const m of text.matchAll(STATEMENT)) {
    const [whole, precision = '', type, list] = m;
    const shape = VECTOR_TYPES[type];
    if (!shape) continue;
    const parts = list.split(','), keep = [];
    const conditional = inside.some(([from, to]) => m.index >= from && m.index < to);
    let moved = false;
    for (const part of parts) {
      const d = DECLARATOR.exec(part);
      const size = d?.[2] ? Number(d[2]) : 1;
      if (!d || size < 2) { keep.push(part); continue; }
      if (conditional) { skipped.push(d[1]); keep.push(part); continue; }
      arrays.push({ name: d[1], type, precision: precision || precisionAt(m.index, shape[2]), size, rows: shape[0], cols: shape[1], kind: shape[2] });
      moved = true;
    }
    if (!moved) continue;
    const rest = keep.length ? `uniform ${precision ? precision + ' ' : ''}${type} ${keep.map(s => s.trim()).join(', ')};` : '';
    edits.push({ from: m.index, to: m.index + whole.length, text: rest });
  }
  return {
    arrays, skipped,
    // remove the moved declarations and put the block declarations where the first moved declaration was
    cut(blocks) {
      let out = source;
      for (let i = edits.length - 1; i >= 0; i--) {
        const e = edits[i];
        out = out.slice(0, e.from) + (i === 0 ? blocks : '') + e.text + out.slice(e.to);
      }
      return out;
    }
  };
}

// the block declarations of one stage
function declare(blocks) {
  return blocks.map(b => `layout(std140) uniform ${b.name} { ${b.members.map(m =>
    `${m.precision ? m.precision + ' ' : ''}${m.type} ${m.name}[${m.size}];`).join(' ')} };`).join(' ') + ' ';
}

// split members into blocks of at most MAX_VECTORS vectors each
function group(prefix, members) {
  const blocks = [];
  let block = null, vectors = 0;
  for (const m of members) {
    const need = m.size * m.cols;
    if (!block || vectors + need > MAX_VECTORS) {
      block = { name: `${prefix}${blocks.length}`, members: [] };
      blocks.push(block);
      vectors = 0;
    }
    block.members.push(m);
    vectors += need;
  }
  return blocks;
}

/* rewrite(vertex, fragment) -> { vertex, fragment, blocks, skipped }
   The sources with the uniform arrays moved into blocks, the blocks (each { name, members }), and the names of the arrays that stay in
   the default block because they are between #if and #endif. Sources that are not GLSL ES 3.00, or that have no uniform arrays, come
   back as they are. It does not use WebGL, so a Node test and vendor.mjs can run it. */
export function rewrite(vertex, fragment) {
  const v = scan(vertex, 'vertex'), f = scan(fragment, 'fragment');
  const skipped = [...v.skipped, ...f.skipped];
  const none = { vertex, fragment, blocks: [], skipped };
  if (!v.arrays.length && !f.arrays.length) return none;
  const inV = new Map(v.arrays.map(a => [a.name, a])), inF = new Map(f.arrays.map(a => [a.name, a]));
  // an array that both stages declare goes in a block that both stages declare, in the same order
  const both = [...inV.keys()].filter(n => inF.has(n)).sort();
  for (const n of both) {
    const a = inV.get(n), b = inF.get(n);
    if (a.type !== b.type || a.size !== b.size) return none; // the original program does not link: leave it so
  }
  const shared = group('InkUniformsVF', both.map(n => inV.get(n)));
  const vOnly = group('InkUniformsV', v.arrays.filter(a => !inF.has(a.name)));
  const fOnly = group('InkUniformsF', f.arrays.filter(a => !inV.has(a.name)));
  // each stage's shared block uses that stage's own precision, as the original declarations did
  const sharedIn = map => shared.map(b => ({ name: b.name, members: b.members.map(m => map.get(m.name)) }));
  const vBlocks = [...sharedIn(inV), ...vOnly], fBlocks = [...sharedIn(inF), ...fOnly];
  return {
    vertex: vBlocks.length ? v.cut(declare(vBlocks)) : vertex,
    fragment: fBlocks.length ? f.cut(declare(fBlocks)) : fragment,
    blocks: [...shared, ...vOnly, ...fOnly],
    skipped
  };
}

/* The vectors that the default block of one stage can use at most: each non-sampler uniform that the source declares (outside
   comments), with one vector for each array element and each matrix column. It counts declared uniforms, also ones that the stage
   does not use, so it is high or equal to what a driver counts. */
export function defaultVectors(source) {
  let vectors = 0;
  for (const m of mask(source).matchAll(STATEMENT)) {
    const shape = VECTOR_TYPES[m[2]] || (m[2] === 'bool' || /^bvec[234]$/.test(m[2]) ? [1, 1] : null);
    if (!shape) continue;
    for (const part of m[3].split(',')) {
      const d = DECLARATOR.exec(part);
      vectors += (d?.[2] ? Number(d[2]) : 1) * shape[1];
    }
  }
  return vectors;
}

/* uniformBlocks(gl, vertex, fragment) -> { vertex, fragment, link(program, setters, release), flush() }
   vertex and fragment are the rewritten sources. link() runs after a good link: it binds each block to its binding point, makes its
   buffer and puts a setter for each moved array into setters. flush() sends the changed part of each buffer and binds the buffers
   (call it after the setters and before the draw). */
export function uniformBlocks(gl, vertex, fragment) {
  const out = rewrite(vertex, fragment), blocks = out.blocks;
  if (!blocks.length) return { vertex: out.vertex, fragment: out.fragment, link() {}, flush() {} };
  let live = [];
  return {
    vertex: out.vertex,
    fragment: out.fragment,
    link(program, setters, release) {
      live = [];
      blocks.forEach(block => {
        const index = gl.getUniformBlockIndex(program, block.name);
        if (index === gl.INVALID_INDEX) return; // no stage reads it
        const binding = live.length;
        gl.uniformBlockBinding(program, index, binding);
        const bytes = gl.getActiveUniformBlockParameter(program, index, gl.UNIFORM_BLOCK_DATA_SIZE);
        const data = new ArrayBuffer(bytes);
        const views = { f: new Float32Array(data), i: new Int32Array(data), u: new Uint32Array(data) };
        // the same conversion that the typed array makes, so that a value can be compared with the one in the buffer
        const convert = { f: Math.fround, i: x => x | 0, u: x => x >>> 0 };
        const buffer = gl.createBuffer();
        if (!buffer) throw new Error('Could not allocate WebGL Buffer');
        release.push(() => gl.deleteBuffer(buffer));
        gl.bindBuffer(gl.UNIFORM_BUFFER, buffer);
        gl.bufferData(gl.UNIFORM_BUFFER, bytes, gl.DYNAMIC_DRAW); // all zero, as the views are, and as the default block starts
        gl.bindBuffer(gl.UNIFORM_BUFFER, null);
        // lo and hi: the 4-byte words that changed since the last flush (lo > hi: none)
        const entry = { binding, buffer, bytes: new Uint8Array(data), lo: Infinity, hi: -1 };
        const indices = gl.getUniformIndices(program, block.members.map(m => m.name + '[0]'));
        const ok = indices.map(i => i !== gl.INVALID_INDEX && i !== -1 && i != null);
        const found = indices.filter((_, k) => ok[k]);
        const offsets = found.length ? gl.getActiveUniforms(program, found, gl.UNIFORM_OFFSET) : [];
        const strides = found.length ? gl.getActiveUniforms(program, found, gl.UNIFORM_ARRAY_STRIDE) : [];
        const matrix = found.length ? gl.getActiveUniforms(program, found, gl.UNIFORM_MATRIX_STRIDE) : [];
        let k = 0;
        block.members.forEach((m, j) => {
          if (!ok[j]) return;
          const offset = offsets[k] / 4, stride = strides[k] / 4, column = (matrix[k] || 16) / 4;
          k++;
          const view = views[m.kind], to = convert[m.kind], per = m.rows * m.cols;
          // the same rules as uniform*v: a length that is not a whole number of elements sets nothing, extra elements are ignored.
          // Only a value that is not the same as the one in the buffer marks the buffer, so an unchanged palette sends nothing.
          setters[m.name] = value => {
            if (typeof value === 'number' || typeof value === 'boolean') value = [+value];
            const n = value?.length ?? 0;
            if (!n || n % per) return;
            const count = Math.min(m.size, n / per);
            for (let e = 0; e < count; e++)
              for (let c = 0; c < m.cols; c++)
                for (let r = 0; r < m.rows; r++) {
                  const at = offset + e * stride + c * column + r, x = to(+value[e * per + c * m.rows + r]);
                  if (at >= view.length || Object.is(view[at], x)) continue; // never past the end of the block
                  view[at] = x;
                  if (at < entry.lo) entry.lo = at;
                  if (at > entry.hi) entry.hi = at;
                }
          };
        });
        live.push(entry);
      });
    },
    flush() {
      for (const entry of live) {
        if (entry.lo <= entry.hi) {
          gl.bindBuffer(gl.UNIFORM_BUFFER, entry.buffer);
          gl.bufferSubData(gl.UNIFORM_BUFFER, entry.lo * 4, entry.bytes, entry.lo * 4, (entry.hi - entry.lo + 1) * 4);
          gl.bindBuffer(gl.UNIFORM_BUFFER, null);
          entry.lo = Infinity;
          entry.hi = -1;
        }
        gl.bindBufferBase(gl.UNIFORM_BUFFER, entry.binding, entry.buffer);
      }
    }
  };
}
