// Every pair of shader sources that Ink Studio's renderer can make, from a copy of the renderer (public/lab/gloam-downs/ink/).
// vendor.mjs and qa/lab/gloam-downs-uniform-blocks.test.mjs use it to check the uniform block rewrite without a browser.
// The 'simple' resolve in renderer.mjs is not here: renderer.mjs does not export it. It is the resolve (POST_FS) with parts removed.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

export async function inkPrograms(dir) {
  // pixel-look.js is a classic script that defines PixelLook
  const PixelLook = vm.runInNewContext(fs.readFileSync(path.join(dir, 'pixel-look.js'), 'utf8') + '\n;PixelLook');
  const { splatShaderSources, pixelShaderSources } = await import(pathToFileURL(path.join(dir, 'webgl/shaders.mjs')).href);
  const { waterBackgroundShader } = await import(pathToFileURL(path.join(dir, 'webgl/water-optics.mjs')).href);
  const list = [];
  for (const water of [false, true]) {
    const w = water ? ' water' : '';
    const s = splatShaderSources(false, undefined, water ? { water: true } : {});
    list.push({ name: 'splat' + w, vertex: s.vertex, fragment: s.fragment });
    const x = pixelShaderSources(PixelLook, { water });
    for (const k of ['POST_FS', 'KEY_FS', 'CLEAN_FS', 'DAMP_FS', 'COPY_FS']) list.push({ name: k + w, vertex: x.POST_VS, fragment: x[k] });
    list.push({ name: 'sprites' + w, vertex: x.SPR_VS, fragment: x.SPR_FS });
  }
  list.push({ name: 'water background', vertex: pixelShaderSources(PixelLook).POST_VS, fragment: waterBackgroundShader });
  return list;
}
