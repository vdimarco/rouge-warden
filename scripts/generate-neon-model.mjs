// Run from repository root with FOUROFOUR_API_KEY set in the server environment.
// A fixed job file prevents resubmission. Poll by rerunning without --submit.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const specs={ronin:'One full-body cyber samurai guard, refined hand-painted animated-film aesthetic, layered midnight blue lamellar armour, cream cloth and brass trim, jade luminous visor, expressive angular helmet, weathered textured surfaces, empty hands, no weapons, relaxed standing pose, isolated single game-ready character, mesh with PBR textures, no floor or background.',gate:'One modular cyberpunk Japanese market gateway with curved ceramic tiled roof, carved wooden pillars, brass mechanical joints, warm paper lanterns, jade neon trim and moss vines, large clear walk-through opening in center, hand-painted animated-film aesthetic, isolated game-ready prop, no ground or background.'};
const id=process.argv.find(a=>a.startsWith('--asset='))?.split('=')[1]||'ronin';if(!specs[id])throw Error('Choose --asset=ronin or --asset=gate');
const key=process.env.FOUROFOUR_API_KEY?.trim();if(!key)throw Error('Set FOUROFOUR_API_KEY in the server environment. No generation submitted.');
const dir='public/neon/models',jobFile=`${dir}/${id}.job.json`;await mkdir(dir,{recursive:true});let job;try{job=JSON.parse(await readFile(jobFile,'utf8'))}catch{}
const base='https://api.dns.404.xyz',headers={'x-api-key':key,'x-client-origin':'neon-ronin'};
if(!job){
 if(!process.argv.includes('--submit'))throw Error('No saved job. Use --submit once to start this asset.');
 // Record intent first. If the response is lost, do not blindly charge a second job.
 await writeFile(jobFile,JSON.stringify({asset:id,status:'submission-unknown'}));
 const r=await fetch(`${base}/add_task`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({prompt:specs[id],model:'404-mesh',seed:1709}),signal:AbortSignal.timeout(45000)});
 if(!r.ok)throw Error(`404 Gen submission HTTP ${r.status}. Check the provider before resubmitting.`);
 const result=await r.json();if(typeof result.id!=='string')throw Error('Provider returned no task ID; verify the job before retrying.');
 job={asset:id,taskId:result.id,status:'pending'};await writeFile(jobFile,JSON.stringify(job));console.log(`Saved ${id} task ${job.taskId}`);
}
if(!job.taskId)throw Error('Previous submission outcome is unknown. Recover its task ID before resuming.');
const r=await fetch(`${base}/get_status?id=${encodeURIComponent(job.taskId)}`,{headers,signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`Status HTTP ${r.status}; existing task preserved.`);const status=await r.json();
if(status.status!=='Success'){console.log(`${id}: ${status.status}. Rerun without --submit to check the same task.`);process.exit(status.status==='Failure'?1:0)}
const result=await fetch(`${base}/get_result?id=${encodeURIComponent(job.taskId)}`,{headers,signal:AbortSignal.timeout(90000)});if(!result.ok)throw Error(`Result HTTP ${result.status}`);const bytes=Buffer.from(await result.arrayBuffer());if(bytes.length>12*1024*1024||bytes.subarray(0,4).toString()!=='glTF')throw Error('Model needs optimization or is not GLB; existing task preserved.');
await writeFile(`${dir}/${id}.glb`,bytes);let manifest={provider:'404-gen',assets:[]};try{manifest=JSON.parse(await readFile(`${dir}/manifest.json`,'utf8'))}catch{}
manifest.assets=manifest.assets.filter(a=>a.id!==id);manifest.assets.push({id,status:'ready',taskId:job.taskId,url:`./models/${id}.glb`,bytes:bytes.length});await writeFile(`${dir}/manifest.json`,JSON.stringify(manifest,null,2));console.log(`${id} ready (${bytes.length} bytes). Review orientation and optimize before publishing.`);
