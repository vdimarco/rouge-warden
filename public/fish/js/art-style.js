// The default art is a cartoon. Explicit Original selections remain available.
export const artStyle = { value: 1 };
export const normalizeStyle = (style) => style === "original" ? "original" : "ghibli";

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
        // Broad areas of paint, with an ink rim. Hue and the underwater tint survive.
        float base = max(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.035);
        float light = max(dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722)), 0.001);
        float level = light / base;
        float band = level < 0.5 ? 0.43 : level < 0.92 ? 0.76 : 1.12;
        vec3 cel = outgoingLight * mix(1.0, band / max(level, 0.08), 0.92);
        float edge = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
        cel = mix(cel, vec3(0.09, 0.17, 0.14), smoothstep(0.73, 0.90, edge) * 0.65);
        outgoingLight = cel * vec3(1.05, 1.03, 0.94);
      }
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => cacheKey + "_cartoon_v2_" + !!material.userData.storyMorph + "_" + !!material.userData.storyMap;
  return material;
}
