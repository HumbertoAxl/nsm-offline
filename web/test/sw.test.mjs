import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const source=await readFile(new URL('../dist/sw.js',import.meta.url),'utf8');
const scope='https://nsm.test/game/',activeKey=scope+'__nsm_offline_active__';
function environment({failResource,offline=false,index=null}={}){
 const stores=new Map(),messages=[],requests=[],listeners=new Map();
 const caches={async open(name){if(!stores.has(name))stores.set(name,new Map());return{async match(url){const response=stores.get(name).get(typeof url==='string'?url:url.url);return response?.clone();},async put(url,response){const key=typeof url==='string'?url:url.url;if(name.startsWith('nsm-offline-v1-')&&name!=='nsm-offline-v1-old'&&key.endsWith(failResource||'__never__'))throw new DOMException('Full','QuotaExceededError');stores.get(name).set(key,response.clone());}};},async keys(){return [...stores.keys()];},async delete(name){return stores.delete(name);}};
 const manifest=[{path:'Textures/a.png',size:4},{path:'Fonts/a.ttf',size:4},{path:'Sounds/a.mp3',size:4},{path:'Models/player.bin',size:4}];
 const context={URL,Response,Headers,Array,Math,Date,Promise,Set,Error,String,Number,caches,self:{registration:{scope},location:{origin:'https://nsm.test'},addEventListener:(type,fn)=>listeners.set(type,fn),skipWaiting:async()=>{},clients:{claim:async()=>{}}},fetch:async request=>{const url=typeof request==='string'?request:request.url;requests.push(url);if(offline)throw Error('Offline');const text=url===scope+'asset-manifest.json'?JSON.stringify(manifest):url===scope+'cache-index.json'&&index?JSON.stringify(index()):'resource:'+new URL(url).pathname;return new Response(text,{headers:{'content-length':String(text.length)}});}};
 runInNewContext(source,context);
 const download=async()=>{let work;listeners.get('message')({data:{type:'CACHE_GAME'},source:{postMessage:message=>messages.push(message)},waitUntil:promise=>work=promise});await work;};
 const respond=async url=>{let result;listeners.get('fetch')({request:new Request(url),respondWith:promise=>result=promise});return result;};
 const version=source.match(/const NSM_VERSION = '([^']*)'/)[1];
 return{caches,stores,messages,requests,download,respond,version};
}
async function oldCopy(env){const old=await env.caches.open('nsm-offline-v1-old');await old.put(scope+'app.js',new Response('old working runtime'));const meta=await env.caches.open('nsm-offline-metadata');await meta.put(activeKey,new Response(JSON.stringify({cache:'nsm-offline-v1-old'})));}
test('offline download commits only after all resources and excludes bundled model data',async()=>{const env=environment();await oldCopy(env);await env.download();const meta=await(await env.caches.open('nsm-offline-metadata')).match(activeKey),pointer=await meta.json();assert.notEqual(pointer.cache,'nsm-offline-v1-old');assert.equal(env.messages.at(-1).type,'CACHE_GAME_COMPLETE');assert.equal(env.stores.has('nsm-offline-v1-old'),false);assert.ok(env.stores.get(pointer.cache).has(scope+'Textures/a.png')===false);assert.ok(env.stores.get(pointer.cache).has(scope+'assets/Textures/a.png'));assert.ok(env.requests.every(url=>url.startsWith(scope)));assert.ok(!env.requests.some(url=>url.endsWith('player.bin')));assert.equal(env.messages.filter(m=>m.phase==='download').length,pointer.resources);});
test('quota failure removes incomplete staging cache and preserves active working copy',async()=>{const env=environment({failResource:'assets/Fonts/a.ttf'});await oldCopy(env);await env.download();const pointer=await(await(await env.caches.open('nsm-offline-metadata')).match(activeKey)).json();assert.equal(pointer.cache,'nsm-offline-v1-old');assert.deepEqual([...env.stores.keys()].sort(),['nsm-offline-metadata','nsm-offline-v1-old']);assert.equal(env.messages.at(-1).type,'CACHE_GAME_ERROR');assert.match(env.messages.at(-1).message,/previous offline copy remains available/);assert.equal(await(await(await env.caches.open('nsm-offline-v1-old')).match(scope+'app.js')).text(),'old working runtime');});
test('offline shell fallback ignores application query strings and external requests are blocked',async()=>{const env=environment({offline:true});await oldCopy(env);const response=await env.respond(scope+'app.js?v=refresh');assert.equal(await response.text(),'old working runtime');const count=env.requests.length,blocked=await env.respond('https://original-store.test/purchase');assert.equal(blocked.status,403);assert.equal(env.requests.length,count);});

const hashes=()=>{const index={};for(const path of ['index.html','app.js','style.css','assets/Textures/a.png','assets/Fonts/a.ttf','assets/Sounds/a.mp3'])index[path]='h-'+path;return index;};
test('a new version downloads only files whose content hash changed',async()=>{
 let index=hashes();const env=environment({index:()=>index});await env.download();
 const first=await(await(await env.caches.open('nsm-offline-metadata')).match(activeKey)).json();
 assert.equal(first.version,env.version);assert.equal(env.messages.at(-1).reused,0);
 index={...index,'app.js':'h-changed'};env.requests.length=0;await env.download();
 const fetched=env.requests.filter(url=>url!==scope+'asset-manifest.json'&&url!==scope+'cache-index.json');
 assert.ok(fetched.includes(scope+'app.js'));assert.ok(!fetched.includes(scope+'assets/Textures/a.png'));assert.ok(!fetched.includes(scope+'style.css'));
 assert.ok(env.messages.at(-1).reused>=5);
 const second=await(await(await env.caches.open('nsm-offline-metadata')).match(activeKey)).json();
 assert.equal(env.stores.has(first.cache),false);assert.ok(await(await env.caches.open(second.cache)).match(scope+'assets/Textures/a.png'));
});
test('a complete copy of the running version is served without the network',async()=>{
 const env=environment({index:hashes});await env.download();env.requests.length=0;
 const response=await env.respond(scope+'app.js?v=1');assert.equal(await response.text(),'resource:/game/app.js');assert.equal(env.requests.length,0);
});
test('without a content index the copy is kept but not trusted to be current',async()=>{
 const env=environment();await env.download();const pointer=await(await(await env.caches.open('nsm-offline-metadata')).match(activeKey)).json();
 assert.equal(pointer.version,null);env.requests.length=0;await env.respond(scope+'app.js');assert.equal(env.requests.length,1);
});
