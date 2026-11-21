import { createResources } from './resources.mjs';
import { createTargets } from './targets.mjs';
import { createSplatPipeline } from './pipeline.mjs';
import { pixelShaderSources } from './shaders.mjs';
import { createDepthSorter, makeCamera } from './view.mjs';
import { waterBackgroundShader } from './water-optics.mjs';

const zero = new Float32Array(4);
const empty = new Float32Array(0);
const rgb = hex => [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255];

function palette(values, max = 64) {
  const result = new Float32Array(max * 3);
  for (let i = 0; i < Math.min(max, values.length); i++) result.set(rgb(values[i]), i * 3);
  return result;
}

function viewProjection(projection, view) {
  const matrix = new Float32Array(16);
  for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) {
    let v = 0;
    for (let k = 0; k < 4; k++) v += projection[k * 4 + row] * view[col * 4 + k];
    matrix[col * 4 + row] = v;
  }
  return matrix;
}

function inverseView(view, eye) {
  return new Float32Array([
    view[0], view[4], view[8], 0, view[1], view[5], view[9], 0,
    view[2], view[6], view[10], 0, ...eye, 1
  ]);
}

function materialData(pixel, world) {
  const data = pixel.gpu(world);
  const lens = Float32Array.from(data.lens);
  const colors = Array.from(lens, (v, i) => Array.from(
    data.ramps.slice(i * 8, i * 8 + (Math.round(v) & 15)), Math.round));
  const group = colors.map((_, i) => i);
  const root = i => {
    while (group[i] !== i) i = group[i];
    return i;
  };
  for (let a = 0; a < lens.length; a++) for (let b = a + 1; b < lens.length; b++) {
    let shared = 0;
    for (const c of colors[a]) if (colors[b].includes(c)) shared++;
    if (shared >= 2) group[root(b)] = root(a);
  }
  lens.forEach((v, i) => { lens[i] = (Math.round(v) & 31) + root(i) * 32; });
  return { ...data, lens };
}

function simpleResolve(source) {
  return source
    .replaceAll('u_pixOn > 0.5', 'false')
    .replaceAll('u_ao > 0.0', 'false')
    .replaceAll('u_toneOn > 0.5', 'false')
    .replaceAll('u_grade > 0.5', 'false')
    .replace('if (u_gk <= 0.0) return c;', 'return c;');
}

function sameValues(a, b) {
  return a?.length === b.length && b.every((value, i) => value === a[i]);
}

function createBackend(gl, toolkit, specialize, reuseOrder) {
  const resources = createResources(gl);
  const sampleCoverage = toolkit.KIT?.procedural?.sampleCoverage;
  let pipeline;
  try {
    const sources = pixelShaderSources(toolkit.PixelLook);
    const program = source => resources.program(sources.POST_VS, source);
    const post = program(sources.POST_FS), clean = program(sources.CLEAN_FS);
    // Rebirth hosts can opt into geometry specialization through the lower
    // level pipeline. The canvas path specializes its own fullscreen resolve.
    pipeline = createSplatPipeline(gl, { specialize: false, sampleCoverage });
    const emptyVao = resources.allocate('VertexArray');
    const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const { target, table, textureUnit } = createTargets(gl, resources);
    const dryGeometry = target(2), dryContours = target(2), owner = target(), key = target(1, { integer: true });
    let wetGeometry, wetContours, wetSources, wetPost, wetBackground, wetSprites, waterTexture, packedWater;
    let lastWater, lastWaterTime, waterWidth = 0, waterHeight = 0;
    const cleaned = target(), finished = target(), history = [target(), target()];
    const data = table(2048, 0, maxSize), bones = table(768, 4, maxSize);
    const fine = table(1536, 7, maxSize), pattern = table(2048, 10, maxSize);
    const toneStops = resources.texture(), toneRanks = resources.texture();
    const sort = createDepthSorter();
    let simple, simpleUnavailable = false, keyProgram, damp, copy, spriteProgram, spriteLayer, spriteTable, anchors;
    let lastWorld, lastData, lastCount, lastOutput, fineValues, materials, anchorCount = 0;
    let packed = empty, historyIndex = 0, historyValid = false, previousVP;
    let toneKey, tone, sorted;

    function orderFor(world, frame, camera, time, isNew) {
      if (frame.order) {
        pipeline.setOrder(frame.order);
        sorted = null;
        return;
      }
      const moving = world.moving ?? [], back = world.back ?? [];
      const canReuse = reuseOrder && !world.anim?.bones?.length;
      const clock = moving.length ? time : 0;
      if (canReuse && !isNew && frame.changedRows?.length === 0 && sorted?.clock === clock &&
          sameValues(sorted.view, camera.view) && sameValues(sorted.moving, moving) && sameValues(sorted.back, back)) return;
      pipeline.setOrder(sort(world, camera.view, time));
      sorted = canReuse ? { view: camera.view, moving: Int32Array.from(moving), back: Int32Array.from(back), clock } : null;
    }

    function resolveProgram(patterned, glass, ao, definition, grade) {
      if (!specialize || simpleUnavailable || patterned || glass || ao || definition || grade) return post;
      if (!simple) {
        try {
          simple = program(simpleResolve(sources.POST_FS));
        } catch (error) {
          if (gl.isContextLost()) throw error;
          simpleUnavailable = true;
          return post;
        }
      }
      return simple;
    }

    function fullscreen(shader, destination, width, height, values) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, destination);
      gl.viewport(0, 0, width, height);
      gl.bindVertexArray(emptyVao);
      gl.useProgram(shader.p);
      shader.set(values);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function prepareTone(definition) {
      const next = JSON.stringify(definition);
      if (toneKey !== next) {
        const prepared = definition ? toolkit.PixelLook.prepareTone(definition,
          toolkit.KIT?.procedural?.materials?.blueNoise
            ? ({ seed }) => toolkit.KIT.procedural.materials.blueNoise({ seed })
            : undefined) : null;
        if (prepared) {
          const stops = new Float32Array(48 * 4);
          prepared.stops.forEach(([at, hex], i) => stops.set([...rgb(parseInt(hex.slice(1), 16)), at], i * 4));
          textureUnit(12, toneStops);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 48, 1, 0, gl.RGBA, gl.FLOAT, stops);
          textureUnit(14, toneRanks);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, prepared.width, prepared.height, 0, gl.RED, gl.FLOAT, prepared.thresholds);
        }
        toneKey = next;
        tone = prepared;
      }
      if (tone) {
        textureUnit(12, toneStops);
        textureUnit(14, toneRanks);
        return { u_toneOn: 1, u_toneCut: tone.cutoff, u_toneAmt: tone.amount, u_toneN: tone.stops.length,
          u_toneStops: 12, u_toneTh: 14 };
      }
      return { u_toneOn: 0 };
    }

    function uploadBones(values) {
      if (!values) {
        bones.bind();
        return;
      }
      if (packed.length !== values.length) packed = new Float32Array(values.length);
      for (let b = 0; b < values.length; b += 12) for (let row = 0; row < 3; row++) {
        const from = b + row * 3, to = b + row * 4;
        packed[to] = values[from];
        packed[to + 1] = values[from + 1];
        packed[to + 2] = values[from + 2];
        packed[to + 3] = values[b + 9 + row];
      }
      bones.upload(packed);
    }

    function updateSprites(world, pixel) {
      anchorCount = 0;
      const descriptions = pixel.edgeTable?.(world);
      if (!descriptions?.any || !pixel.anchors) return;
      // The toolkit caches anchors on its input. Keep that cache private to
      // this upload so a replaced material table can rebuild the sprite list.
      const { count, data, detail, pix, pats } = world;
      const points = pixel.anchors({ count, data, detail, pix, pats });
      if (!points?.n) return;
      spriteProgram ??= resources.program(sources.SPR_VS, sources.SPR_FS);
      spriteLayer ??= target(1, { depth: true });
      spriteTable ??= resources.texture();
      anchors ??= table(768, 14, maxSize);
      const sprites = new Float32Array(12 * 96 * 4);
      for (let i = 0; i < 32; i++) sprites.set(descriptions.per.subarray(i * 8, i * 8 + 8), i * 48);
      descriptions.sprites.forEach((sprite, i) => {
        const start = (32 + i) * 48;
        sprites.set([sprite.w, sprite.h, sprite.ax, sprite.sink], start);
        sprites.set(sprite.cells.slice(0, 44), start + 4);
      });
      textureUnit(12, spriteTable);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 12, 96, 0, gl.RGBA, gl.FLOAT, sprites);
      anchors.upload(points.data);
      anchorCount = points.n;
    }

    function waterUniforms(scene, camera, time) {
      if (!scene) return null;
      waterTexture ??= resources.texture();
      textureUnit(3, waterTexture);
      if (scene !== lastWater || !packedWater) {
        const { width, height, data, uniforms } = scene.pack();
        if (width === waterWidth && height === waterHeight)
          gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.FLOAT, data);
        else {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data);
          waterWidth = width;
          waterHeight = height;
        }
        packedWater = uniforms;
      }
      return { ...packedWater, u_waterData: 3, u_waterView: camera.view, u_waterEye: camera.eye,
        u_waterCamera: [camera.tangent * camera.aspect, camera.tangent, +camera.ortho], u_waterTime: time };
    }

    function drawGeometry(shader, buffer, width, height, options, water) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, buffer.framebuffer);
      gl.viewport(0, 0, width, height);
      if (options.u_idx) {
        gl.disable(gl.BLEND);
        gl.clearBufferfv(gl.COLOR, 0, zero);
      } else {
        if (water) {
          wetBackground ??= program(waterBackgroundShader);
          gl.disable(gl.BLEND);
          fullscreen(wetBackground, buffer.framebuffer, width, height, { ...water,
            u_waterViewport: [width, height], u_waterBackground: options.background.slice(0, 3) });
        } else {
          gl.clearBufferfv(gl.COLOR, 0, options.background);
          gl.clearBufferfv(gl.COLOR, 1, [1, 0, 0, 1]);
        }
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      }
      gl.useProgram(shader.p);
      shader.set({
        ...options,
        u_viewport: [width, height],
        u_focal: height / 2 / options.tangent
      });
      pipeline.draw();
    }

    function drawSprites(camera, world, width, height, time, pixelOutline, water, pal) {
      spriteLayer.resize(width, height);
      data.bind();
      textureUnit(13, null);
      textureUnit(12, spriteTable);
      anchors.bind();
      gl.bindFramebuffer(gl.FRAMEBUFFER, spriteLayer.framebuffer);
      gl.viewport(0, 0, width, height);
      gl.clearBufferfv(gl.COLOR, 0, zero);
      gl.clearBufferfv(gl.DEPTH, 0, [1]);
      gl.disable(gl.BLEND);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LESS);
      const sprites = water ? (wetSprites ??= resources.program(wetSources.SPR_VS, wetSources.SPR_FS)) : spriteProgram;
      gl.useProgram(sprites.p);
      sprites.set({
        u_anc: 14, u_sprTex: 12, u_dat: 0, u_depth: 2, u_idxTex: 9, u_pixTex: 10,
        u_view: camera.view, u_proj: camera.projection, u_vp: [width, height],
        u_rng: camera.depthRange, u_time: time, u_keep: toolkit.KIT.pixel.anchorKeep(world, camera.footprint),
        u_ortho: +camera.ortho, u_rmpN4: materials.gpu.lens, u_pview: camera.view, u_peye: camera.eye,
        u_tanF: camera.tangent, u_asp: camera.aspect, u_portho: +camera.ortho,
        u_eGap: (pixelOutline?.gap ?? 0.3) / (2 * camera.radius), u_tol: 3 * camera.footprint + 0.02,
        ...(water ? { ...water, u_waterSpritePalette: pal, u_rmp4: materials.gpu.ramps } : {})
      });
      gl.bindVertexArray(emptyVao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, anchorCount);
      gl.disable(gl.DEPTH_TEST);
      textureUnit(13, spriteLayer.textures[0]);
    }

    function render(world, frame, width, height, output) {
      const { raw = false, outline = true, dither = 0.35, scale = 1 } = frame;
      const look = world.look ?? {};
      const waterScene = frame.water !== false && world.water?.count ? world.water : null;
      if (waterScene) {
        wetGeometry ??= target(3);
        wetContours ??= target(3);
        wetSources ??= pixelShaderSources(toolkit.PixelLook, { water: true });
      }
      const geometry = waterScene ? wetGeometry : dryGeometry, contours = waterScene ? wetContours : dryContours;
      const isNew = world !== lastWorld || world.data !== lastData || world.count !== lastCount;
      const pixel = toolkit.KIT?.pixel;
      const patterned = !raw && !!(look.pixel && world.pix && pixel?.gpu);
      const colored = !raw && !patterned && (frame.colored ?? true);
      const cleaning = !raw && (frame.clean ?? !!look.clean);
      const damping = !raw && !colored && !!look.pixel && frame.damp !== false;
      const samples = colored ? 2 : 1, rw = width * samples, rh = height * samples;
      if (rw > maxSize || rh > maxSize ||
          rw > viewportLimit[0] || rh > viewportLimit[1])
        throw new RangeError('Ink Studio frame exceeds the WebGL viewport or texture size limit');
      if (!output) {
        if (gl.canvas.width !== width) gl.canvas.width = width;
        if (gl.canvas.height !== height) gl.canvas.height = height;
      }
      const resized = width !== finished.width || height !== finished.height;
      if (isNew || resized || output !== lastOutput || !damping || waterScene !== lastWater ||
          (waterScene && frame.time !== lastWaterTime)) historyValid = false;
      geometry.resize(rw, rh);
      contours.resize(colored ? width : 1, colored ? height : 1);
      owner.resize(patterned ? width : 1, patterned ? height : 1);
      key.resize(patterned ? width : 1, patterned ? height : 1);
      if (cleaning) cleaned.resize(width, height);
      if (damping) {
        finished.resize(width, height);
        history.forEach(buffer => buffer.resize(width, height));
      }

      const camera = makeCamera(world, frame, width, height);
      const t = frame.time ?? 0;
      const water = waterUniforms(waterScene, camera, t);
      const time = frame.stepAnimation !== false && look.pixel ? Math.floor(t * 10) / 10 : t;
      const hasFine = !raw && !!world.fine;
      const pal = palette(world.pal);
      const palCount = Math.min(world.pal.length, 64);
      const fog = world.fog ?? {};
      const dirty = isNew ? undefined : frame.changedRows;
      data.upload(world.data, world.count * 16, dirty);
      if (hasFine && (isNew || fineValues !== world.fine)) {
        fine.upload(world.fine, world.count * 12);
        fineValues = world.fine;
      } else fine.bind();
      uploadBones(world.anim?.bones);
      orderFor(world, frame, camera, time, isNew);
      if (patterned) {
        if (isNew || materials?.world !== world || materials.values !== world.pix ||
            materials.ramps !== world.ramps || materials.rampOff !== world.rampOff || materials.patterns !== world.pats) {
          pattern.upload(world.pix, world.count * 8);
          const gpu = materialData(pixel, world);
          updateSprites(world, pixel);
          materials = { world, values: world.pix, ramps: world.ramps, rampOff: world.rampOff, patterns: world.pats, gpu };
        } else pattern.bind();
      }

      gl.disable(gl.SCISSOR_TEST);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.STENCIL_TEST);
      gl.colorMask(true, true, true, true);
      gl.depthMask(true);
      gl.blendEquation(gl.FUNC_ADD);
      const shader = pipeline.programFor(water ? { water: true } : undefined);
      gl.useProgram(shader.p);
      const growth = world.grow ?? {};
      shader.set({
        u_data: 0, u_bones: 4, u_fine: 7, u_fineOn: +hasFine, u_fpal: pal, u_view: camera.view,
        u_proj: camera.projection, u_time: time, u_scale: scale, u_ortho: +camera.ortho,
        u_sampleWithdrawal: sampleCoverage?.amount(frame.sampleWithdrawal ?? world.sampleWithdrawal ?? 0) ?? 0,
        u_born: [frame.bornAt ?? 0, growth.rate ?? 1, growth.fade ?? 0.5, growth.loop ?? 0],
        u_crisp: +!raw, u_dilate: raw ? 0.3 : 0.15, u_near: camera.clipNear,
        u_fog: rgb(world.pal[fog.c ?? 0] ?? 0),
        u_fogp: [fog.start ?? 1, fog.max ?? 0, ...camera.depthRange], ...water
      });
      const background = [...rgb(world.pal[0]), 1], tangent = camera.tangent;
      drawGeometry(shader, geometry, rw, rh, { u_idx: 0, u_snap: +(!raw && !colored), u_hard: 0, background, tangent }, water);
      if (colored)
        drawGeometry(shader, contours, width, height, { u_idx: 0, u_snap: 1, u_hard: 0, background, tangent }, water);
      if (patterned)
        drawGeometry(shader, owner, width, height, { u_idx: 1, u_snap: 1, u_hard: 0, tangent });
      gl.disable(gl.BLEND);
      textureUnit(1, geometry.textures[0]);
      textureUnit(2, geometry.textures[1]);
      textureUnit(5, contours.textures[0]);
      textureUnit(6, contours.textures[1]);
      textureUnit(9, owner.textures[0]);
      const pixelOutline = look.outline === true ? {} : look.outline;
      const mat = materials?.gpu;
      const patternedUniforms = patterned ? {
        u_idxTex: 9, u_pixTex: 10, u_dat: 0, u_depth: 2, u_tanF: tangent,
        u_portho: +camera.ortho, u_asp: camera.aspect, u_pview: camera.view, u_peye: camera.eye,
        u_fpG: camera.footprint, u_ptime: time, u_shape: +(frame.lightShape !== false),
        u_ol: +!!pixelOutline, u_olK: pixelOutline?.k ?? 2,
        u_olEps: pixelOutline ? (pixelOutline.eps ?? 0.6) / (world.detail || 12) / (2 * camera.radius) : 0,
        u_olGap: pixelOutline ? (pixelOutline.gap ?? 0.3) / (2 * camera.radius) : 1,
        u_patK4: mat.kinds, u_patP: mat.params, u_rmp4: mat.ramps, u_rmpN4: mat.lens, u_detail: world.detail || 12
      } : {};
      if (patterned) {
        keyProgram ??= program(sources.KEY_FS);
        textureUnit(15, null);
        pattern.bind();
        fullscreen(keyProgram, key.framebuffer, width, height, { u_pixOn: 1, ...patternedUniforms });
      }
      textureUnit(15, key.textures[0]);
      const sprites = patterned && anchorCount > 0 && frame.edges !== false;
      if (sprites) drawSprites(camera, world, width, height, time, pixelOutline, water, pal);
      const lines = outline && look.lines;
      const definition = raw || frame.tone === false ? null : (frame.tone ?? look.tone);
      const grade = world.anim?.grade;
      const glass = raw ? null : world.glass;
      const glassUniforms = {};
      if (glass) {
        const gaps = new Float32Array(24 * 4), count = Math.min(24, glass.gaps?.length ?? 0);
        if (count) for (let i = 0; i < count; i++) gaps.set(glass.gaps[i], i * 4);
        Object.assign(glassUniforms, {
          u_gview: camera.view, u_geye: camera.eye, u_gd: glass.dir,
          u_gw: [...glass.at, glass.r], u_gcam: [tangent * camera.aspect, tangent, ...camera.depthRange],
          u_gortho: +camera.ortho, u_gtime: t, u_gc: palette(glass.cols.map(c => world.pal[c]), 6),
          u_gm: +(glass.mode === 'gaps'), u_gq: glass.steps ?? 0,
          u_gh: gaps, u_ghn: count, u_gfl: glass.floor ?? -50
        });
      }
      const destination = damping ? finished.framebuffer : output;
      const resolve = water ? (wetPost ??= program(wetSources.POST_FS)) :
        resolveProgram(patterned, glass, world.ao, definition, grade);
      if (water) textureUnit(11, (colored ? contours : geometry).textures[2]);
      fullscreen(resolve, cleaning ? cleaned.framebuffer : destination, width, height, {
        ...patternedUniforms, ...glassUniforms, ...prepareTone(definition), ...water, u_waterMask: 11,
        u_scene: 1, u_depth: 2, u_crispScene: 5, u_crispDepth: 6, u_keyTex: 15,
        u_pixOn: +patterned, u_keyOn: +patterned, u_sprOn: +sprites,
        u_sprLayer: 13, u_markA: +cleaning, u_pal: pal, u_n: palCount, u_luma: 0,
        u_bypass: +raw, u_colored: +colored, u_dither: dither * 0.3 * (world.dither ?? 1),
        u_line: rgb(world.pal[world.outline?.c ?? 0] ?? 0),
        u_edge: outline ? (world.outline?.edge ?? 0) / (2 * camera.radius) : 0,
        u_lines: +!!lines, u_lineGap: lines ? (lines.gap ?? 0.3) / (2 * camera.radius) : 1,
        u_lineK: lines ? (lines.k ?? 0.55) : 1, u_lineLit: lines ? (lines.lit ?? 1.15) : 1,
        u_refract: world.refract ?? 6, u_ao: world.ao ? (world.ao.k ?? 0.5) : 0,
        u_aor: (world.ao?.range ?? 0.4) / (2 * camera.radius),
        u_gk: glass ? (glass.k || 0.14) : 0, u_bars: Math.min(0.45, world.anim?.bars ?? 0),
        u_grade: +!!grade, ...(grade ? { u_out: grade, u_outl: grade } : {})
      });
      if (cleaning) {
        textureUnit(8, cleaned.textures[0]);
        textureUnit(6, colored ? contours.textures[1] : geometry.textures[1]);
        fullscreen(clean, destination, width, height, {
          u_look: 8, u_dep: 6, u_keep: look.clean?.keep ?? 0.3,
          u_lineClean: +(frame.lineClean !== false && !!look.pixel)
        });
      }
      if (damping) {
        damp ??= program(sources.DAMP_FS);
        copy ??= program(sources.COPY_FS);
        const next = 1 - historyIndex, vp = viewProjection(camera.projection, camera.view);
        const still = previousVP && vp.every((v, i) => Math.abs(v - previousVP[i]) < 1e-6);
        textureUnit(8, finished.textures[0]);
        textureUnit(11, history[historyIndex].textures[0]);
        textureUnit(6, geometry.textures[1]);
        fullscreen(damp, history[next].framebuffer, width, height, {
          u_cur: 8, u_hist: 11, u_dep: 6, u_pal: pal, u_n: palCount,
          u_have: +(historyValid && !!still), u_iview: inverseView(camera.view, camera.eye),
          u_pvp: previousVP ?? vp, u_cam: [tangent, camera.aspect, +camera.ortho, 0],
          u_rng: camera.depthRange
        });
        textureUnit(8, history[next].textures[0]);
        fullscreen(copy, output, width, height, { u_src: 8 });
        historyIndex = next;
        historyValid = true;
        previousVP = vp;
      }
      gl.activeTexture(gl.TEXTURE0);
      lastWorld = world;
      lastData = world.data;
      lastCount = world.count;
      lastOutput = output;
      lastWater = waterScene;
      lastWaterTime = frame.time;
    }

    const viewportLimit = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
    return { render, dispose() { pipeline.dispose(); resources.dispose(); } };
  } catch (error) {
    pipeline?.dispose();
    resources.dispose();
    throw error;
  }
}

export function createRenderer(canvas, { toolkit, specialize = true, reuseOrder = true, contextAttributes } = {}) {
  if (typeof canvas?.getContext !== 'function')
    throw new TypeError('Ink Studio needs a canvas or OffscreenCanvas');
  if (typeof toolkit?.PixelLook?.glsl !== 'string')
    throw new TypeError('Pass the Ink Studio toolkit, including PixelLook, to createRenderer');
  const gl = canvas.getContext('webgl2', {
    ...contextAttributes, alpha: false, antialias: false, depth: false, stencil: false
  });
  if (!gl) throw new Error('Ink Studio GPU rendering requires WebGL 2');
  let backend = createBackend(gl, toolkit, specialize, reuseOrder);
  let disposed = false;
  const lose = event => {
    event.preventDefault();
    // The restored context cannot delete or reuse the old resources.
    backend = null;
  };
  canvas.addEventListener?.('webglcontextlost', lose);
  return {
    render(world, frame = {}) {
      if (disposed) throw new Error('The Ink Studio renderer has been disposed');
      if (gl.isContextLost()) throw new Error('The Ink Studio WebGL context is lost');
      if (!(world?.data instanceof Float32Array) || !Number.isSafeInteger(world.count) ||
          world.count < 0 || world.count * 16 > world.data.length || !world.pal?.length)
        throw new TypeError('Render expects a world with packed splats, a count, and a palette');
      if (world.fine && world.fine.length < world.count * 12 || world.pix && world.pix.length < world.count * 8)
        throw new RangeError('Ink Studio material data is shorter than the splat count');
      if (frame.order !== undefined &&
          (!(frame.order instanceof Int32Array) || frame.order.length !== world.count ||
           frame.order.some(index => index < 0 || index >= world.count)))
        throw new TypeError('Draw order must contain valid Int32 splat indices');
      if (frame.changedRows !== undefined &&
          (!Array.isArray(frame.changedRows) || frame.changedRows.some(row =>
            !Number.isInteger(row) || row < 0 || row >= Math.max(1, Math.ceil(world.count / 512)))))
        throw new RangeError('changedRows must contain valid 512-splat row indices');
      const target = frame.target;
      const width = frame.width ?? target?.width ?? canvas.width;
      const height = frame.height ?? target?.height ?? canvas.height;
      const output = target?.framebuffer ?? null;
      if (target && (width !== target.width || height !== target.height || !output || !gl.isFramebuffer(output)))
        throw new TypeError('Draw target must match the frame size and use the renderer WebGL context');
      if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1)
        throw new RangeError('Ink Studio frame width and height must be positive integers');
      if (![frame.time ?? 0, frame.bornAt ?? 0, frame.scale ?? 1, frame.dither ?? 0.35].every(Number.isFinite))
        throw new RangeError('Ink Studio frame parameters must be finite');
      backend ??= createBackend(gl, toolkit, specialize, reuseOrder);
      backend.render(world, frame, width, height, output);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      backend?.dispose();
      canvas.removeEventListener?.('webglcontextlost', lose);
    }
  };
}
