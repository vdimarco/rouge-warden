// Loads the real 3D district in Node: real three.js scene and vector math, with a stand-in for the GPU renderer.
// It sets up the few browser globals that district.js and viewport.js use.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
export const root=fileURLToPath(new URL('../../',import.meta.url)).replace(/\/$/,'');
export const listeners={};
export async function loadDistrict(){
  const elements=new Map();const el=id=>{if(!elements.has(id))elements.set(id,{style:{setProperty(){}},dataset:{},addEventListener(){},setPointerCapture(){},prepend(){},getBoundingClientRect:()=>({left:0,top:0,width:104,height:104})});return elements.get(id)};
  globalThis.innerWidth=390;globalThis.innerHeight=844;globalThis.devicePixelRatio=1;globalThis.window=globalThis;globalThis.screen={orientation:{angle:0}};
  // The texture loader asks for an image element. This one never loads, so the scene keeps its plain colours.
  globalThis.document={body:{prepend(){}},getElementById:el,createElement:()=>({getContext:()=>new Proxy({},{get:()=>()=>{}})}),createElementNS:()=>({addEventListener(){},removeEventListener(){}})};
  globalThis.addEventListener=(n,f)=>(listeners[n]??=[]).push(f);
  let src=fs.readFileSync(root+'/public/neon/district.js','utf8');
  src=src.replace("import * as THREE from '../crimson/lib/three.module.min.js';",`import * as Real from 'file://${root}/public/crimson/lib/three.module.min.js';const THREE={...Real,WebGLRenderer:class{constructor(){this.domElement={}}setPixelRatio(){}setSize(){}render(s,c){s.updateMatrixWorld();c.updateMatrixWorld()}}};`);
  // A data: URL cannot resolve relative imports, so they point at the files on disk.
  src=src.replace(/from '\.\/([\w-]+\.js)'/g,`from 'file://${root}/public/neon/$1'`);
  return (await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'))).District;
}
