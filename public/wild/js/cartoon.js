// Shared paint-and-cel treatment: the same light response on people, props and leaves.
import * as THREE from 'three';
let ramp;
export function cartoonRamp() {
  if (!ramp) {
    // Broad held tones with short soft transitions, rather than a metallic/PBR rolloff.
    const data=new Uint8Array(32*4);
    for(let i=0;i<32;i++) {
      const x=i/31;
      const smooth=(a,b)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
      const v=Math.round(255*(.23+.34*smooth(.34,.43)+.43*smooth(.69,.78)));
      data.set([v,v,v,255],i*4);
    }
    ramp=new THREE.DataTexture(data,32,1,THREE.RGBAFormat);
    ramp.minFilter=ramp.magFilter=THREE.LinearFilter;ramp.needsUpdate=true;
  }
  return ramp;
}
export function cartoonMaterial(options={}) {
  const m=new THREE.MeshToonMaterial({ ...options, gradientMap:cartoonRamp() });
  m.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      // Lift baked texture shading so the live light owns the form.
      diffuseColor.rgb = pow(max(diffuseColor.rgb,vec3(0.0)),vec3(0.82));`);
  };
  m.customProgramCacheKey=()=> 'cartoon-pigment-v1';
  return m;
}
