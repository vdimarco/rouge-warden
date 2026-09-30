import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
await build({entryPoints:['main.tsx'],bundle:true,minify:true,format:'esm',target:'es2022',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},outfile:'../../public/olympus/game.js'});
execFileSync(process.execPath,['node_modules/@tailwindcss/cli/dist/index.mjs','-i','style.css','-o','../../public/olympus/game.css','--minify'],{stdio:'inherit'});
