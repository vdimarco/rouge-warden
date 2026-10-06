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
// See-through tubes: up to eight points (heroes, soldiers near the pointer), each a vec4 of position and radius
// (radius 0 = unused). A fragment between the camera and a point, inside the tube, is thinned with a screen-door
// pattern, so a tree crown or a tower in front of a hero lets the hero show through. Nothing behind the point is cut.
export const SEE_POINTS = 8;
export const seeUniforms = { uSeeAt: { value: Array.from({ length: SEE_POINTS }, () => new THREE.Vector4(0, -9999, 0, 0)) } };
export const SEE_GLSL = `uniform vec4 uSeeAt[ ${SEE_POINTS} ];
void seeThrough( vec3 wp ) {
  float cut = 0.;
  for ( int i = 0; i < ${SEE_POINTS}; i ++ ) {
    vec4 h = uSeeAt[ i ]; if ( h.w <= 0. ) continue;
    vec3 ab = h.xyz - cameraPosition; float t = clamp( dot( wp - cameraPosition, ab ) / dot( ab, ab ), 0., 1. );
    float d = length( wp - cameraPosition - ab * t );
    cut = max( cut, ( 1. - smoothstep( h.w * .5, h.w, d ) ) * ( 1. - smoothstep( .9, .97, t ) ) );
  }
  float k = fract( dot( floor( gl_FragCoord.xy ), vec2( .7548777, .5698403 ) ) );
  if ( k < .76 * cut ) discard;
}`;
// Smooth 3D value noise, for the death dissolve.
const DISSOLVE_NOISE = `float dHash( vec3 p ) { p = fract( p * .3183099 + .1 ); p *= 17.; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }
float dNoise( vec3 x ) { vec3 i = floor( x ), f = fract( x ); f = f * f * ( 3. - 2. * f );
  return mix( mix( mix( dHash( i ), dHash( i + vec3( 1, 0, 0 ) ), f.x ), mix( dHash( i + vec3( 0, 1, 0 ) ), dHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
              mix( mix( dHash( i + vec3( 0, 0, 1 ) ), dHash( i + vec3( 1, 0, 1 ) ), f.x ), mix( dHash( i + vec3( 0, 1, 1 ) ), dHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z ); }`;
// Heroes, minions and creatures: a team-coloured rim from the side away from the camera (dark armour stays readable on
// grass), a short white flash when hit, screen-door fading for concealment, and a clean death dissolve: the body
// burns away from the head down in soft blobs, with an ember edge, instead of a fine dot pattern.
// The dissolve works in world space (every part of a unit burns on one schedule): uDissolveBase is the unit's foot
// height and uNoiseScale is ten noise cells per body height. uGlow lifts a crystal without clipping:
// the tinted part glows in its own colour, scaled down where it is already bright.
// Crystal materials only: uFacet is the number of facets per model unit, uHeart the crystal's radius in model units
// and uTime drives the shimmer.
export const unitUniforms = (tint = null) => ({ uRim: { value: new THREE.Color(0, 0, 0) }, uRimPower: { value: 1 }, uFlash: { value: 0 }, uFade: { value: 1 }, uTint: { value: new THREE.Color(tint || '#ffffff') }, uTintOn: { value: tint ? 1 : 0 }, uTintRange: { value: new THREE.Vector2(.45, .62) }, uTintGlow: { value: 0 }, uTintLevel: { value: 1 }, uDissolve: { value: 0 }, uNoiseScale: { value: 1 }, uDissolveBase: { value: 0 }, uDissolveColor: { value: new THREE.Color('#ffb06a') }, uFacet: { value: 8 }, uHeart: { value: .2 }, uTime: { value: 0 } });
// Cut crystal: the model is split into tall cells (the nearest point of a jittered grid in model space) and each cell
// is one facet with its own tilt and its own brightness. vAxis is the crystal's upright axis (world x, z) and radius.
const CRYSTAL_GLSL = `varying vec3 vCrystalP; varying vec3 vAxis; uniform float uFacet; uniform float uTime;
vec3 cHash( vec3 p ) { p = fract( p * vec3( .1031, .103, .0973 ) ); p += dot( p, p.yxz + 33.33 ); return fract( ( p.xxy + p.yxx ) * p.zyx ); }
// xyz names the cell; w is small near the edge between two cells.
vec4 crystalCell( vec3 q ) { vec3 b = floor( q ), id = b; float d1 = 9., d2 = 9.;
  for ( int z = -1; z <= 1; z ++ ) for ( int y = -1; y <= 1; y ++ ) for ( int x = -1; x <= 1; x ++ ) { vec3 c = b + vec3( x, y, z ), d = q - c - cHash( c ); float e = dot( d, d ); if ( e < d1 ) { d2 = d1; d1 = e; id = c; } else if ( e < d2 ) d2 = e; }
  return vec4( id, sqrt( d2 ) - sqrt( d1 ) ); }`;
// One uniforms object can drive every material of a unit (body and weapons). see: the unit takes the see-through tubes.
// crystal: the tinted part is cut crystal (towers and cores): facets, a bright heart, darker edges, a rim, sun glints
// and a slow shimmer.
export function unitMaterial(source, uniforms = unitUniforms(), key = 'unit', { see = false, crystal = false } = {}) {
  const m = source.clone();
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    if (see) { withWorld(shader); Object.assign(shader.uniforms, seeUniforms); }
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\nvarying vec3 vObjP;${crystal ? ' varying vec3 vCrystalP; varying vec3 vAxis; uniform float uHeart;' : ''}`).replace('#include <project_vertex>', `#include <project_vertex>\nvObjP = ( modelMatrix * vec4( transformed, 1. ) ).xyz;${crystal ? ' vCrystalP = transformed; vAxis = vec3( modelMatrix[ 3 ].xz, uHeart * length( modelMatrix[ 0 ].xyz ) );' : ''}`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vObjP; ${DISSOLVE_NOISE} ${see ? SEE_GLSL : ''} ${crystal ? CRYSTAL_GLSL : ''}
      uniform vec3 uRim; uniform float uRimPower; uniform float uFlash; uniform float uFade; uniform vec3 uTint; uniform float uTintOn; uniform vec2 uTintRange; uniform float uTintGlow; uniform float uTintLevel;
      uniform float uDissolve; uniform float uNoiseScale; uniform float uDissolveBase; uniform vec3 uDissolveColor;`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      ${see ? 'seeThrough( vWorldP );' : ''}
      if ( uFade < .999 ) { float d = fract( dot( floor( gl_FragCoord.xy ), vec2( .7548777, .5698403 ) ) ); if ( d > uFade ) discard; }
      float burn = 0.;
      if ( uDissolve > 0. ) { vec3 q = vec3( vObjP.x, vObjP.y - uDissolveBase, vObjP.z ) * uNoiseScale; float n = dNoise( q ) * .38 + dNoise( q * 2.9 ) * .17 + ( 1. - clamp( q.y / 10., 0., 1. ) ) * .45, edge = uDissolve * 1.12 - .06;
        if ( n < edge ) discard; burn = 1. - smoothstep( 0., .07, n - edge ); }`)
      // Tabards and cloth: bright, low-saturation texels take the team colour (a minion's off-white tabard).
      // A tower's pale crystal uses the same rule with a higher threshold, and also glows.
      .replace('#include <map_fragment>', `#include <map_fragment>
      float tintMask = 0.;
      if ( uTintOn > .5 ) { vec3 c = diffuseColor.rgb; float hi = max( c.r, max( c.g, c.b ) ), lo = min( c.r, min( c.g, c.b ) );
        // Judged in a rough sRGB space (square root), where 'pale' and 'greyish' mean what an artist means.
        vec3 g = sqrt( max( c, vec3( 0. ) ) ); float gh = max( g.r, max( g.g, g.b ) ), gl = min( g.r, min( g.g, g.b ) );
        tintMask = smoothstep( uTintRange.x, uTintRange.y, gh ) * ( 1. - smoothstep( .1, .26, gh - gl ) );
        ${crystal ? 'tintMask = max( tintMask, smoothstep( uTintRange.x - .22, uTintRange.y - .2, gh ) * smoothstep( .03, .09, g.b - g.r ) ); // a crystal may also be blue' : ''}
        diffuseColor.rgb = mix( c, uTint * ( .35 + hi * .6 ) * uTintLevel, tintMask * ( uTintGlow > 0. ? 1. : .85 ) ); }`)
      // A crystal is never metal: a metallic crystal mirrors the bright sky and turns white.
      // Crystals are also the glossy texels of a structure's roughness map (some are pale blue, not grey).
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      #ifdef USE_ROUGHNESSMAP
      if ( uTintGlow > 0. ) { float gloss = 1. - smoothstep( .25, .5, texelRoughness.g );
        if ( gloss > tintMask ) { float hi = max( diffuseColor.r, max( diffuseColor.g, diffuseColor.b ) ); diffuseColor.rgb = mix( diffuseColor.rgb, uTint * ( .35 + hi * .6 ) * uTintLevel, gloss - tintMask ); tintMask = gloss; } }
      #endif
      roughnessFactor = mix( roughnessFactor, .5, tintMask );`)
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= 1. - tintMask;')
      // Facets: the face normal of the mesh, tilted per cell, so each facet catches the light its own way.
      .replace('#include <normal_fragment_maps>', crystal ? `#include <normal_fragment_maps>
      vec3 cFlat = normalize( cross( dFdx( vViewPosition ), dFdy( vViewPosition ) ) ); float cRand = .5, cEdge = 0.;
      if ( tintMask > .01 ) { vec4 cell = crystalCell( vCrystalP * uFacet * vec3( 1., .4, 1. ) ); vec3 h = cHash( cell.xyz ), vd = normalize( vViewPosition ); cRand = h.y; cEdge = 1. - smoothstep( .0, .1, cell.w );
        vec3 fn = normalize( mix( nonPerturbedNormal, cFlat, .6 ) + ( viewMatrix * vec4( h * 2. - 1., 0. ) ).xyz * .5 );
        fn = normalize( fn + vd * max( 0., .2 - dot( fn, vd ) ) ); normal = normalize( mix( normal, fn, tintMask ) ); }` : '#include <normal_fragment_maps>')
      .replace('#include <tonemapping_fragment>', `
      { vec3 vd = normalize( vViewPosition ); float rim = pow( 1. - clamp( dot( normal, vd ), 0., 1. ), 2.6 );
        gl_FragColor.rgb += uRim * rim * uRimPower + vec3( uFlash ) + uDissolveColor * burn * 2.2;
        ${crystal ? `
        // Cut crystal: a bright heart that fades to darker edges, a light rim on the outline, a slow shimmer, and small
        // glints where a facet turns to the sun. Each facet has its own brightness. The heart is brightest where the line
        // of sight passes close to the crystal's axis.
        if ( tintMask > .01 ) { vec3 rd = normalize( vObjP - cameraPosition ); vec2 ap = vObjP.xz - vAxis.xy;
          float nv = clamp( dot( nonPerturbedNormal, vd ), 0., 1. ), heart = pow( 1. - clamp( abs( ap.x * rd.z - ap.y * rd.x ) / max( length( rd.xz ), .001 ) / vAxis.z, 0., 1. ), 1.5 ), glint = 0.;
          float shimmer = .65 + .7 * dNoise( vCrystalP * uFacet * .7 + vec3( 0., - uTime * .45, uTime * .25 ) ), rim = pow( smoothstep( .55, 1., 1. - nv ), 2. );
          #if NUM_DIR_LIGHTS > 0
          glint = pow( max( dot( normal, normalize( directionalLights[ 0 ].direction + vd ) ), 0. ), 50. ) * smoothstep( 0., .03, dot( reflectedLight.directSpecular, vec3( .3, .5, .2 ) ) );
          #endif
          // Reflections take the crystal's colour too, so the sky does not turn it pale.
          vec3 spec = reflectedLight.directSpecular + reflectedLight.indirectSpecular, tint = uTint / max( uTint.r, max( uTint.g, uTint.b ) );
          vec3 c = ( gl_FragColor.rgb - spec * ( 1. - tint ) * .7 ) * ( .3 + .7 * heart ) + uTint * uTintGlow * ( .06 + 1.2 * heart ) * ( .35 + 1.1 * cRand ) * shimmer
            + mix( uTint, vec3( 1., .92, .85 ), .3 ) * uTintGlow * heart * heart * heart * .5 * shimmer // the hot middle of the heart
            + mix( uTint, vec3( 1. ), .35 ) * ( rim * .6 + cEdge * .08 ) + mix( uTint, vec3( 1. ), .5 ) * glint * 1.2;
          // A soft shoulder keeps the brightest channel below the point where tone mapping turns it white.
          float peak = max( c.r, max( c.g, c.b ) ); c *= peak > .45 ? ( .45 + .4 * ( 1. - exp( ( .45 - peak ) / .4 ) ) ) / peak : 1.;
          gl_FragColor.rgb = mix( gl_FragColor.rgb, c, tintMask ); }` : `
        // The crystal glow: saturated, and smaller where the lit surface is already bright, so it never clips to white.
        float lit = dot( gl_FragColor.rgb, vec3( .3, .5, .2 ) ); gl_FragColor.rgb += uTint * tintMask * uTintGlow * ( 1. - .6 * smoothstep( .3, 1.4, lit ) );`} }
      #include <tonemapping_fragment>`);
  };
  m.customProgramCacheKey = () => key + (see ? '-see' : '') + (crystal ? '-crystal' : '');
  m.userData.uniforms = uniforms;
  return m;
}
