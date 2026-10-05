// Shared material patches. Every patch keeps three's standard lighting, shadows and fog, and adds one thing.
import * as THREE from 'three';

// Fog of war on the world: ground outside the vision of team 0 gets darker and greyer. uFow is a small texture over the
// whole map (red = seen), so every material that includes this reads one texel.
export const fow = { uFow: { value: null }, uSize: { value: 9600 }, uFowOn: { value: 0 } };
export const FOW_GLSL = `
uniform sampler2D uFow; uniform float uSize; uniform float uFowOn;
vec3 applyFow(vec3 c, vec2 p) {
  float seen = mix(1., texture2D(uFow, p / uSize).r, uFowOn);
  float l = dot(c, vec3(.299, .587, .114));
  return mix(mix(vec3(l), c, .7) * vec3(.7, .73, .8), c, seen);
}`;
// Adds a world-position varying and the fog-of-war function to a standard material's shaders.
export function withWorld(shader) {
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWorldP;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>');
  // The world position is taken after skinning and instancing, where three computes it for shadows.
  shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
  { vec4 wp = vec4( transformed, 1.0 );
    #ifdef USE_BATCHING
      wp = batchingMatrix * wp;
    #endif
    #ifdef USE_INSTANCING
      wp = instanceMatrix * wp;
    #endif
    vWorldP = ( modelMatrix * wp ).xyz; }`);
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWorldP;\n' + FOW_GLSL);
  Object.assign(shader.uniforms, fow);
  return shader;
}
export function fowAtEnd(shader) {
  shader.fragmentShader = shader.fragmentShader.replace('#include <tonemapping_fragment>', 'gl_FragColor.rgb = applyFow( gl_FragColor.rgb, vWorldP.xz );\n#include <tonemapping_fragment>');
  return shader;
}
// Stone and wood for built things: the texture is projected from world space along the face normal, so walls, bridges
// and ruins keep the same texel size whatever their scale.
export function worldMapped(texture, { color = '#ffffff', roughness = .92, scale = 260, key = 'world-mapped' } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, map: texture });
  m.onBeforeCompile = shader => {
    withWorld(shader); fowAtEnd(shader);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWorldN;').replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
      { vec3 wn = objectNormal;
        #ifdef USE_INSTANCING
          wn = mat3( instanceMatrix ) * wn;
        #endif
        vWorldN = normalize( mat3( modelMatrix ) * wn ); }`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vWorldN;`).replace('#include <map_fragment>', `
      vec3 an = abs( vWorldN ); vec2 wuv = an.y > max( an.x, an.z ) ? vWorldP.xz : an.x > an.z ? vWorldP.zy : vWorldP.xy;
      vec4 wtex = texture2D( map, wuv / ${scale.toFixed(1)} ); diffuseColor *= vec4( wtex.rgb, 1. );
      float wh = wtex.a;`).replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp( roughnessFactor + ( .5 - wh ) * .25, .3, 1. );');
  };
  m.customProgramCacheKey = () => key;
  return m;
}
// Heroes, minions and creatures: a team-coloured rim from the side away from the camera (dark armour stays readable on
// grass), a short white flash when hit, and screen-door fading (no transparency sort, shadows stay right).
export const unitUniforms = (tint = null) => ({ uRim: { value: new THREE.Color(0, 0, 0) }, uRimPower: { value: 1 }, uFlash: { value: 0 }, uFade: { value: 1 }, uTint: { value: new THREE.Color(tint || '#ffffff') }, uTintOn: { value: tint ? 1 : 0 }, uTintRange: { value: new THREE.Vector2(.32, .55) }, uTintGlow: { value: 0 } });
// One uniforms object can drive every material of a unit (body and weapons).
export function unitMaterial(source, uniforms = unitUniforms(), key = 'unit') {
  const m = source.clone();
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform vec3 uRim; uniform float uRimPower; uniform float uFlash; uniform float uFade; uniform vec3 uTint; uniform float uTintOn; uniform vec2 uTintRange; uniform float uTintGlow;`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      if ( uFade < .999 ) { float d = fract( dot( floor( gl_FragCoord.xy ), vec2( .7548777, .5698403 ) ) ); if ( d > uFade ) discard; }`)
      // Tabards and cloth: bright, low-saturation texels take the team colour (a minion's off-white tabard).
      // A tower's pale crystal uses the same rule with a higher threshold, and also glows.
      .replace('#include <map_fragment>', `#include <map_fragment>
      float tintMask = 0.;
      if ( uTintOn > .5 ) { vec3 c = diffuseColor.rgb; float hi = max( c.r, max( c.g, c.b ) ), lo = min( c.r, min( c.g, c.b ) );
        tintMask = smoothstep( uTintRange.x, uTintRange.y, hi ) * ( 1. - smoothstep( .12, .3, hi - lo ) );
        diffuseColor.rgb = mix( c, uTint * ( .45 + hi * .75 ), tintMask * .9 ); }`)
      .replace('#include <tonemapping_fragment>', `
      { vec3 vd = normalize( vViewPosition ); float rim = pow( 1. - clamp( dot( normal, vd ), 0., 1. ), 2.6 );
        gl_FragColor.rgb += uRim * rim * uRimPower + vec3( uFlash ) + uTint * tintMask * uTintGlow; }
      #include <tonemapping_fragment>`);
  };
  m.customProgramCacheKey = () => key;
  m.userData.uniforms = uniforms;
  return m;
}
