// The default art is painted: cartoon models and painted skies. Explicit Original selections remain available.
// Any other value is the painted style, so a save that holds the style's old name keeps its look.
export const artStyle = { value: 1 };
export const normalizeStyle = (style) => style === "original" ? "original" : "painted";

// Keep the existing wind, swimming and water tint while changing the drawing style.
export function storyMaterial(material) {
  const compile = material.onBeforeCompile;
  const cacheKey = material.customProgramCacheKey();
  material.onBeforeCompile = function (shader, renderer) {
    compile.call(this, shader, renderer);
    shader.uniforms.uArtStyle = artStyle;
    if (this.userData.storyMorph) {
      shader.vertexShader = "uniform float uArtStyle; attribute vec3 storyPosition, storyNormal;\n" + shader.vertexShader
        .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed = mix(transformed, storyPosition, uArtStyle);")
        .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\nobjectNormal = normalize(mix(objectNormal, storyNormal, uArtStyle));");
    }
    if (this.userData.storyMap) {
      shader.uniforms.uStoryMap = { value: this.userData.storyMap };
      shader.fragmentShader = "uniform sampler2D uStoryMap;\n" + shader.fragmentShader.replace("#include <map_fragment>", `
        if (uArtStyle < 0.5) {
          #include <map_fragment>
        } else {
          diffuseColor *= texture2D(uStoryMap, vMapUv);
        }`);
    }
    shader.fragmentShader = "uniform float uArtStyle;\n" + shader.fragmentShader
      .replace("#include <specularmap_fragment>", "#include <specularmap_fragment>\nspecularStrength *= 1.0 - uArtStyle * 0.97;")
      .replace("#include <opaque_fragment>", `
      if (uArtStyle > 0.5) {
        // Soft cel paint. Coloured shadows keep the props inside the illustration.
        float base = max(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.035);
        float light = max(dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722)), 0.001);
        float level = light / base;
        float band = smoothstep(.52, .62, level) * .35 + smoothstep(1.05, 1.15, level) * .15;
        vec3 shade = mix(vec3(.61, .76, .75), vec3(1.15, 1.12, 1.02), band + .35);
        vec3 cel = diffuseColor.rgb * shade * clamp(level / .50, .12, 1.0);
        float edge = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
        cel *= 1.0 - smoothstep(.93, .99, edge) * .22;
        outgoingLight = mix(outgoingLight, cel, .94);
      }
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => cacheKey + "_painted_film_v3_" + !!material.userData.storyMorph + "_" + !!material.userData.storyMap;
  return material;
}
