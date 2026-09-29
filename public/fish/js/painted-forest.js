// Painted cutouts stand on the same terrain as the original trees. Each forest
// layer is one instanced draw, with cylindrical billboards that follow the eye.
import * as THREE from "three";

let atlas = null, loading = null;
export function loadPaintedForest() {
  if (atlas) return Promise.resolve(true);
  if (loading) return loading;
  loading = new Promise(resolve => {
    let settled = false;
    const finish = ok => { if (settled) return; settled = true; clearTimeout(timer); loading = null; resolve(ok); };
    const timer = setTimeout(() => finish(false), 8000);
    new THREE.TextureLoader().load(new URL("../art/painted-forest.webp", import.meta.url).href, texture => {
      if (settled) { texture.dispose(); return; }
      texture.colorSpace = THREE.NoColorSpace;
      texture.anisotropy = 2;
      atlas = texture;
      finish(true);
    }, undefined, () => finish(false));
  });
  return loading;
}

// Bounds use the delivered illustration's natural spacing, including its alpha
// gutters. The lower crowns are wider than the tall trees in the upper row.
const CELLS = [
  [0, .452, .51, .548], [.515, .452, .485, .548],
  [0, .025, .518, .422], [.52, .025, .48, .422],
];

export function paintedTrees(spots, count, kind, U, tint, random) {
  if (!atlas || !count || !spots.length) return null;
  const n = Math.min(spots.length, count);
  const geometry = new THREE.PlaneGeometry(1, 1);
  geometry.translate(0, .46, 0);
  const cells = new Float32Array(n * 4);
  const material = new THREE.ShaderMaterial({
    uniforms: { uAtlas: { value: atlas }, uTime: U.uTime, uNight: U.uNight, uFog: U.uFogCol, uHorizon: U.uHorizon },
    side: THREE.DoubleSide,
    vertexShader: `
      attribute vec4 paintCell;
      uniform float uTime;
      varying vec2 vPaintUV;
      varying vec3 vTint;
      varying float vDistance;
      void main() {
        vec3 center = (modelMatrix * instanceMatrix * vec4(0., 0., 0., 1.)).xyz;
        float sx = length(instanceMatrix[0].xyz), sy = length(instanceMatrix[1].xyz);
        vec2 toward = cameraPosition.xz - center.xz;
        vec3 right = normalize(vec3(toward.y, 0., -toward.x));
        float sway = sin(uTime * .65 + center.x * .13 + center.z * .17) * .018;
        float crown = max(position.y, 0.);
        vec3 world = center + right * (position.x * sx + sway * crown * crown * sy);
        world.y += position.y * sy;
        vPaintUV = paintCell.xy + uv * paintCell.zw;
        vTint = instanceColor;
        vDistance = length(cameraPosition - world);
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.);
      }`,
    fragmentShader: `
      uniform sampler2D uAtlas;
      uniform float uNight;
      uniform vec3 uFog, uHorizon;
      varying vec2 vPaintUV;
      varying vec3 vTint;
      varying float vDistance;
      void main() {
        vec4 paint = texture2D(uAtlas, vPaintUV);
        if (paint.a < .32) discard;
        vec3 col = paint.rgb * vTint;
        // An illustration carries its own light. The hour adds a gentle wash.
        col *= mix(vec3(1.04, 1.02, .93), vec3(.20, .32, .40), uNight);
        col = mix(col, col * uHorizon * 1.25, .13 * (1. - uNight));
        float haze = smoothstep(65., 650., vDistance);
        col = mix(col, uFog, haze * .82);
        gl_FragColor = vec4(col, 1.);
      }`,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, n);
  const matrix = new THREE.Matrix4(), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const spot = spots[i], variant = kind === "leaf" ? (i % 2 ? 3 : 1) : (i % 5 ? 0 : 2);
    cells.set(CELLS[variant], i * 4);
    const broad = variant > 1;
    const height = spot.s * (kind === "far" ? 1.2 : 1.15);
    matrix.makeScale(height * (broad ? 1.17 : .91), height, 1);
    matrix.setPosition(spot.x, spot.y, spot.z);
    mesh.setMatrixAt(i, matrix);
    const t = tint(random), strength = kind === "far" ? .16 : .26;
    c.setRGB(1 + (t[0] - 1) * strength, 1 + (t[1] - 1) * strength, 1 + (t[2] - 1) * strength);
    mesh.setColorAt(i, c);
  }
  geometry.setAttribute("paintCell", new THREE.InstancedBufferAttribute(cells, 4));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.userData.paintedForest = kind;
  return mesh;
}
