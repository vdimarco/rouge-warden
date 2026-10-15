const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
function tracker({host='arcade.uptick.systems', storageFails=false, game='fish'}={}) {
  let now=0, visible='visible', focus=true, switched=false;
  const callbacks={}, timers=[], events=[], saved={};
  const document={currentScript:{dataset:{game}},get visibilityState(){return visible;},hasFocus:()=>focus,addEventListener:(n,f)=>{(callbacks[n] ||= []).push(f);}};
  const window={GameSwitch:{GAMES:[{id:'fish'}],get isOpen(){return switched;}},addEventListener:document.addEventListener};
  const ctx={document,window,location:{hostname:host},performance:{now:()=>now},Date,crypto:require('node:crypto'),localStorage:{getItem:k=>{if(storageFails)throw Error();return saved[k];},setItem:(k,v)=>{if(storageFails)throw Error();saved[k]=v;}},navigator:{getGamepads:()=>[]},setInterval:f=>timers.push(f),fetch:async(_,o)=>{events.push(JSON.parse(o.body));return {ok:true};}};
  vm.runInNewContext(fs.readFileSync('public/arcade/analytics.js','utf8'),ctx);
  const fire=(n,e={})=>(callbacks[n] || []).forEach(f=>f({isTrusted:true,type:n,target:{closest:()=>null},...e}));
  return {events,api:window.ArcadeAnalytics,fire,advance(seconds){for(let i=0;i<seconds;i++){now+=1000;timers.forEach(f=>f());}},hide(){visible='hidden';fire('visibilitychange');},show(){visible='visible';fire('visibilitychange');},blur(){focus=false;fire('blur');},switch(v){switched=v;},saved};
}
const t=tracker();assert.equal(t.events[0].event,'arcade_game_view');
t.fire('pointermove',{buttons:0});t.fire('keydown',{key:'Tab'});t.fire('keydown',{key:'a',isTrusted:false});t.fire('pointerdown',{target:{closest:()=>({})}});assert.equal(t.events.length,1);
t.fire('keydown',{key:'a'});t.fire('pointerdown');assert.equal(t.events.filter(e=>e.event==='arcade_game_play').length,1);
t.advance(45);assert.equal(t.events.filter(e=>e.event==='arcade_active_time').reduce((n,e)=>n+e.properties.active_seconds,0),30);
t.hide();t.advance(60);t.show();t.fire('pointerdown');t.advance(15);t.blur();t.advance(60);assert.equal(t.events.filter(e=>e.event==='arcade_active_time').reduce((n,e)=>n+e.properties.active_seconds,0),45);
assert.equal(t.api.likedAt('fish'),null);assert.equal(t.api.like('fish'),true);assert.ok(t.api.likedAt('fish')>0);assert.ok(JSON.parse(t.saved['arcade-like-times']).fish>0);assert.equal(t.api.like('fish'),false);assert.equal(t.api.like('unknown'),false);assert.equal(t.events.filter(e=>e.event==='arcade_game_like').length,1);
for(const e of t.events){assert.equal(e.properties.app,'cottage_arcade');assert.equal(e.properties.environment,'production');assert.equal(e.properties.game_id,'fish');assert.equal(e.properties.$process_person_profile,false);assert.equal(e.properties.$current_url,undefined);}
const preview=tracker({host:'warden-preview.vercel.app'});preview.fire('pointerdown');preview.advance(45);assert.equal(preview.api.like('fish'),false);assert.equal(preview.events.length,0);
const noStorage=tracker({storageFails:true});noStorage.fire('pointerdown');assert.equal(noStorage.events.length,2);
const paused=tracker();paused.fire('pointerdown');paused.switch(true);paused.advance(30);paused.fire('pagehide');assert.equal(paused.events.filter(e=>e.event==='arcade_active_time').length,0);
console.log('PASS capture: views, one play, trusted controls, focus/visibility, idle cap, switch dialog, one-way likes, preview exclusion, storage failure');
const ctx={window:{},location:{pathname:'/fish/'},document:{readyState:'loading',addEventListener(){}},fetch:async()=>({ok:true}),localStorage:{getItem:()=>null},URLSearchParams};vm.runInNewContext(fs.readFileSync('public/arcade/switch.js','utf8'),ctx);const api=ctx.window.GameSwitch;
for(const game of api.GAMES)assert.ok(fs.readFileSync('public'+game.url+'index.html','utf8').includes(`data-game="${game.id}"`),game.id);
const sample={source:'posthog',days:30,updatedAt:new Date().toISOString(),games:{fish:{plays:12,views:90,likes:2,active_seconds:100},brawl:{plays:14,views:80,likes:5,active_seconds:90}}};assert.equal(api.validateMetrics(sample),sample);
assert.equal(api.rankGames(api.GAMES,sample.games,'featured').slice(0,6).map(g=>g.id).join(','),'fish,tidebreak,wild,vr,crimson,river-rush');
assert.equal(api.rankGames(api.GAMES,sample.games,'plays')[0].id,'brawl');assert.equal(api.rankGames(api.GAMES,sample.games,'views')[0].id,'fish');assert.equal(api.rankGames(api.GAMES,sample.games,'likes')[0].id,'brawl');assert.equal(api.rankGames(api.GAMES,sample.games,'active_seconds')[0].id,'fish');assert.deepEqual(api.rankGames(api.GAMES,{},'plays').map(g=>g.id),api.GAMES.map(g=>g.id));
function legacyRank(games, data, key) {
  const FEATURED = ['fish','tidebreak','wild','vr','crimson','river-rush'];
  return [...games].sort((a,b) => {
    if (key === 'featured') {
      const priority = g => FEATURED.includes(g.id) ? FEATURED.indexOf(g.id) : FEATURED.length;
      const pinned = priority(a) - priority(b);
      if (pinned) return pinned;
    }
    const by = key === 'featured' ? 'plays' : key;
    return (data?.[b.id]?.[by] || 0) - (data?.[a.id]?.[by] || 0);
  });
}
const ids = (list) => Array.from(list, (g) => g.id);
for (const key of ['featured','plays','views','likes','active_seconds']) assert.deepEqual(ids(api.rankGames(api.GAMES,sample.games,key)), ids(legacyRank(api.GAMES,sample.games,key)), key);
const dated = [{id:'a'},{id:'b'},{id:'c'}];
const dates = {a:{added:'2026-01-02T00:00:00Z',updated:'2026-05-01T00:00:00Z'},b:{added:'2026-01-02T00:00:00Z',updated:'2026-06-01T00:00:00Z'},c:{added:'2026-03-01T00:00:00Z',updated:'2026-04-01T00:00:00Z'}};
assert.deepEqual(ids(api.rankGames(dated,{},'added',dates)),['c','a','b']);
assert.deepEqual(ids(api.rankGames(dated,{},'updated',dates)),['b','a','c']);
assert.deepEqual(ids(api.rankGames(dated,{},'added',{c:dates.c})),['c','a','b']);
assert.equal(api.dateLabel(dates.a,'added'),'Added Jan 2');
assert.equal(api.dateLabel(dates.b,'updated'),'Updated Jun 1');
assert.equal(api.dateLabel({added:'2026-09-12T15:00:00-04:00'},'added'),'Added Sep 12');
assert.equal(api.dateLabel({updated:'2026-10-10T22:00:00-04:00'},'updated'),'Updated Oct 10');
assert.equal(api.dateLabel({},'added'),'');
assert.throws(()=>api.validateMetrics({...sample,source:'local'}));assert.throws(()=>api.validateMetrics({...sample,games:{fish:{plays:-1}}}));assert.equal(api.duration(90),'1m');assert.equal(api.duration(7200),'2.0h');
console.log('PASS catalog coverage, four metric sorts, stable ties, malformed data and duration labels');
async function server(){
  const oldFetch=global.fetch,oldKey=process.env.POSTHOG_PERSONAL_API_KEY;let fetches=0,fail=false,bad=false,nulls=false;
  const path=require.resolve('../../api/arcade-leaderboard');delete require.cache[path];const handler=require(path);
  function res(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.code=s;return this;},json(data){this.data=data;return this;}};}
  delete process.env.POSTHOG_PERSONAL_API_KEY;let r=res();await handler({method:'GET'},r);assert.equal(r.code,503);
  process.env.posthog_personal_api_key='test-private-key';r=res();await handler({method:'POST'},r);assert.equal(r.code,405);
  global.fetch=async(url,options)=>{fetches++;assert.equal(url,'https://us.posthog.com/api/projects/653362/query/');assert.equal(options.headers.Authorization,'Bearer test-private-key');assert.ok(JSON.parse(options.body).query.query.includes('INTERVAL 30 DAY'));if(fail)throw Error('private secret');return {ok:true,json:async()=>({results:bad?[['fish',-1,2,3,4]]:nulls?[['brawl',1,0,0,null],[null,4,4,0,9]]:[['fish',90,12,2,100.5]]})};};
  const a=res(),b=res();await Promise.all([handler({method:'GET',query:{sql:'DROP'}},a),handler({method:'GET'},b)]);assert.equal(fetches,1);assert.equal(a.data.games.fish.plays,12);assert.equal(a.data.games.fish.active_seconds,101);assert.equal(a.data.stale,undefined);assert.equal(JSON.stringify(a.data).includes('test-private-key'),false);
  assert.match(a.headers['Cache-Control'], /s-maxage=300/);assert.match(a.headers['Cache-Control'], /stale-while-revalidate=/);assert.match(a.headers['Cache-Control'], /stale-if-error=/);
  r=res();await handler({method:'GET'},r);assert.equal(fetches,1);assert.equal(r.code,200);
  const realNow=Date.now; let clock=realNow()+6*60*1000; Date.now=()=>clock;
  const beforeFail=fetches; fail=true; r=res(); await handler({method:'GET'},r);
  assert.equal(r.code,200); assert.equal(r.data.stale,true); assert.equal(r.data.games.fish.plays,12); assert.equal(JSON.stringify(r.data).includes('secret'),false);
  assert.match(r.headers['Cache-Control'], /s-maxage=/); assert.match(r.headers['Cache-Control'], /stale-while-revalidate=/);
  assert.equal(fetches, beforeFail+1);
  r=res(); await handler({method:'GET'},r); assert.equal(r.code,200); assert.equal(r.data.stale,true); assert.equal(fetches, beforeFail+1);
  clock+=6*60*1000; fail=false; r=res(); await handler({method:'GET'},r); assert.equal(r.code,200); assert.equal(r.data.stale,undefined); assert.equal(r.data.games.fish.plays,12);
  Date.now=realNow; fail=true;
  delete require.cache[path];r=res();await require(path)({method:'GET'},r);assert.equal(r.code,503);assert.equal(r.headers['Cache-Control'],'no-store');assert.equal(JSON.stringify(r.data).includes('secret'),false);
  delete require.cache[path];fail=false;bad=true;r=res();await require(path)({method:'GET'},r);assert.equal(r.code,503);
  delete require.cache[path];bad=false;nulls=true;r=res();await require(path)({method:'GET'},r);assert.equal(r.code,200);assert.deepEqual(r.data.games,{brawl:{views:1,plays:0,likes:0,active_seconds:0}});
  global.fetch=oldFetch;if(oldKey)process.env.POSTHOG_PERSONAL_API_KEY=oldKey;else delete process.env.POSTHOG_PERSONAL_API_KEY;delete process.env.posthog_personal_api_key;
  console.log('PASS aggregate API: missing key, methods, bounded query, coalesced requests, cache, stale last-good result, edge cache header, private credential isolation, upstream and malformed response failures, null sums and events without a game');
}
server().catch(e=>{console.error(e);process.exitCode=1;});
