/* Living world for BREAKTHROUGH. Presentation only: it never touches the sim RNG. */
(() => {
  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const STOPS = [
    { t: 0, skyTop: [207, 230, 223], skyMid: [143, 184, 176], skyHor: [243, 222, 168], sun: [242, 197, 107], far: [156, 186, 170], mid: [96, 140, 112], hill: [126, 158, 98], hillLit: [196, 176, 122], forest: [47, 104, 66], forestLit: [132, 168, 96], water: [78, 156, 150], waterDeep: [46, 112, 112], field: [112, 150, 78], dry: [196, 164, 110], city: [245, 236, 214], roof: [184, 148, 92], haze: [186, 164, 132] },
    { t: 0.34, skyTop: [214, 224, 208], skyMid: [164, 190, 176], skyHor: [232, 208, 156], sun: [232, 184, 94], far: [142, 170, 152], mid: [90, 128, 104], hill: [138, 156, 102], hillLit: [188, 168, 116], forest: [70, 114, 74], forestLit: [122, 150, 88], water: [96, 150, 142], waterDeep: [62, 112, 108], field: [132, 148, 78], dry: [188, 156, 104], city: [236, 224, 198], roof: [168, 132, 86], haze: [176, 148, 112] },
    { t: 0.62, skyTop: [206, 190, 164], skyMid: [186, 158, 124], skyHor: [214, 170, 122], sun: [214, 142, 74], far: [154, 138, 118], mid: [122, 106, 86], hill: [168, 142, 102], hillLit: [176, 146, 98], forest: [108, 104, 72], forestLit: [142, 132, 86], water: [132, 142, 112], waterDeep: [96, 102, 82], field: [154, 138, 78], dry: [172, 136, 88], city: [214, 196, 168], roof: [142, 108, 74], haze: [164, 124, 88] },
    { t: 1, skyTop: [176, 142, 118], skyMid: [154, 112, 88], skyHor: [132, 86, 62], sun: [196, 108, 62], far: [132, 108, 96], mid: [102, 78, 66], hill: [132, 102, 74], hillLit: [154, 116, 78], forest: [92, 78, 60], forestLit: [122, 102, 72], water: [122, 108, 90], waterDeep: [86, 74, 62], field: [148, 118, 70], dry: [154, 112, 72], city: [196, 170, 142], roof: [122, 86, 62], haze: [138, 96, 68] }
  ];

  let titleCanvas, worldCanvas, endCanvas, grain;
  let worldLook = null;
  let endLook = null;
  let started = false;
  let dirty = true;
  let last = 0;
  let pulseUntil = 0;
  const t0 = performance.now();

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function mix(a, b, u) {
    return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * u));
  }
  function rgb(c, a) {
    return a == null ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  }
  function sample(stress) {
    const t = clamp(stress, 0, 1);
    let i = 0;
    while (i < STOPS.length - 2 && t > STOPS[i + 1].t) i++;
    const a = STOPS[i];
    const b = STOPS[i + 1];
    const u = (t - a.t) / ((b.t - a.t) || 1);
    const out = {};
    for (const k of Object.keys(a)) {
      if (k === "t") continue;
      out[k] = mix(a[k], b[k], u);
    }
    return out;
  }
  function hash(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
  function makeGrain() {
    const c = document.createElement("canvas");
    c.width = 140;
    c.height = 140;
    const g = c.getContext("2d");
    const img = g.createImageData(140, 140);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = 150 + Math.random() * 90;
      img.data[i] = n;
      img.data[i + 1] = n - 4;
      img.data[i + 2] = n - 12;
      img.data[i + 3] = 28 + Math.random() * 36;
    }
    g.putImageData(img, 0, 0);
    grain = c;
  }
  function fit(canvas) {
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return null;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(2, Math.floor(rect.width * dpr));
    const h = Math.max(2, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return { w, h };
  }
  function visible(canvas) {
    return !!(canvas && canvas.offsetParent !== null);
  }
  function frozen() {
    return reduceQuery.matches || document.documentElement.classList.contains("fast");
  }

  function ridge(ctx, w, h, yBase, amp, color, seed) {
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, yBase);
    const n = 8;
    for (let i = 0; i <= n; i++) {
      const x = (w * i) / n;
      const peak = yBase - h * amp * (0.35 + hash(seed + i) * 0.85);
      if (i === 0) ctx.lineTo(x, peak);
      else {
        const px = (w * (i - 1)) / n;
        const py = yBase - h * amp * (0.35 + hash(seed + i - 1) * 0.85);
        ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + peak) / 2);
      }
    }
    ctx.lineTo(w, yBase);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function blob(ctx, x, y, rx, ry, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function tree(ctx, x, y, s, dark, lit, sway) {
    blob(ctx, x + s * 0.08, y + s * 0.08, s * 0.42, s * 0.12, "rgba(40,36,24,.16)");
    blob(ctx, x, y - s * 0.34 + sway, s * 0.46, s * 0.62, dark);
    blob(ctx, x - s * 0.16, y - s * 0.62 + sway, s * 0.3, s * 0.36, lit);
    blob(ctx, x - s * 0.12, y - s * 0.78 + sway, s * 0.12, s * 0.07, "rgba(255,248,230,.28)");
  }

  function cloud(ctx, x, y, s, a) {
    ctx.fillStyle = `rgba(255,250,242,${a})`;
    blob(ctx, x, y, 28 * s, 12 * s, `rgba(255,250,242,${a})`);
    blob(ctx, x + 22 * s, y + 2 * s, 20 * s, 10 * s, `rgba(255,250,242,${a * 0.95})`);
    blob(ctx, x - 20 * s, y + 3 * s, 16 * s, 9 * s, `rgba(255,250,242,${a * 0.9})`);
  }

  function turbine(ctx, x, y, hgt, angle) {
    ctx.strokeStyle = "rgba(247,241,228,.92)";
    ctx.lineWidth = Math.max(1.5, hgt * 0.035);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - hgt);
    ctx.stroke();
    ctx.save();
    ctx.translate(x, y - hgt);
    ctx.rotate(angle);
    ctx.fillStyle = "rgba(247,241,228,.95)";
    for (let i = 0; i < 3; i++) {
      ctx.rotate((Math.PI * 2) / 3);
      ctx.beginPath();
      ctx.ellipse(0, -hgt * 0.42, Math.max(1.4, hgt * 0.045), hgt * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    blob(ctx, x, y - hgt, hgt * 0.07, hgt * 0.07, "rgb(226,168,78)");
  }

  function paint(ctx, w, h, look, time) {
    const p = sample(look.stress);
    const eco = clamp(look.eco ?? 0.5, 0, 1);
    const stress = clamp(look.stress ?? 0.5, 0, 1);
    const prosper = clamp(look.prosper ?? 0.5, 0, 1);

    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, rgb(p.skyTop));
    sky.addColorStop(0.46, rgb(p.skyMid));
    sky.addColorStop(0.78, rgb(p.skyHor));
    sky.addColorStop(1, rgb(mix(p.hill, p.dry, stress)));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    const sunX = w * (0.74 + (look.ending === "The Fractured Century" ? 0.08 : 0));
    const sunY = h * (0.16 + stress * 0.1);
    const sunR = h * (0.34 - stress * 0.08);
    const glow = ctx.createRadialGradient(sunX, sunY, h * 0.02, sunX, sunY, sunR);
    glow.addColorStop(0, "rgba(255,244,214,.95)");
    glow.addColorStop(0.22, rgb(p.sun, 0.9));
    glow.addColorStop(1, rgb(p.sun, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();
    blob(ctx, sunX, sunY, h * 0.055, h * 0.055, rgb(mix(p.sun, [255, 236, 196], 0.35)));

    const drift = frozen() ? 40 : (time * w * 0.012) % (w + 180);
    cloud(ctx, ((drift) % (w + 200)) - 80, h * 0.16, w / 420, 0.72 - stress * 0.28);
    cloud(ctx, ((drift * 0.7 + w * 0.45) % (w + 220)) - 60, h * 0.1, w / 520, 0.55 - stress * 0.2);
    cloud(ctx, ((drift * 0.45 + w * 0.72) % (w + 240)) - 40, h * 0.22, w / 640, 0.42);

    ridge(ctx, w, h, h * 0.5, 0.2, rgb(p.far, 0.85), 2);
    ctx.fillStyle = rgb(p.haze, 0.18 + stress * 0.12);
    ctx.fillRect(0, h * 0.42, w, h * 0.14);
    ridge(ctx, w, h, h * 0.62, 0.16, rgb(p.mid), 9);

    const forestTint = mix(p.forest, [46, 110, 68], eco * 0.65);
    const forestLit = mix(p.forestLit, [150, 184, 102], eco * 0.7);
    for (let i = 0; i < 18; i++) {
      const x = hash(20 + i) * w;
      const s = h * (0.07 + hash(40 + i) * 0.05) * (0.55 + eco * 0.7);
      if (hash(60 + i) > 0.25 + eco * 0.75 - stress * 0.35) continue;
      tree(ctx, x, h * 0.6, s, rgb(forestTint), rgb(forestLit), Math.sin(time * 1.2 + i) * h * 0.004);
    }

    const waterTop = h * 0.6;
    const waterH = h * 0.1;
    const waterC = mix(p.waterDeep, p.water, eco);
    const wg = ctx.createLinearGradient(0, waterTop, 0, waterTop + waterH);
    wg.addColorStop(0, rgb(mix(p.water, [150, 130, 100], stress * 0.55), 0.95));
    wg.addColorStop(1, rgb(waterC));
    ctx.fillStyle = wg;
    ctx.fillRect(0, waterTop, w, waterH);
    ctx.strokeStyle = `rgba(255,250,240,${0.28 + eco * 0.35})`;
    ctx.lineWidth = Math.max(1, h * 0.004);
    for (let row = 0; row < 4; row++) {
      ctx.beginPath();
      const y = waterTop + waterH * (0.22 + row * 0.2);
      for (let x = 0; x <= w; x += 10) {
        const yy = y + Math.sin(x * 0.02 + time * 1.6 + row) * (h * 0.004);
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.fillStyle = rgb(mix(p.sun, [255, 255, 255], 0.4), 0.08 + eco * 0.08);
    ctx.fillRect(w * 0.35, waterTop + 2, w * 0.22, waterH * 0.35);

    ridge(ctx, w, h, h * 0.8, 0.1, rgb(mix(p.hill, p.dry, stress * (1 - eco * 0.45))), 15);
    ctx.globalAlpha = 0.45;
    ridge(ctx, w, h, h * 0.86, 0.05, rgb(p.hillLit, 0.55), 21);
    ctx.globalAlpha = 1;

    const fieldN = Math.round(3 + (look.fields || 0) * 4);
    for (let i = 0; i < fieldN; i++) {
      const x = w * (0.06 + hash(80 + i) * 0.88);
      const y = h * (0.78 + hash(100 + i) * 0.12);
      const green = mix(p.dry, p.field, clamp(eco * 0.75 + (look.fields || 0) * 0.4, 0, 1));
      blob(ctx, x, y, w * 0.055, h * 0.028, rgb(green, 0.85));
      blob(ctx, x - w * 0.01, y - h * 0.008, w * 0.03, h * 0.012, rgb(mix(green, [230, 210, 140], 0.35), 0.7));
    }

    const bare = stress * (1 - eco * 0.65);
    if (bare > 0.2) {
      for (let i = 0; i < 4; i++) {
        blob(ctx, w * (0.15 + hash(140 + i) * 0.7), h * (0.8 + hash(160 + i) * 0.1), w * 0.04, h * 0.016, rgb(p.dry, bare * 0.55));
      }
    }
    if (stress > 0.55) {
      const scarA = (stress - 0.5) * 0.7;
      blob(ctx, w * 0.22, h * 0.74, w * 0.06, h * 0.02, `rgba(120,52,36,${scarA})`);
      blob(ctx, w * 0.3, h * 0.7, w * 0.035, h * 0.016, `rgba(92,48,32,${scarA * 0.8})`);
      if (stress > 0.72) {
        blob(ctx, w * 0.26, h * 0.62, w * 0.03, h * 0.04, `rgba(120,100,88,${0.18 + Math.sin(time) * 0.04})`);
        blob(ctx, w * 0.28, h * 0.56, w * 0.02, h * 0.03, `rgba(140,120,108,${0.12})`);
      }
    }

    const density = clamp(0.2 + eco * 0.85 - stress * 0.38, 0.08, 1);
    const treeCount = Math.round(10 + density * 22);
    for (let i = 0; i < treeCount; i++) {
      const x = hash(200 + i) * w;
      const y = h * (0.74 + hash(230 + i) * 0.16);
      const s = h * (0.08 + hash(260 + i) * 0.07) * (0.75 + eco * 0.45);
      const sway = Math.sin(time * 1.35 + i * 0.7) * h * 0.006;
      tree(ctx, x, y, s, rgb(forestTint), rgb(forestLit), sway);
    }

    const cityH = h * (0.1 + prosper * 0.1);
    const cityX = w * 0.58;
    const blocks = [
      [0, 0.55, 0.1],
      [0.11, 0.85, 0.12],
      [0.25, 0.45, 0.09],
      [0.36, 1, 0.14],
      [0.52, 0.62, 0.11],
      [0.66, 0.78, 0.1]
    ];
    blocks.forEach((b, i) => {
      const bh = cityH * b[1];
      const bw = w * b[2] * 0.18;
      const x = cityX + w * b[0] * 0.22;
      const y = h * 0.8 - bh;
      ctx.fillStyle = rgb(p.city);
      roundRect(ctx, x, y, bw, bh + h * 0.04, 3);
      ctx.fill();
      ctx.fillStyle = rgb(p.roof);
      ctx.fillRect(x, y, bw, Math.max(3, bh * 0.08));
      const winA = (0.15 + stress * 0.55) * clamp(look.lights ?? 0.4, 0.2, 1);
      for (let wy = y + bh * 0.22; wy < y + bh * 0.86; wy += bh * 0.18) {
        for (let wx = x + bw * 0.18; wx < x + bw * 0.8; wx += bw * 0.28) {
          const tw = frozen() ? 0.75 : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(time * 2.2 + i + wx));
          ctx.fillStyle = `rgba(255,214,140,${winA * tw})`;
          ctx.fillRect(wx, wy, Math.max(1.5, bw * 0.1), Math.max(1.5, bh * 0.06));
        }
      }
    });

    if ((look.solar || 0) > 0.15) {
      const rows = 2 + Math.round(look.solar * 2);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < 5; c++) {
          const x = w * 0.08 + c * w * 0.028;
          const y = h * (0.8 + r * 0.028);
          ctx.save();
          ctx.translate(x, y);
          ctx.transform(1, 0.35, 0, 1, 0, 0);
          const g = ctx.createLinearGradient(0, 0, w * 0.02, h * 0.012);
          g.addColorStop(0, "rgb(232,196,120)");
          g.addColorStop(1, "rgb(70,120,124)");
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w * 0.022, h * 0.012);
          ctx.restore();
        }
      }
    }

    const turbines = Math.round(clamp(look.wind || 0, 0, 6));
    for (let i = 0; i < turbines; i++) {
      const x = w * (0.12 + i * 0.1);
      const y = h * (0.7 - (i % 2) * 0.04);
      const spin = time * (0.7 + turbines * 0.08) + i;
      turbine(ctx, x, y, h * 0.16, frozen() ? i : spin);
    }

    if ((look.lines || 0) > 0.2) {
      const towers = look.lines > 0.6 ? 3 : 2;
      const pts = [];
      for (let i = 0; i < towers; i++) {
        const x = w * (0.18 + i * 0.16);
        const y = h * 0.74;
        pts.push([x, y - h * 0.1]);
        ctx.strokeStyle = "rgba(244,236,220,.9)";
        ctx.lineWidth = Math.max(1.2, h * 0.004);
        ctx.beginPath();
        ctx.moveTo(x - w * 0.008, y);
        ctx.lineTo(x, y - h * 0.11);
        ctx.lineTo(x + w * 0.008, y);
        ctx.moveTo(x - w * 0.005, y - h * 0.04);
        ctx.lineTo(x + w * 0.005, y - h * 0.04);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        const mx = (pts[i - 1][0] + pts[i][0]) / 2;
        const my = (pts[i - 1][1] + pts[i][1]) / 2 + h * 0.02;
        ctx.quadraticCurveTo(mx, my, pts[i][0], pts[i][1]);
      }
      ctx.strokeStyle = "rgba(244,236,220,.75)";
      ctx.stroke();
    }

    if ((look.geo || 0) > 0.2) {
      const x = w * 0.9;
      const y = h * 0.78;
      blob(ctx, x, y, w * 0.03, h * 0.02, "rgb(214,206,190)");
      blob(ctx, x, y - h * 0.012, w * 0.018, h * 0.016, "rgb(186,176,158)");
      const puff = (time * 0.35) % 1;
      blob(ctx, x + w * 0.01, y - h * (0.04 + puff * 0.08), w * 0.012, h * 0.01, `rgba(236,232,224,${0.45 - puff * 0.35})`);
    }

    if (look.nuclear) {
      blob(ctx, w * 0.5, h * 0.76, w * 0.028, h * 0.02, "rgb(214,206,188)");
      ctx.fillStyle = "rgb(186,178,162)";
      ctx.fillRect(w * 0.492, h * 0.7, w * 0.008, h * 0.05);
    }

    if ((look.transit || 0) > 0.2) {
      ctx.strokeStyle = "rgba(90,74,56,.35)";
      ctx.lineWidth = Math.max(2, h * 0.008);
      ctx.beginPath();
      ctx.moveTo(w * 0.08, h * 0.9);
      ctx.quadraticCurveTo(w * 0.4, h * 0.86, w * 0.92, h * 0.9);
      ctx.stroke();
      const u = frozen() ? 0.35 : (time * 0.06) % 1;
      const tx = w * (0.1 + u * 0.72);
      const ty = h * 0.885;
      roundRect(ctx, tx, ty - h * 0.028, w * 0.045, h * 0.026, 4);
      ctx.fillStyle = "rgb(232,214,176)";
      ctx.fill();
      ctx.fillStyle = "rgba(255,214,140,.85)";
      ctx.fillRect(tx + w * 0.008, ty - h * 0.02, w * 0.01, h * 0.01);
      ctx.fillRect(tx + w * 0.024, ty - h * 0.02, w * 0.01, h * 0.01);
    }

    if (stress > 0.66 && !frozen()) {
      ctx.save();
      ctx.globalAlpha = (stress - 0.6) * 0.35;
      ctx.strokeStyle = rgb(p.haze);
      ctx.lineWidth = h * 0.01;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        const y = h * (0.72 + i * 0.04);
        for (let x = 0; x <= w; x += 16) {
          const yy = y + Math.sin(x * 0.03 + time * 3 + i) * 2;
          if (x === 0) ctx.moveTo(x, yy);
          else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    const haze = ctx.createLinearGradient(0, 0, 0, h);
    haze.addColorStop(0, rgb(p.haze, 0.05 + stress * 0.28));
    haze.addColorStop(0.45, rgb(p.haze, stress * 0.16));
    haze.addColorStop(1, rgb(p.haze, stress * 0.08));
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, w, h);

    if (eco > 0.45) {
      ctx.fillStyle = `rgba(70,120,80,${(eco - 0.4) * 0.16})`;
      ctx.fillRect(0, h * 0.55, w, h * 0.45);
    }

    if (grain) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.globalCompositeOperation = "multiply";
      const pat = ctx.createPattern(grain, "repeat");
      if (pat) {
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.restore();
    }

    const vig = ctx.createRadialGradient(w * 0.5, h * 0.45, h * 0.2, w * 0.5, h * 0.5, w * 0.7);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(40,32,24,.22)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    if (!frozen() && performance.now() < pulseUntil) {
      const a = (pulseUntil - performance.now()) / 1400;
      const bloom = ctx.createRadialGradient(w * 0.5, h * 0.6, 10, w * 0.5, h * 0.6, w * 0.45);
      bloom.addColorStop(0, `rgba(255,220,150,${0.35 * a})`);
      bloom.addColorStop(1, "rgba(255,220,150,0)");
      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, w, h);
    }

    if (look.ending) grade(ctx, w, h, look.ending);
  }

  function roundRect(ctx, x, y, rw, rh, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + rw, y, x + rw, y + rh, r);
    ctx.arcTo(x + rw, y + rh, x, y + rh, r);
    ctx.arcTo(x, y + rh, x, y, r);
    ctx.arcTo(x, y, x + rw, y, r);
    ctx.closePath();
  }

  function grade(ctx, w, h, ending) {
    if (ending === "The Age of Abundance") {
      const g = ctx.createRadialGradient(w * 0.7, h * 0.2, 10, w * 0.6, h * 0.4, w * 0.7);
      g.addColorStop(0, "rgba(255,214,120,.28)");
      g.addColorStop(1, "rgba(255,214,120,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    } else if (ending === "The Regeneration Century") {
      ctx.fillStyle = "rgba(46,110,72,.2)";
      ctx.fillRect(0, h * 0.45, w, h * 0.55);
      ctx.fillStyle = "rgba(120,180,150,.12)";
      ctx.fillRect(0, 0, w, h);
    } else if (ending === "The Managed Transition") {
      ctx.fillStyle = "rgba(90,130,140,.16)";
      ctx.fillRect(0, 0, w, h);
    } else if (ending === "The Hot Growth Era") {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "rgba(196,110,48,.18)");
      g.addColorStop(1, "rgba(120,70,40,.16)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    } else if (ending === "The Long Emergency") {
      ctx.fillStyle = "rgba(70,48,36,.28)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(40,28,22,.25)";
      ctx.fillRect(0, h * 0.7, w, h * 0.3);
    } else if (ending === "The Fractured Century") {
      ctx.fillStyle = "rgba(70,120,110,.22)";
      ctx.fillRect(0, 0, w * 0.5, h);
      ctx.fillStyle = "rgba(150,80,48,.24)";
      ctx.fillRect(w * 0.5, 0, w * 0.5, h);
      ctx.strokeStyle = "rgba(245,236,214,.7)";
      ctx.lineWidth = Math.max(2, w * 0.004);
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.08);
      ctx.lineTo(w * 0.5, h * 0.92);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  const titleLook = {
    stress: 0.36,
    eco: 0.74,
    prosper: 0.62,
    wind: 3,
    solar: 0.7,
    lines: 0.45,
    geo: 0.35,
    transit: 0.4,
    fields: 0.66,
    lights: 0.35,
    nuclear: 0
  };

  function drawCanvas(canvas, look, time) {
    const box = fit(canvas);
    if (!box || !look) return false;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.clearRect(0, 0, box.w, box.h);
    paint(ctx, box.w, box.h, look, time);
    return true;
  }

  function loop(now) {
    requestAnimationFrame(loop);
    if (document.hidden) return;
    const still = frozen();
    if (!dirty && still) return;
    if (!dirty && now - last < 33) return;
    last = now;
    dirty = false;
    const time = still ? 3.2 : (now - t0) / 1000;
    let missed = false;
    if (visible(titleCanvas) && !drawCanvas(titleCanvas, titleLook, time)) missed = true;
    if (visible(worldCanvas) && worldLook && !drawCanvas(worldCanvas, worldLook, time)) missed = true;
    if (visible(endCanvas) && endLook && !drawCanvas(endCanvas, endLook, time)) missed = true;
    if (!still || missed) dirty = true;
  }

  function mount() {
    titleCanvas = document.getElementById("titleCanvas");
    worldCanvas = document.getElementById("worldCanvas");
    endCanvas = document.getElementById("endCanvas");
    if (!grain) makeGrain();
    if (!started) {
      started = true;
      const ro = new ResizeObserver(() => { dirty = true; });
      [titleCanvas, worldCanvas, endCanvas].forEach((c) => {
        if (c && c.parentElement) ro.observe(c.parentElement);
      });
      reduceQuery.addEventListener("change", () => { dirty = true; });
      requestAnimationFrame(loop);
    }
    dirty = true;
  }

  window.BreakthroughScene = {
    mount,
    setWorld(look) { worldLook = look; dirty = true; },
    showEnd(look, ending) { endLook = Object.assign({}, look, { ending }); dirty = true; },
    pulse() { pulseUntil = performance.now() + 1400; dirty = true; },
    resize() { dirty = true; }
  };
})();
