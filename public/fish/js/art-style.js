// One uniform changes the art without rebuilding meshes or restarting a cast.
export const artStyle = { value: 0 };
export const normalizeStyle = (style) => style === "ghibli" ? "ghibli" : "original";

// Wrap the existing paint/fish shader so wind, swimming and underwater tint remain active.
export function storyMaterial(material) {
  const compile = material.onBeforeCompile;
  const cacheKey = material.customProgramCacheKey();
  material.onBeforeCompile = function (shader, renderer) {
    compile.call(this, shader, renderer);
    shader.uniforms.uArtStyle = artStyle;
    shader.fragmentShader = "uniform float uArtStyle;\n" + shader.fragmentShader.replace("#include <opaque_fragment>", `
      if (uArtStyle > 0.5) {
        // Soft cel bands keep species markings and bright fishing cues readable.
        float light = max(dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722)), 0.001);
        float bands = floor(light * 5.0) / 5.0 + 0.1;
        vec3 cel = outgoingLight * mix(1.0, bands / light, 0.42);
        cel = mix(cel * vec3(0.86, 1.02, 1.06), cel * vec3(1.04, 1.02, 0.91), smoothstep(0.12, 0.85, light));
        outgoingLight = cel;
      }
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => cacheKey + "_story_v1";
  return material;
}
