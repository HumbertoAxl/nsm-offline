/* Explicit offline download for the self-hosted NSM browser runtime. */
// Stamped by web/tools/stamp-sw.mjs from cache-index.json.
const NSM_VERSION = 'df1778cc145b';
const NSM_CACHE_PREFIX = 'nsm-offline-v1-';
const NSM_METADATA_CACHE = 'nsm-offline-metadata';
const NSM_SCOPE = self.registration.scope;
const NSM_ACTIVE_KEY = new URL('__nsm_offline_active__', NSM_SCOPE).href;
const NSM_SHELL = ['','index.html','style.css','frame-clock.js','touch-controls.js','startup-frame.js','display.js','stage.js','fullscreen.js','manifest.webmanifest','icon.png','app.js','dex-vm.js','dex-jit.js','java-host.js','nsm-host.js','gles-host.js','font-host.js','audio-host.js','save-store.js','offline-runtime.js','progress-backup.js','game-dex.json','asset-manifest.json','runtime-data.bin.gz','asset-bundle.js'];
const NSM_SHELL_PATHS = new Set(NSM_SHELL.map(path=>new URL(path,NSM_SCOPE).pathname));
const NSM_ASSET_ROOT = new URL('assets/',NSM_SCOPE).pathname;
let nsmDownloadRunning = false;
let nsmActivePointer;
const NSM_HASH_HEADER = 'x-nsm-hash';
const nsmURL = path => new URL(path,NSM_SCOPE).href;
const nsmSend = (client,message) => {try{client?.postMessage(message);}catch{}};

async function nsmPointer() {
  try {
    if(nsmActivePointer===undefined){const metadata=await caches.open(NSM_METADATA_CACHE),response=await metadata.match(NSM_ACTIVE_KEY);nsmActivePointer=response?await response.json():null;}
  } catch {nsmActivePointer=null;}
  return nsmActivePointer;
}
async function nsmActiveCache() {
  try {const pointer=await nsmPointer();return pointer?.cache?await caches.open(pointer.cache):null;} catch {return null;}
}
// A complete offline copy of this exact version can serve everything first.
const nsmCurrent = pointer => !!pointer?.version && pointer.version===NSM_VERSION;
async function nsmFetchOwn(url) {
  const resolved=new URL(url,NSM_SCOPE);
  if(resolved.origin!==self.location.origin)throw Error('External resources are not permitted in the offline game cache.');
  // Revalidate: the HTTP cache already holds files the game just loaded.
  const response=await fetch(resolved.href,{cache:'no-cache',credentials:'same-origin',mode:'same-origin',redirect:'error'});
  if(!response.ok)throw Error(`Cannot cache ${resolved.pathname}: HTTP ${response.status}`);
  return response;
}
async function nsmCacheGame(client) {
  if(nsmDownloadRunning){nsmSend(client,{type:'CACHE_GAME_ERROR',message:'An offline download is already running.'});return;}
  nsmDownloadRunning=true;
  const staging=NSM_CACHE_PREFIX+Date.now()+'-'+Math.random().toString(36).slice(2);
  let committed=false,completed=0,total=0,bytes=0;
  try {
    nsmSend(client,{type:'CACHE_GAME_PROGRESS',completed,total,bytes,phase:'manifest'});
    const manifestResponse=await nsmFetchOwn(nsmURL('asset-manifest.json'));
    // Content hashes let unchanged files be copied from the previous offline copy.
    let index=null;
    try{const response=await fetch(nsmURL('cache-index.json'),{cache:'no-store',credentials:'same-origin',mode:'same-origin',redirect:'error'});if(response.ok){const value=await response.json();if(value&&typeof value==='object'&&!Array.isArray(value))index=value;}}catch{}
    const previous=await nsmActiveCache();
    const manifest=await manifestResponse.clone().json();
    if(!Array.isArray(manifest))throw Error('Invalid bundled asset manifest.');
    const resources=new Set(NSM_SHELL.map(nsmURL));
    for(const asset of manifest){
      if(typeof asset.path!=='string'||!(/\.(png|jpe?g|mp3|ttf)$/i.test(asset.path)))continue;
      if(asset.path.split('/').some(part=>part==='..'||part==='.'||part==='')||asset.path.includes('\\'))throw Error('Invalid bundled asset path.');
      resources.add(nsmURL('assets/'+asset.path.split('/').map(encodeURIComponent).join('/')));
    }
    total=resources.size;
    const stagingCache=await caches.open(staging),queue=[...resources];let next=0;
    const hashOf=url=>{if(!index)return null;const path=new URL(url).pathname.slice(new URL(NSM_SCOPE).pathname.length);return index[decodeURIComponent(path)||'index.html']||null;};
    let reused=0;
    const worker=async()=>{while(next<queue.length){const url=queue[next++],hash=hashOf(url);
      let response=hash?await previous?.match(url):null;
      if(response&&response.headers.get(NSM_HASH_HEADER)===hash)reused++;
      else{response=url===nsmURL('asset-manifest.json')?manifestResponse.clone():await nsmFetchOwn(url);if(hash){const headers=new Headers(response.headers);headers.set(NSM_HASH_HEADER,hash);response=new Response(response.body,{status:response.status,statusText:response.statusText,headers});}}
      const size=Number(response.headers.get('content-length'))||0;await stagingCache.put(url,response);completed++;bytes+=size;nsmSend(client,{type:'CACHE_GAME_PROGRESS',completed,total,bytes,phase:'download'});}};
    // Await all workers even after a failure before removing their staging cache.
    const results=await Promise.allSettled(Array.from({length:8},worker));
    const failure=results.find(result=>result.status==='rejected');if(failure)throw failure.reason;
    nsmSend(client,{type:'CACHE_GAME_PROGRESS',completed,total,bytes,phase:'commit'});
    const metadata=await caches.open(NSM_METADATA_CACHE);
    await metadata.put(NSM_ACTIVE_KEY,new Response(JSON.stringify(nsmActivePointer={cache:staging,version:index?NSM_VERSION:null,resources:total,bytes,createdAt:Date.now()}),{headers:{'content-type':'application/json'}}));
    committed=true;
    // Obsolete copies can be removed only after the new full cache is committed.
    for(const name of await caches.keys().catch(()=>[]))if(name.startsWith(NSM_CACHE_PREFIX)&&name!==staging)await caches.delete(name).catch(()=>{});
    nsmSend(client,{type:'CACHE_GAME_COMPLETE',resources:total,bytes,reused,version:nsmActivePointer.version});
  } catch(error) {
    if(!committed)await caches.delete(staging).catch(()=>{});
    nsmSend(client,{type:'CACHE_GAME_ERROR',message:error?.name==='QuotaExceededError'?'Not enough browser storage for the offline game. Your previous offline copy remains available.':String(error?.message||error)});
  } finally {nsmDownloadRunning=false;}
}
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>{
  if(event.data?.type==='CACHE_GAME')event.waitUntil(nsmCacheGame(event.source));
  else if(event.data?.type==='VERSION')event.waitUntil(nsmPointer().then(pointer=>nsmSend(event.source,{type:'VERSION',version:NSM_VERSION,offline:nsmCurrent(pointer),downloading:nsmDownloadRunning})));
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(url.origin!==self.location.origin){event.respondWith(Promise.resolve(new Response('External network access is disabled for this game.',{status:403})));return;}
  if(request.method!=='GET')return;
  const shell=NSM_SHELL_PATHS.has(url.pathname),asset=url.pathname.startsWith(NSM_ASSET_ROOT);
  if(!shell&&!asset)return;
  // Ignore cache-busting query strings only for this known application shell/assets.
  const cacheKey=url.origin+url.pathname;
  event.respondWith((async()=>{
    const pointer=await nsmPointer(),cache=await nsmActiveCache();
    if(cache&&nsmCurrent(pointer)){const response=await cache.match(cacheKey);if(response)return response;}
    if(asset){const response=await cache?.match(cacheKey);if(response)return response;return fetch(request,{redirect:'error'});}
    try{const response=await fetch(request,{redirect:'error'});if(response.ok)return response;const fallback=await cache?.match(cacheKey);return fallback||response;}
    catch(error){const fallback=await cache?.match(cacheKey);if(fallback)return fallback;throw error;}
  })());
});
