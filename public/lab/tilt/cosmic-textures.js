// Small cached layers keep the fine dust out of the per-frame drawing loop.
const TAU = Math.PI * 2;
const random = seed => { let n = seed >>> 0; return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; }; };

export function makeGalaxyTexture(size = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d'), r = random(82437), c = size / 2, reach = size * .43;
  g.translate(c, c); g.scale(1, .66);
  const halo = g.createRadialGradient(0, 0, 0, 0, 0, reach * 1.15);
  halo.addColorStop(0, '#fff0c97d'); halo.addColorStop(.09, '#edbd8552');
  halo.addColorStop(.28, '#a892ba30'); halo.addColorStop(.65, '#6375a819'); halo.addColorStop(1, '#21365600');
  g.fillStyle = halo; g.fillRect(-c, -size, size, size * 2);
  // Uneven density, broad clouds and tiny stars share the same spiral arms.
  for (let i = 0; i < 7600; i++) {
    const distance = Math.pow(r(), .68), arm = i % 3;
    const scatter = (r() + r() + r() - 1.5) * (.18 + distance * .20);
    const angle = arm * TAU / 3 + distance * 5.5 + scatter;
    const radius = reach * distance, x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    const warm = distance < .32 || r() > .79;
    const pointSize = i < 1000 ? 3 + r() * 13 : .3 + r() * 1.05;
    g.globalAlpha = (i < 1000 ? .015 : .08 + r() * .49) * (1 - distance * .68);
    g.fillStyle = warm ? '#f3d0a3' : r() > .5 ? '#a4c4ef' : '#c8bbdd';
    g.beginPath(); g.arc(x, y, pointSize, 0, TAU); g.fill();
  }
  // Gaps in the dust are as useful as bright clouds for giving the galaxy depth.
  g.globalCompositeOperation = 'destination-out';
  for (let arm = 0; arm < 3; arm++) {
    for (let j = 0; j < 75; j++) {
      const t = j / 75, a = arm * TAU / 3 + t * 5.5 + .19;
      const radius = reach * t, x = Math.cos(a) * radius, y = Math.sin(a) * radius;
      g.globalAlpha = .05 * Math.sin(t * Math.PI);
      g.beginPath(); g.arc(x, y, 3 + t * 9, 0, TAU); g.fill();
    }
  }
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  const core = g.createRadialGradient(0, 0, 0, 0, 0, reach * .16);
  core.addColorStop(0, '#fff8e2da'); core.addColorStop(.1, '#ffedd299'); core.addColorStop(.46, '#ffcf8735'); core.addColorStop(1, '#eccda500');
  g.fillStyle = core; g.fillRect(-reach, -reach, reach * 2, reach * 2);
  return canvas;
}

export function makeOrbitDust(seed, color) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 768;
  const g = canvas.getContext('2d'), r = random(seed + 7145);
  g.translate(384, 384); g.rotate(-.35 + r() * .7);
  for (let i = 0; i < 1700; i++) {
    const a = r() * TAU;
    const width = (r() + r() - 1) * 21;
    const radius = 250 + width + 24 * Math.sin(a * 3 + seed);
    const x = Math.cos(a) * radius, y = Math.sin(a) * radius * .80;
    const density = .3 + .7 * Math.max(0, Math.sin(a * 2 - seed));
    g.globalAlpha = (.03 + r() * .15) * density;
    g.fillStyle = i % 5 === 0 ? color : '#c0b9ae';
    const size = .35 + r() * 1.3;
    g.fillRect(x, y, size, size);
  }
  return canvas;
}
