import * as THREE from 'three';

// Four hard light bands keep generated textures readable on a phone.
const ramp = new THREE.DataTexture(new Uint8Array([72, 130, 205, 255]), 4, 1, THREE.RedFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
ramp.generateMipmaps = false; ramp.needsUpdate = true;
export function toonMaterial(color, options = {}) {
  const { roughness, metalness, ...rest } = options;
  return new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...rest });
}
export function toonModel(original) {
  const material = toonMaterial(original.color?.clone() || '#ffffff', {
    map: original.map, side: original.side, alphaTest: original.alphaTest,
    transparent: original.transparent, opacity: original.opacity,
    emissive: '#ffffff', emissiveMap: original.map,
    emissiveIntensity: .12,
  });
  // Generated GLBs have baked photographic shadows. Lift those into the flat
  // cartoon palette without washing out the independent ground textures.
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(0.68));');
  };
  material.customProgramCacheKey = () => 'toon-albedo-v1';
  return material;
}

// One depth-edge pass gives every animated mesh a stable ink silhouette without
// duplicating geometry or doubling the hero/scenery draw calls.
export class InkPass {
  constructor(gl) {
    this.gl = gl;
    this.target = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
    this.uniforms = { frame: { value: this.target.texture }, depth: { value: this.target.depthTexture }, pixel: { value: new THREE.Vector2(1, 1) } };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 uvInk; void main(){ uvInk=uv; gl_Position=vec4(position.xy,0.0,1.0); }',
      fragmentShader: `varying vec2 uvInk; uniform sampler2D frame; uniform sampler2D depth; uniform vec2 pixel;
        void main(){
          vec3 color=texture2D(frame,uvInk).rgb;
          float center=texture2D(depth,uvInk).x;
          float edge=0.0;
          for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++){
            float neighbor=texture2D(depth,uvInk+vec2(float(x),float(y))*pixel).x;
            edge=max(edge,abs(center-neighbor));
          }
          float ink=smoothstep(0.00065,0.00165,edge);
          color=mix(color,vec3(0.012,0.018,0.027),ink*0.92);
          gl_FragColor=vec4(color,1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.scene = new THREE.Scene(); this.camera = new THREE.Camera();
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
  }
  resize(width, height) { this.target.setSize(width, height); this.uniforms.pixel.value.set(1.25 / width, 1.25 / height); }
  render(scene, camera) {
    this.gl.setRenderTarget(this.target); this.gl.render(scene, camera);
    this.sceneCalls = this.gl.info.render.calls; this.sceneTriangles = this.gl.info.render.triangles;
    this.gl.setRenderTarget(null); this.gl.render(this.scene, this.camera);
  }
}
