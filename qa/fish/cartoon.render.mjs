// Serve public/ first, then run: node qa/fish/cartoon.render.mjs
// Checks the imported Higgsfield models, bend mapping, both styles, and asset failure.
import assert from 'node:assert/strict';
import {open, until} from './lib.mjs';
const {browser,page,errors}=await open({phone:false,query:'?debug',save:{input:'touch',artStyle:'ghibli'}});
try {
  await until(page,()=>!!window.FISH);
  const result=await page.evaluate(async()=>{
    const {cartoonModelsReady,cartoonGeometry}=await import('/fish/js/cartoon-models.js');
    const {Rod,Lure}=await import('/fish/js/world-gear.js');
    const T=await import('three');
    const names=['rod','lure_body','lure_blade','tree_pine_low','tree_pine_high','tree_leaf_low','tree_leaf_high','tree_far','cottage','loon'];
    const bounds=names.map(name=>{const g=cartoonGeometry(name);if(!g)return {name,missing:true};g.computeBoundingBox();const b=g.boundingBox;const out={name,triangles:g.attributes.position.count/3,size:b.getSize(new T.Vector3()).toArray(),finite:[...g.attributes.position.array,...g.attributes.normal.array].every(Number.isFinite)};g.dispose();return out;});
    const rod=new Rod(true), lure=new Lure(), original=rod.original.geometry, cartoon=rod.cartoon?.geometry;
    const poses=[];
    for(const bend of [0,.4,1]) {
      const tip=rod.pose(new T.Vector3(.28,1.45,-.05),new T.Vector3(0,.8,-.6),bend,new T.Vector3(-2,0,-12),new T.Vector3(0,2.2,.35),.002);
      let closest=Infinity;const p=rod.mesh.geometry.attributes.position;
      for(let i=0;i<p.count;i++) closest=Math.min(closest,new T.Vector3().fromBufferAttribute(p,i).distanceTo(tip));
      poses.push({tip:tip.toArray(),finite:[...p.array].every(Number.isFinite),nearestGuide:closest});
    }
    rod.setArtStyle('original');lure.setArtStyle('original');const restored=rod.mesh.geometry===original&&lure.body.geometry===lure.original.body;
    rod.setArtStyle('ghibli');lure.setArtStyle('ghibli');const selected=rod.mesh.geometry===cartoon&&lure.body.geometry===lure.cartoon.body&&lure.blade.material===lure.cartoon.material;
    return {ready:cartoonModelsReady(),bounds,poses,restored,selected};
  });
  assert.ok(result.ready,'Higgsfield GLB loaded');
  for(const b of result.bounds){assert.ok(!b.missing&&b.finite&&b.triangles>0,b.name);if(b.name.startsWith('tree'))assert.ok(b.size[1]<1.2,b.name+' uses local coordinates');}
  assert.ok(result.bounds.find(b=>b.name==='rod').size[0]<2.8,'rod remains metre-scale');
  assert.ok(result.restored&&result.selected,'style switch restores and selects mesh and blade material');
  for(const p of result.poses){assert.ok(p.finite&&p.tip.every(Number.isFinite));assert.ok(p.nearestGuide<.04,'line tip remains at final guide');}
  assert.notDeepEqual(result.poses[0].tip,result.poses[2].tip,'rod bends under load');
  console.log('PASS: ten imported assets, finite geometry, metre scale, bending, guide attachment, Original restore');
  await page.click('#freeBtn');await until(page,()=>FISH.G.phase==='cast');
  await page.evaluate(()=>{FISH.world.setArtStyle('original');FISH.world.update(0);FISH.world.render();FISH.world.setArtStyle('ghibli');FISH.world.update(0);FISH.world.render();});
  const before=await page.evaluate(()=>FISH.world.info().mem);
  await page.evaluate(()=>{for(let i=0;i<12;i++){for(const style of ['original','ghibli']){FISH.world.setArtStyle(style);FISH.world.update(0);FISH.world.render();}}});
  const after=await page.evaluate(()=>FISH.world.info().mem);
  assert.ok(after.geometries<=before.geometries&&after.textures<=before.textures,'no resource growth with rendered switches');
  await page.route('**/cartoon-models.glb',r=>r.abort());
  await page.reload();await until(page,()=>!!window.FISH);
  assert.equal(await page.evaluate(async()=>(await import('/fish/js/cartoon-models.js')).cartoonModelsReady()),false);
  await page.click('#freeBtn');await until(page,()=>FISH.G.phase==='cast');
  assert.deepEqual(errors,[]);
  console.log('PASS: rendered switching, asset-failure fallback, free fishing, no application or shader errors');
} finally {await browser.close();}
