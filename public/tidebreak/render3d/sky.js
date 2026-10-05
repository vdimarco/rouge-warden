// Light and air: a low golden sun that casts the one shadow map, a cool sky fill, an environment map for metal, and a
// light haze toward the horizon. Each realm has its own mood and the change blends over about a second.
import * as THREE from 'three';

// Town: warm late afternoon. Woods: cooler misty dusk under the canopy.
export const MOODS = [
  { sun: '#ffd093', sunIntensity: 4.6, elevation: 28, azimuth: 222, sky: '#a9c0dc', ground: '#6b5636', hemi: 1.35, fog: '#c4ad88', fogNear: 3600, fogFar: 11000, env: .7, exposure: 1.18, rim: .55 },
  { sun: '#ffab78', sunIntensity: 3.3, elevation: 19, azimuth: 236, sky: '#8aa3c0', ground: '#3a4438', hemi: 1.5, fog: '#7d909a', fogNear: 2500, fogFar: 8600, env: .6, exposure: 1.22, rim: .8 },
];
// Golden-hour grade after ACES: shadows lean teal, highlights lean amber, saturation eases off a little. One fixed
// function in every material's tone mapping, so it costs no extra pass.
export function installGrade() {
  const chunk = THREE.ShaderChunk.tonemapping_pars_fragment;
  if (!chunk.includes('CustomToneMapping') || chunk.includes('shoreGrade')) return;
  THREE.ShaderChunk.tonemapping_pars_fragment = chunk.replace(/vec3 CustomToneMapping\( vec3 color \) \{[^}]*\}/, `vec3 CustomToneMapping( vec3 color ) {
    // shoreGrade
    color = ACESFilmicToneMapping( color );
    float l = dot( color, vec3( .2126, .7152, .0722 ) );
    color = mix( vec3( l ), color, .9 );
    color += vec3( -.012, .006, .02 ) * ( 1. - smoothstep( .0, .45, l ) );
    color *= mix( vec3( 1. ), vec3( 1.035, 1.0, .94 ), smoothstep( .35, 1., l ) );
    return clamp( color, 0., 1. );
  }`);
}
// A gradient sky with a low sun, baked once into a PMREM environment map.
function skyEnvironment(gl) {
  const scene = new THREE.Scene(), sun = new THREE.Vector3(-.55, .32, .62).normalize();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { sun: { value: sun } },
    vertexShader: 'varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'uniform vec3 sun; varying vec3 v; void main(){ float h = v.y; vec3 sky = mix(vec3(.78,.66,.52), vec3(.36,.47,.66), smoothstep(0., .6, h)); vec3 ground = mix(vec3(.30,.27,.2), vec3(.15,.14,.11), clamp(-h * 2., 0., 1.)); vec3 c = h > 0. ? sky : ground; float s = max(dot(v, sun), 0.); c += vec3(3.2, 2.3, 1.3) * pow(s, 90.) + vec3(.5, .32, .16) * pow(s, 6.); gl_FragColor = vec4(c, 1.); }' }));
  scene.add(dome);
  const pmrem = new THREE.PMREMGenerator(gl), env = pmrem.fromScene(scene, .03).texture; pmrem.dispose(); dome.geometry.dispose(); dome.material.dispose();
  return env;
}
export class Sky {
  constructor(gl, scene) {
    this.scene = scene; this.blend = 0; this.target = 0;
    scene.environment = skyEnvironment(gl);
    this.hemi = new THREE.HemisphereLight('#9db6d6', '#5d4a30', 1); scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffc985', 3); this.sun.castShadow = true; scene.add(this.sun, this.sun.target);
    const shadow = this.sun.shadow; shadow.bias = -.0004; shadow.normalBias = 2.5; shadow.radius = 2.5; shadow.camera.near = 10; shadow.camera.far = 9000;
    scene.fog = new THREE.Fog('#b9a585', 3800, 11500); scene.background = new THREE.Color('#b9a585');
    this.color = new THREE.Color(); this.dir = new THREE.Vector3(); this.apply(0);
  }
  // Mood blend m in 0..1 (town to woods).
  apply(m) {
    const [a, b] = MOODS, mix = (x, y) => x + (y - x) * m, col = (x, y, out) => out.set(x).lerp(this.color.set(y), m);
    col(a.sun, b.sun, this.sun.color); this.sun.intensity = mix(a.sunIntensity, b.sunIntensity);
    col(a.sky, b.sky, this.hemi.color); col(a.ground, b.ground, this.hemi.groundColor); this.hemi.intensity = mix(a.hemi, b.hemi);
    col(a.fog, b.fog, this.scene.fog.color); this.scene.background.copy(this.scene.fog.color);
    this.scene.fog.near = mix(a.fogNear, b.fogNear); this.scene.fog.far = mix(a.fogFar, b.fogFar);
    this.scene.environmentIntensity = mix(a.env, b.env); this.exposure = mix(a.exposure, b.exposure); this.rim = mix(a.rim, b.rim);
    // The sun comes from the south-west and low, so shadows fall up and to the right on screen.
    const el = THREE.MathUtils.degToRad(mix(a.elevation, b.elevation)), az = THREE.MathUtils.degToRad(mix(a.azimuth, b.azimuth));
    this.dir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    this.mood = m;
  }
  update(phase, dt) {
    this.target = phase ? 1 : 0;
    if (this.blend !== this.target) { const step = dt / 1.1; this.blend = this.target > this.blend ? Math.min(this.target, this.blend + step) : Math.max(this.target, this.blend - step); }
    const m = this.blend * this.blend * (3 - 2 * this.blend); if (m !== this.mood) this.apply(m);
  }
  // Fits the shadow camera around the ground the view can see. Snapping to whole shadow texels keeps edges still
  // while the camera glides.
  fitShadow(center, radius, mapSize) {
    const sun = this.sun, cam = sun.shadow.camera, texel = radius * 2 / mapSize;
    const x = Math.round(center.x / texel) * texel, z = Math.round(center.z / texel) * texel;
    sun.target.position.set(x, 0, z); sun.position.set(x + this.dir.x * 4000, this.dir.y * 4000, z + this.dir.z * 4000);
    if (cam.right !== radius) { cam.left = cam.bottom = -radius; cam.right = cam.top = radius; cam.updateProjectionMatrix(); }
    if (sun.shadow.mapSize.x !== mapSize) { sun.shadow.mapSize.set(mapSize, mapSize); sun.shadow.map?.dispose(); sun.shadow.map = null; }
    sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
  }
}
