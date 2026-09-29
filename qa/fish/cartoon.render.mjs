// Serve public/ first, then run: node qa/fish/cartoon.render.mjs
// Checks the imported models, painted forest, bend mapping, style switching, and asset failure.
import assert from 'node:assert/strict';
import {open, until} from './lib.mjs';
const {browser,page,errors}=await open({phone:false,query:'?debug',save:{input:'touch',artStyle:'ghibli'}});
try {
  await until(page,()=>!!window.FISH);
  const forest = await page.evaluate(() => {
    const layers = [];
    FISH.world.scene.traverse(o => {
      if (o.userData.paintedForest) layers.push({kind:o.userData.paintedForest,count:o.count,vertices:o.geometry.attributes.position.count,cells:[...o.geometry.attributes.paintCell.array]});
    });
    return layers;
  });
  assert.equal(forest.length,3,'near, broadleaf and distant painted forest layers');
  assert.equal(await page.evaluate(async()=>(await import('/fish/js/world-env.js')).U.uWaterPaintReady.value),1,'painted water texture loaded');
  for(const layer of forest){assert.ok(layer.count>0);assert.equal(layer.vertices,4,'one quad per painted tree');assert.ok(layer.cells.every(n=>Number.isFinite(n)&&n>=0&&n<=1),'finite atlas coordinates');}
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
  // A late sky download can upload one texture during the switch loop. Count
  // only after all art has settled so this checks retained GPU resources.
  await page.evaluate(async()=>{await (await import('/fish/js/world-env.js')).loadStorySky();FISH.world.render();});
  await page.evaluate(()=>{FISH.world.setArtStyle('original');FISH.world.update(0);FISH.world.render();FISH.world.setArtStyle('ghibli');FISH.world.update(0);FISH.world.render();});
  const before=await page.evaluate(()=>FISH.world.info().mem);
  await page.evaluate(()=>{for(let i=0;i<12;i++){for(const style of ['original','ghibli']){FISH.world.setArtStyle(style);FISH.world.update(0);FISH.world.render();}}});
  const after=await page.evaluate(()=>FISH.world.info().mem);
  assert.ok(after.geometries<=before.geometries&&after.textures<=before.textures,'no resource growth with rendered switches: '+JSON.stringify({before,after}));
  await page.route('**/cartoon-models.glb',r=>r.abort());
  await page.route('**/painted-forest.webp',r=>r.abort());
  await page.route('**/painted-water.webp',r=>r.abort());
  await page.reload();await until(page,()=>!!window.FISH);
  assert.equal(await page.evaluate(async()=>(await import('/fish/js/cartoon-models.js')).cartoonModelsReady()),false);
  assert.equal(await page.evaluate(()=>{let n=0;FISH.world.scene.traverse(o=>{if(o.userData.paintedForest)n++;});return n;}),0,'failed forest image uses procedural fallback');
  assert.equal(await page.evaluate(async()=>(await import('/fish/js/world-env.js')).U.uWaterPaintReady.value),0,'failed water image uses shader fallback');
  await page.click('#freeBtn');await until(page,()=>FISH.G.phase==='cast');
  assert.deepEqual(errors,[]);
  console.log('PASS: rendered switching, asset-failure fallback, free fishing, no application or shader errors');
} finally {await browser.close();}
