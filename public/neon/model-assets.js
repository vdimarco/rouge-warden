import * as THREE from '../crimson/lib/three.module.min.js';
import {GLTFLoader} from '../crimson/lib/addons/loaders/GLTFLoader.js';
// All media is generated offline and stored with the game. No provider keys or
// generation calls run on the device. A failed asset retains its playable fallback.
export async function loadDuelAssets(district){
  const response=await fetch('./models/manifest.json');if(!response.ok)return;
  const manifest=await response.json(),loader=new GLTFLoader();district.fighterModels??={};
  await Promise.all((manifest.assets||[]).map(async asset=>{
    if(asset.status!=='ready'||!['ronin','ronin-toon','grove','gate'].includes(asset.id)||asset.url!==`./models/${asset.id}.glb`)return;
    try{
      const response=await fetch(asset.url);if(!response.ok)throw Error('Model unavailable');const bytes=await response.arrayBuffer();if(bytes.byteLength>12*1024*1024)throw Error('Model exceeds tablet budget');
      const gltf=await loader.parseAsync(bytes,new URL('./models/',location.href).href);let triangles=0,meshes=0;
      gltf.scene.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;o.castShadow=false;o.receiveShadow=false;
        if(asset.id==='ronin-toon'||asset.id==='grove'){const convert=m=>new THREE.MeshToonMaterial({map:m.map,color:m.color,gradientMap:district.alienWorld.ramp,side:m.side,transparent:m.transparent,opacity:m.opacity});o.material=Array.isArray(o.material)?o.material.map(convert):convert(o.material)}
      }});
      if(triangles>90000||meshes>64)throw Error('Model needs optimization');
      const box=new THREE.Box3().setFromObject(gltf.scene),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());if(!Number.isFinite(size.y)||size.y<=0)throw Error('Empty model');
      const root=new THREE.Group();root.add(gltf.scene);const height=asset.id==='grove'?6:asset.id==='gate'?5:2,scale=height/size.y;gltf.scene.scale.setScalar(scale);gltf.scene.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);
      if(asset.id.startsWith('ronin')){district.fighterModels[asset.id]=root;district.applyFighterModels()}
      else if(asset.id==='grove')district.alienWorld.installGrove(root);
      else{root.position.set(0,0,-21);district.scene.add(root)}
      district.modelStatus='ready';
    }catch(error){district.modelStatus='unavailable';console.warn('Neon model kept its fallback:',asset.id,error.message)}
  }));
}
