// Gloam Downs: the renderer's uniform limits, in a real browser (public/lab/gloam-downs/), on software WebGL 2.
//   Many phone GPUs (for example Qualcomm Adreno) give only 256 uniform vectors to each shader stage. A program that uses more does
//   not link there, and the page cannot start. Desktop drivers give 1024 or more, so a desktop browser does not show the problem.
//   This check wraps linkProgram and counts the vectors of the default uniform block in each stage of each linked program, as a GLES
//   driver packs them: each element of a float, vec, int, ivec, uint, uvec or bool array is one vector, mat2 is 2, mat3 is 3, mat4 is 4,
//   samplers count 0, and the members of a uniform block count 0. A uniform counts in a stage when its name is in that stage's source
//   more than once (its declaration and one use or more).
//   It fails when a program has more than 200 vectors in a stage (a margin under 256), when a program does not link, or when the page
//   has errors. The cases: the explorer in the five dark places and the three Lattice places, the run with foes (?run&test&fresh&seed=7,
//   with the lineup of every figure), the run at low health (the grade), and the boss place with the boss files in. The last case
//   (all-programs) makes every program that Ink Studio can make, also water, sprites, the key and the damping, which these places do
//   not use. It sets their arrays and checks for GL errors, but it does not draw them.
//   For each case it draws one frame at a fixed game time with __gloam.draw. Then it loads the same case again, with the renderer
//   that Ink Studio ships (resources.mjs without the uniform block patch, served in place of the patched file), draws the same frame
//   and compares the two pictures. It fails when more than 0.1% of the pixels differ, or when one channel differs by more than 1 level.
//   With REF=<dir> it compares with the pictures in that folder instead (one pass for each case). NOREF=1 skips the pictures.
//   With PICS=<dir> it writes the pictures there (a .png to look at and a .rgba.gz that REF can read).
// Needs the site served: python3 -m http.server 8765 --bind 0.0.0.0 --directory public
// Run: node qa/lab/gloam-downs-uniforms.e2e.mjs   (SITE_URL to point elsewhere, PICS=<dir>, REF=<dir>, NOREF=1, ONLY=<case,...>, LIMIT=<n>,
//   CAP256=1 to make getParameter give 256 for MAX_VERTEX_UNIFORM_VECTORS and MAX_FRAGMENT_UNIFORM_VECTORS)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { unpatchResources } from '../../games/gloam-downs/patch-resources.mjs';
const { chromium } = createRequire(new URL('../browser/x.mjs', import.meta.url))('playwright');
const SITE = (process.env.SITE_URL || 'http://127.0.0.1:8765').replace(/\/$/, '');
const PICS = process.env.PICS, REF = process.env.REF;
const LIMIT = Number(process.env.LIMIT) || 200;
if (PICS) fs.mkdirSync(PICS, { recursive: true });
const executablePath = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const TIME = 2.5; // the game time of every picture
const failures = [];
const fail = msg => { failures.push(msg); console.log('FAIL ' + msg); };

// The init script: it runs in the page before the game. It keeps each shader's source and, after each link, the program's counts.
function watch(cap) {
  const P = WebGL2RenderingContext.prototype;
  const sources = new WeakMap(), attached = new WeakMap();
  const programs = window.__uniformPrograms = [];
  const shaderSource = P.shaderSource, attachShader = P.attachShader, linkProgram = P.linkProgram, getParameter = P.getParameter;
  P.shaderSource = function (shader, source) { sources.set(shader, source); return shaderSource.call(this, shader, source); };
  P.attachShader = function (program, shader) {
    if (!attached.has(program)) attached.set(program, []);
    attached.get(program).push(shader);
    return attachShader.call(this, program, shader);
  };
  if (cap) P.getParameter = function (name) {
    if (name === this.MAX_FRAGMENT_UNIFORM_VECTORS || name === this.MAX_VERTEX_UNIFORM_VECTORS) return 256;
    return getParameter.call(this, name);
  };
  P.linkProgram = function (program) {
    const result = linkProgram.call(this, program);
    const gl = this, shaders = attached.get(program) || [];
    const stage = type => shaders.map(s => ({ s, src: sources.get(s) || '' })).find(x => gl.getShaderParameter(x.s, gl.SHADER_TYPE) === type)?.src || '';
    const vs = stage(gl.VERTEX_SHADER), fs = stage(gl.FRAGMENT_SHADER);
    const entry = { linked: !!gl.getProgramParameter(program, gl.LINK_STATUS), log: '', vertex: 0, fragment: 0, blocks: 0, top: [] };
    if (!entry.linked) entry.log = String(gl.getProgramInfoLog(program)).slice(0, 400);
    else {
      const n = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      const all = [...Array(n).keys()];
      const blockOf = n ? gl.getActiveUniforms(program, all, gl.UNIFORM_BLOCK_INDEX) : [];
      entry.blocks = gl.getProgramParameter(program, gl.ACTIVE_UNIFORM_BLOCKS);
      const ROWS = {
        [gl.FLOAT_MAT2]: 2, [gl.FLOAT_MAT3]: 3, [gl.FLOAT_MAT4]: 4, [gl.FLOAT_MAT2x3]: 2, [gl.FLOAT_MAT2x4]: 2,
        [gl.FLOAT_MAT3x2]: 3, [gl.FLOAT_MAT3x4]: 3, [gl.FLOAT_MAT4x2]: 4, [gl.FLOAT_MAT4x3]: 4
      };
      const SAMPLERS = new Set([gl.SAMPLER_2D, gl.SAMPLER_3D, gl.SAMPLER_CUBE, gl.SAMPLER_2D_SHADOW, gl.SAMPLER_2D_ARRAY,
        gl.SAMPLER_2D_ARRAY_SHADOW, gl.SAMPLER_CUBE_SHADOW, gl.INT_SAMPLER_2D, gl.INT_SAMPLER_3D, gl.INT_SAMPLER_CUBE,
        gl.INT_SAMPLER_2D_ARRAY, gl.UNSIGNED_INT_SAMPLER_2D, gl.UNSIGNED_INT_SAMPLER_3D, gl.UNSIGNED_INT_SAMPLER_CUBE,
        gl.UNSIGNED_INT_SAMPLER_2D_ARRAY]);
      const uses = (src, name) => (src.match(new RegExp('\\b' + name + '\\b', 'g')) || []).length > 1;
      for (const i of all) {
        if (blockOf[i] !== -1) continue;
        const info = gl.getActiveUniform(program, i);
        if (SAMPLERS.has(info.type)) continue;
        const name = info.name.replace(/\[0\]$/, ''), vectors = (ROWS[info.type] || 1) * info.size;
        const inV = uses(vs, name), inF = uses(fs, name);
        if (inV) entry.vertex += vectors;
        if (inF) entry.fragment += vectors;
        if (vectors >= 8) entry.top.push(`${name}[${info.size}]=${vectors}${inV ? 'V' : ''}${inF ? 'F' : ''}`);
      }
    }
    programs.push(entry);
    return result;
  };
}

const CASES = [
  ...['gaol', 'ramparts', 'fen', 'bells', 'barrows', 'piazza', 'cupola', 'orrery'].map(id => ({ name: `explore-${id}`, query: `?explore&fresh&test&place=${id}`, place: id })),
  { name: 'run-gaol', query: '?run&test&fresh&seed=7', run: true },
  { name: 'run-lineup', query: '?run&test&fresh&seed=7&lineup', run: true, lineup: true },
  { name: 'run-low', query: '?run&test&fresh&seed=7', run: true, low: true },
  { name: 'run-boss', query: '?run&test&fresh&seed=7', run: true, boss: true },
  // every program that Ink Studio can make, also the ones that these places do not use (water, sprites, the key, the damping)
  { name: 'all-programs', query: '?explore&fresh&test&place=gaol', place: 'gaol', compile: true }
].filter(c => !process.env.ONLY || process.env.ONLY.split(',').includes(c.name));

// draw the frame and read it back: { w, h, b64 } with RGBA rows bottom first, and a PNG data URL of the same pixels
const picture = (page, time) => page.evaluate(time => {
  window.__gloam.draw({ time });
  const c = document.getElementById('view'), gl = c.getContext('webgl2'), w = c.width, h = c.height, px = new Uint8Array(w * h * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const g = out.getContext('2d'), img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
  g.putImageData(img, 0, 0);
  let s = '';
  for (let i = 0; i < px.length; i += 0x8000) s += String.fromCharCode.apply(null, px.subarray(i, i + 0x8000));
  return { w, h, b64: btoa(s), png: out.toDataURL('image/png') };
}, time);

function compare(a, b) {
  if (a.length !== b.length) return { size: true };
  let diff = 0, worst = 0;
  for (let i = 0; i < a.length; i += 4) {
    let d = 0;
    for (let k = 0; k < 4; k++) d = Math.max(d, Math.abs(a[i + k] - b[i + k]));
    if (d) diff++;
    worst = Math.max(worst, d);
  }
  return { diff, share: diff / (a.length / 4), worst };
}

// Ink Studio's resources.mjs without the uniform block patch: the committed copy with the patch taken out. (The Node test
// qa/lab/gloam-downs-uniform-blocks.test.mjs checks that this is the pinned package's file.) The reference pass serves it.
const PATCHED = fs.readFileSync(new URL('../../public/lab/gloam-downs/ink/webgl/resources.mjs', import.meta.url), 'utf8');
const UNPATCHED = unpatchResources(PATCHED);

// One pass of a case in a new context: load the page, go to the case's state, draw the frame twice, and keep the counts.
// unpatched: serve the renderer without the uniform blocks (the reference pass).
async function shoot(browser, c, unpatched) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  await ctx.route('**/api/**', r => r.fulfill({ status: 204, body: '' }));
  if (unpatched) await ctx.route('**/lab/gloam-downs/ink/webgl/resources.mjs*', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: UNPATCHED }));
  await ctx.addInitScript(watch, !!process.env.CAP256);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // console errors count, and WebGL warnings (an INVALID_OPERATION is a warning); the driver's notes on speed do not
  page.on('console', m => {
    const text = m.text();
    if (m.type() === 'error' || (m.type() === 'warning' && /WebGL/.test(text) && !/Performance/.test(text))) errors.push(`console ${m.type()}: ${text}`.slice(0, 300));
  });
  try {
    await page.goto(`${SITE}/lab/gloam-downs/${c.query}`);
    await page.waitForFunction(() => window.__gloam?.ready(), null, { timeout: 180000 });
    if (c.run) {
      if (await page.isVisible('#bBegin')) await page.click('#bBegin');
      if (c.boss) {
        await page.evaluate(() => window.__gloam.go('barrows'));
        await page.waitForFunction(() => window.__gloam?.ready() && window.__gloam.state().place === 'barrows', null, { timeout: 180000 });
        await page.waitForFunction(() => window.__gloam.boss()?.files === 'in', null, { timeout: 180000 });
        // 14 m south of the arena's centre, facing it: outside the intro's 11 m
        await page.evaluate(() => { window.__gloam.teleport(18, -22 + 14, Math.PI); window.__gloam.tick(0.2, {}); });
      } else if (c.lineup) {
        if (await page.evaluate(() => window.__gloam.state().place) !== 'gaol') {
          await page.evaluate(() => window.__gloam.go('gaol'));
          await page.waitForFunction(() => window.__gloam?.ready() && window.__gloam.state().place === 'gaol', null, { timeout: 180000 });
        }
        await page.evaluate(() => {
          const g = window.__gloam;
          g.teleport(1, 6, Math.PI);
          g.tick(0.1, {});
          g.lineup({});
          g.tick(0.35, {});
        });
      } else {
        await page.evaluate(low => { const g = window.__gloam; if (low) g.set({ hp: 1 }); g.tick(1, {}); }, !!c.low);
      }
    } else {
      // a fresh save opens only the first dark place and the Lattice, so ?place= alone does not reach every place: go there
      if (await page.evaluate(() => window.__gloam.state().place) !== c.place) {
        await page.evaluate(id => window.__gloam.go(id), c.place);
        await page.waitForFunction(id => window.__gloam?.ready() && window.__gloam.state().place === id, c.place, { timeout: 180000 });
      }
      await page.evaluate(() => window.__gloam.close());
    }
    if (c.compile && !unpatched) {
      const made = await page.evaluate(async () => {
        const base = '/lab/gloam-downs/ink/webgl/';
        const { createResources } = await import(base + 'resources.mjs');
        const { splatShaderSources, pixelShaderSources } = await import(base + 'shaders.mjs');
        const { waterBackgroundShader } = await import(base + 'water-optics.mjs');
        const gl = document.createElement('canvas').getContext('webgl2'), r = createResources(gl), names = [];
        const make = (name, vs, fs) => {
          const p = r.program(vs, fs);
          gl.useProgram(p.p);
          // every array setter, with values of the right length: it must not give a GL error (no draw here: the samplers of
          // these programs are not set up, and the twelve cases above draw the programs that the places use)
          const values = {};
          for (let i = 0, n = gl.getProgramParameter(p.p, gl.ACTIVE_UNIFORMS); i < n; i++) {
            const u = gl.getActiveUniform(p.p, i), per = { [gl.FLOAT_VEC2]: 2, [gl.FLOAT_VEC3]: 3, [gl.FLOAT_VEC4]: 4, [gl.FLOAT_MAT4]: 16, [gl.FLOAT_MAT3]: 9 }[u.type] || 1;
            if (!/sampler/i.test(String(u.type)) && u.size > 1) values[u.name.replace(/\[0\]$/, '')] = new Float32Array(per * u.size).fill(0.5);
          }
          p.set(values);
          const e = gl.getError();
          if (e) throw new Error(`${name}: GL error ${e}`);
          names.push(name);
        };
        for (const water of [false, true]) {
          const s = splatShaderSources(false, undefined, water ? { water: true } : {});
          make(`splat${water ? ' water' : ''}`, s.vertex, s.fragment);
          const x = pixelShaderSources(PixelLook, { water });
          for (const k of ['POST_FS', 'KEY_FS', 'CLEAN_FS', 'DAMP_FS', 'COPY_FS']) make(`${k}${water ? ' water' : ''}`, x.POST_VS, x[k]);
          make(`sprites${water ? ' water' : ''}`, x.SPR_VS, x.SPR_FS);
        }
        make('water background', pixelShaderSources(PixelLook).POST_VS, waterBackgroundShader);
        r.dispose();
        return names;
      });
      console.log(`made ${made.length} programs: ${made.join(', ')}`);
    }
    const a = await picture(page, TIME), b = await picture(page, TIME);
    const pa = Buffer.from(a.b64, 'base64'), again = compare(pa, Buffer.from(b.b64, 'base64'));
    const programs = await page.evaluate(() => window.__uniformPrograms);
    return { a, pa, again, programs, errors };
  } catch (error) {
    return { error: `${error.message.split('\n')[0]}${errors.length ? ' (' + errors.join('; ').slice(0, 300) + ')' : ''}`, errors };
  } finally {
    await ctx.close();
  }
}

// the frame against a reference picture: fail over 0.1% of the pixels, or over 1 level in one channel
function against(c, ref, pa, what) {
  const r = compare(ref, pa);
  const note = r.size ? 'size differs' : `${r.diff} px differ (${(r.share * 100).toFixed(3)}%), worst ${r.worst}`;
  if (r.size || (r.diff && (r.share > 0.001 || r.worst > 1))) fail(`${c.name}: the picture differs from ${what}: ${note}`);
  return note;
}

const browser = await chromium.launch({ executablePath, args: GL });
const table = [];
try {
  for (const c of CASES) {
    const now = await shoot(browser, c, false);
    if (now.error) { fail(`${c.name}: ${now.error}`); continue; }
    const { a, pa, programs } = now;
    if (now.again.diff) fail(`${c.name}: two draws of the same frame differ in ${now.again.diff} pixels`);
    if (PICS && !c.compile) {
      fs.writeFileSync(path.join(PICS, `${c.name}.png`), Buffer.from(a.png.split(',')[1], 'base64'));
      fs.writeFileSync(path.join(PICS, `${c.name}.rgba.gz`), zlib.gzipSync(Buffer.concat([Buffer.from(JSON.stringify({ w: a.w, h: a.h }) + '\n'), pa])));
    }
    let picNote = '-';
    if (c.compile) {
      // all-programs draws the Gaol again: explore-gaol compares that picture
    } else if (REF) {
      const file = path.join(REF, `${c.name}.rgba.gz`);
      if (!fs.existsSync(file)) fail(`${c.name}: no reference picture ${file}`);
      else {
        const raw = zlib.gunzipSync(fs.readFileSync(file));
        picNote = 'ref: ' + against(c, raw.subarray(raw.indexOf(10) + 1), pa, 'the reference ' + file);
      }
    } else if (!process.env.NOREF) {
      // the same case on the renderer without the patch, in the same browser
      const old = await shoot(browser, c, true);
      if (old.error) fail(`${c.name}: the pass without the patch failed: ${old.error}`);
      else {
        if (old.again.diff) fail(`${c.name}: without the patch, two draws of the same frame differ in ${old.again.diff} pixels`);
        if (old.programs.some(p => p.blocks)) fail(`${c.name}: the pass without the patch has uniform blocks: the reference is not the original renderer`);
        for (const e of old.errors) fail(`${c.name}: page error without the patch: ${e}`);
        picNote = 'unpatched: ' + against(c, old.pa, pa, 'the renderer without the patch');
      }
    }
    let worst = 0;
    programs.forEach((p, i) => {
      if (!p.linked) fail(`${c.name}: program ${i} did not link: ${p.log}`);
      worst = Math.max(worst, p.vertex, p.fragment);
      if (p.vertex > LIMIT || p.fragment > LIMIT)
        fail(`${c.name}: program ${i} uses ${p.vertex} vertex and ${p.fragment} fragment default-block vectors (limit ${LIMIT}): ${p.top.join(' ')}`);
    });
    for (const e of now.errors) fail(`${c.name}: page error: ${e}`);
    const row = { case: c.name, art: `${a.w}x${a.h}`, programs: programs.length, blocks: programs.reduce((s, p) => s + p.blocks, 0),
      counts: programs.map(p => `${p.vertex}/${p.fragment}`).join(' '), worst, picture: picNote };
    table.push(row);
    console.log((worst > LIMIT ? 'OVER ' : 'ok   ') + JSON.stringify(row));
  }
} finally {
  await browser.close();
}
console.log(failures.length ? `\n${failures.length} failures` : `\nall ${table.length} cases pass (limit ${LIMIT} vectors in each stage)`);
process.exit(failures.length ? 1 : 0);
