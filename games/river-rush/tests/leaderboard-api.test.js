import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const handler=require('../../../api/river-rush-leaderboard.js');

const RUN='169a1832-7de3-43f9-aee6-07ca4f64421e';
const valid=()=>({name:'River Rider',score:22040,coins:210,levelsCleared:2,levelIndex:2,distance:4701,runId:RUN});
const stored=(extra={})=>({name:'River Rider',score:22040,coins:210,levels_cleared:2,level_index:2,distance:4701,created_at:'2026-10-07T13:00:00.000Z',...extra});
const reply=(rows,ok=true)=>({ok,json:async()=>rows});
function setup(t,fetcher=async()=>reply([])){
 const before={fetch:globalThis.fetch,url:process.env.RIVER_RUSH_SUPABASE_URL,key:process.env.RIVER_RUSH_SUPABASE_KEY};
 process.env.RIVER_RUSH_SUPABASE_URL='https://river-test.supabase.co';
 process.env.RIVER_RUSH_SUPABASE_KEY='sb_publishable_test_key';
 globalThis.fetch=fetcher;
 t.after(()=>{globalThis.fetch=before.fetch;for(const [name,value] of [['RIVER_RUSH_SUPABASE_URL',before.url],['RIVER_RUSH_SUPABASE_KEY',before.key]]){if(value===undefined)delete process.env[name];else process.env[name]=value;}});
}
async function call(method,body,headers={}){
 const response={headers:{},statusCode:null,payload:null,setHeader(name,value){this.headers[name]=value;},status(code){this.statusCode=code;return this;},json(value){this.payload=value;return this;},end(){return this;}};
 await handler({method,body,headers},response);return response;
}

test('public GET requests only twenty rows in stable score order and strips database-only fields',async t=>{
 let query,options;
 setup(t,async(url,init)=>{query=new URL(url);options=init;return reply([stored({id:'private-id',run_id:RUN}),stored({name:'Álvaro',score:20100})]);});
 const r=await call('GET');
 assert.equal(r.statusCode,200);assert.equal(r.headers['Access-Control-Allow-Origin'],'*');assert.equal(r.headers['Cache-Control'],'no-store');
 assert.equal(query.pathname,'/rest/v1/river_rush_scores');assert.equal(query.searchParams.get('limit'),'20');
 assert.equal(query.searchParams.get('order'),'score.desc,levels_cleared.desc,distance.desc,created_at.asc,id.asc');
 assert.equal(options.headers.apikey,'sb_publishable_test_key');assert.equal(options.headers.Authorization,undefined);
 assert.deepEqual(r.payload.entries.map(e=>e.rank),[1,2]);assert.equal(r.payload.entries[1].name,'Álvaro');
 assert.deepEqual(Object.keys(r.payload.entries[0]),['rank','name','score','coins','levelsCleared','levelIndex','distance','createdAt']);
});

test('guest POST normalizes Unicode/spacing and inserts only allowed columns with a stable run UUID',async t=>{
 let inserted,query,options;
 setup(t,async(url,init)=>{if(init.method!=='POST')return reply([]);query=new URL(url);options=init;inserted=JSON.parse(init.body);return reply([stored({name:inserted.name})]);});
 const r=await call('POST',JSON.stringify({...valid(),name:'  Jose\u0301\t O\'Neil  '}));
 assert.equal(r.statusCode,201);assert.equal(r.payload.entry.name,"José O'Neil");assert.equal(query.searchParams.get('on_conflict'),'run_id');
 assert.equal(options.method,'POST');assert.equal(options.headers.Prefer,'resolution=ignore-duplicates,return=representation');
 assert.deepEqual(inserted,{name:"José O'Neil",score:22040,coins:210,levels_cleared:2,level_index:2,distance:4701,run_id:RUN});
 assert.ok(!('created_at' in inserted)&&!('id' in inserted));
});

test('missing run UUID is generated and names permit every documented display character',async t=>{
 let inserted;
 setup(t,async(_url,init)=>{inserted=JSON.parse(init.body);return reply([stored({name:inserted.name})]);});
 for(const name of ['小河7','Rider_4.2-X',"O'Neil"]){
  const body={...valid(),name};delete body.runId;const r=await call('POST',body);
  assert.equal(r.statusCode,201);assert.match(inserted.run_id,/^[0-9a-f-]{36}$/);assert.notEqual(inserted.run_id,RUN);
 }
});

test('invalid and oversized requests never reach public storage',async t=>{
 let calls=0;setup(t,async()=>{calls++;return reply([]);});
 const invalid=[null,[],false,'{bad json',{}, {...valid(),name:''},{...valid(),name:' '.repeat(5)},{...valid(),name:'x'.repeat(21)},
  {...valid(),name:'<script>'},{...valid(),name:'River🚣'}, {...valid(),created_at:'2020-01-01'}, {...valid(),status:'won'},
  {...valid(),score:0},{...valid(),score:1000001},{...valid(),score:Infinity},{...valid(),score:'20000'}, {...valid(),score:1.5},
  {...valid(),coins:-1},{...valid(),coins:5001},{...valid(),levelsCleared:4},{...valid(),levelsCleared:3,levelIndex:1},
  {...valid(),levelIndex:3},{...valid(),distance:5401},{...valid(),distance:NaN},{...valid(),distance:1.5},{...valid(),runId:'not-uuid'},
  {...valid(),name:'x'.repeat(5000)}];
 for(const body of invalid){const r=await call('POST',body);assert.equal(r.statusCode,400,JSON.stringify(body));}
 assert.equal((await call('POST',valid(),{'content-length':'5000'})).statusCode,400);
 assert.equal(calls,0);
});

test('a matching duplicate run is successful without granting update permission',async t=>{
 const calls=[];
 setup(t,async(url,init)=>{calls.push({url:new URL(url),init});return reply(calls.length===1?[]:[stored()]);});
 const r=await call('POST',valid());assert.equal(r.statusCode,200);assert.equal(r.payload.duplicate,true);assert.equal(r.payload.entry.score,22040);
 assert.equal(calls.length,3);assert.equal(calls[0].init.method,'POST');assert.equal(calls[1].init.method,undefined);
 assert.equal(calls[1].url.searchParams.get('run_id'),`eq.${RUN}`);
});

test('an accepted score includes a fresh ranking and rank when it enters the top twenty',async t=>{
 const row=stored({id:'169a1832-7de3-43f9-aee6-07ca4f644299'});let calls=0;
 setup(t,async()=>reply(++calls===1?[row]:[stored({score:30000}),row]));
 const r=await call('POST',valid());assert.equal(r.statusCode,201);assert.equal(r.payload.submitted,true);
 assert.equal(r.payload.entry.rank,2);assert.equal(r.payload.entries.length,2);assert.equal(calls,2);
 assert.ok(!('id' in r.payload.entry));
});

test('ranking failure after accepted insertion still reports a successfully saved score',async t=>{
 let calls=0;setup(t,async()=>{if(++calls===1)return reply([stored()]);throw new Error('ranking is offline');});
 const r=await call('POST',valid());assert.equal(r.statusCode,201);assert.equal(r.payload.submitted,true);
 assert.equal(r.payload.entry.score,22040);assert.equal(r.payload.entries,undefined);assert.equal(calls,2);
});

test('reusing a run UUID for changed details returns a conflict',async t=>{
 let calls=0;setup(t,async()=>reply(++calls===1?[]:[stored({score:123})]));
 const r=await call('POST',valid());assert.equal(r.statusCode,409);assert.match(r.payload.error,/already been submitted/);
});

test('storage failures and malformed rows are retryable and never expose upstream secrets',async t=>{
 const failures=[async()=>{throw new Error('secret internal connection');},async()=>reply({message:'secret database policy'},false),async()=>reply({wrong:true}),async()=>reply([stored({score:Infinity})]),async()=>reply([stored({created_at:'bad'})]),async()=>reply(Array.from({length:21},()=>stored()))];
 setup(t);
 for(const fetcher of failures){globalThis.fetch=fetcher;const r=await call('GET');assert.equal(r.statusCode,503);assert.match(r.payload.error,/try again/i);assert.ok(!JSON.stringify(r.payload).includes('secret'));}
 globalThis.fetch=async()=>reply(null);assert.equal((await call('POST',valid())).statusCode,503);
});

test('unconfigured and privileged-key deployments cannot use storage',async t=>{
 let calls=0;setup(t,async()=>{calls++;return reply([]);});
 delete process.env.RIVER_RUSH_SUPABASE_KEY;assert.equal((await call('GET')).statusCode,503);
 process.env.RIVER_RUSH_SUPABASE_KEY='sb_secret_do_not_use';assert.equal((await call('GET')).statusCode,503);
 const encode=claims=>`eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
 process.env.RIVER_RUSH_SUPABASE_KEY=encode({role:'service_role'});assert.equal((await call('GET')).statusCode,503);
 process.env.RIVER_RUSH_SUPABASE_KEY=encode({role:'anon'});assert.equal((await call('GET')).statusCode,200);assert.equal(calls,1);
});

test('preflight and unsupported methods do not contact the database',async t=>{
 let calls=0;setup(t,async()=>{calls++;return reply([]);});
 const preflight=await call('OPTIONS');assert.equal(preflight.statusCode,204);assert.equal(preflight.headers['Access-Control-Allow-Methods'],'GET, POST, OPTIONS');
 const bad=await call('DELETE');assert.equal(bad.statusCode,405);assert.equal(bad.headers.Allow,'GET, POST, OPTIONS');assert.equal(calls,0);
});

test('a stalled storage request is aborted after the bounded six-second deadline',async t=>{
 let signal;
 setup(t,async(_url,init)=>{signal=init.signal;return await new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));});
 t.mock.timers.enable({apis:['setTimeout']});
 const request=call('GET');assert.equal(signal.aborted,false);t.mock.timers.tick(6000);
 const r=await request;assert.equal(signal.aborted,true);assert.equal(r.statusCode,503);
});
