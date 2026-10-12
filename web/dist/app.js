import {runStartupFrame} from './startup-frame.js';
import {bindTouchAction} from './touch-controls.js?v=touch5';
import {createFrameGate} from './frame-clock.js';
import {installFullscreen} from './fullscreen.js';
import {DexVM} from './dex-vm.js';
import {NSMHost} from './nsm-host.js';
import {GLESHost} from './gles-host.js';
import {AudioHost} from './audio-host.js';
import {SaveStore} from './save-store.js';
import {exportProgress,importProgress} from './progress-backup.js';
import {installOfflineRuntime,saveProgressCheckpoint} from './offline-runtime.js';
const P='Luk/fiveaces/nsfc/',$=id=>document.getElementById(id),canvas=$('game'),status=$('status');

const diagnostics=window.diagnostics={state:'loading',frames:0,logs:[],error:null};
let vm,host,storage,running=false,paused=false;const input=[],chars=[];
const log=s=>{diagnostics.logs.push(String(s));if(diagnostics.logs.length>120)diagnostics.logs.shift();};
function fail(e){running=false;diagnostics.state='error';diagnostics.error={message:e.message,trace:e.dexTrace,stack:e.stack};console.error(e,e.dexTrace);$('loader').hidden=false;status.textContent='Game stopped: '+e.message+'\n'+(e.dexTrace?.slice(-5).join(' → ')||'');$('start').hidden=true;$('retry').hidden=false;}
const json=async p=>{const r=await fetch(p);if(!r.ok)throw Error('Cannot load '+p);return r.json();};
async function boot(){
 const [dex,assets,data]=await Promise.all(['game-dex.json','asset-manifest.json','runtime-data.json'].map(json));
 const graphics=new GLESHost(canvas);window.graphics=graphics;storage=await SaveStore.open(log);
 const fontCanvas=document.createElement('canvas');host=new NSMHost({assets,graphics,width:1280,height:720,language:'en',storage,log,fontContext:fontCanvas.getContext('2d')});window.host=host;
 for(const [p,b]of Object.entries(data))host.files.set(p,Uint8Array.from(atob(b),c=>c.charCodeAt(0)));
 for(let i=0;i<storage.length;i++){const k=storage.key(i);if(k.startsWith('nsm-file:'))host.files.set(k.slice(9),Uint8Array.from(atob(storage.getItem(k)),c=>c.charCodeAt(0)));}
 host.options.audio=new AudioHost(p=>host.path(p),log);
 const images=new Map(),preload=assets.filter(a=>a.width&&a.height&&/\.(png|jpg)$/i.test(a.path));let done=0;
 for(let i=0;i<preload.length;i+=8)await Promise.all(preload.slice(i,i+8).map(async a=>{const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Missing image '+a.path));image.src='assets/'+a.path;});images.set(a.path,image);$('progress').value=++done/preload.length*90;status.textContent=`Loading resources ${done}/${preload.length}`;}));
 host.options.surface=path=>{const p=host.path(path),image=images.get(p);if(!image)return 0;const s=host.makeSurface(image.width,image.height);s.image=image;s.path=p;return s;};
 await Promise.all(assets.filter(a=>a.path.endsWith('.ttf')).map(async a=>{const name='NSMFont_'+a.path.split('/').pop().replace(/\.ttf$/,'');document.fonts.add(await new FontFace(name,`url('assets/${a.path}')`).load());}));
 const keyboard=document.createElement('input');keyboard.className='native-keyboard';keyboard.hidden=true;keyboard.autocomplete='off';keyboard.enterKeyHint='done';document.querySelector('main').append(keyboard);let previous='';
 host.options.keyboard={setText:t=>{keyboard.value=previous=String(t);},value:()=>keyboard.value,enable:yes=>{keyboard.hidden=!yes;if(yes)keyboard.focus({preventScroll:true});else keyboard.blur();}};
 keyboard.oninput=()=>{if(!host.keyboardAlt){let c=0;while(previous[c]===keyboard.value[c]&&c<previous.length)c++;for(let i=c;i<previous.length;i++)chars.push(8);for(let i=c;i<keyboard.value.length;i++)chars.push(keyboard.value.charCodeAt(i));}previous=keyboard.value;};keyboard.onkeydown=e=>{if(e.key==='Enter'){chars.push(13);keyboard.blur();}};
 vm=new DexVM(dex,host);window.vm=vm;installOfflineRuntime(vm);status.textContent='Starting original game code…';await new Promise(r=>setTimeout(r,0));
 vm.withInstructionBudget(500000000,()=>{vm.call(P+'bb_;','bbInit');vm.call(P+'bb_;','bbMain');vm.call(host.delegate.$class,'StartGame',[host.delegate]);});
 diagnostics.state='ready';$('progress').value=100;status.textContent='Ready';$('start').hidden=false;$('tools').disabled=false;
}
const frameGate=createFrameGate(),frameSamples=new Float32Array(120);let sampleCount=0,sampleIndex=0;
function tick(timestamp){if(!running)return;if(!frameGate(timestamp,host?.rate||60)){requestAnimationFrame(tick);return;}const started=performance.now();try{if(!paused&&!document.hidden){if(input.length)vm.call(host.delegate.$class,'TouchEvent',[host.delegate,...input.shift()]);for(let i=0;i<24&&chars.length;i++)vm.call(host.delegate.$class,'KeyEvent',[host.delegate,3,chars.shift()]);for(const method of ['UpdateGame','RenderGame_Early','RenderGame_Late','RenderGame_End'])vm.call(host.delegate.$class,method,[host.delegate]);host.drainUpdates(vm);diagnostics.frames++;diagnostics.frameMs=performance.now()-started;frameSamples[sampleIndex++%120]=diagnostics.frameMs;sampleCount=Math.min(120,sampleCount+1);if(diagnostics.frames%60===0){const samples=Array.from(frameSamples.subarray(0,sampleCount)).sort((a,b)=>a-b);canvas.dataset.frames=String(diagnostics.frames);canvas.dataset.frameMs=diagnostics.frameMs.toFixed(2);canvas.dataset.frameMeanMs=(samples.reduce((sum,n)=>sum+n,0)/sampleCount).toFixed(2);canvas.dataset.frameP95Ms=samples[Math.min(sampleCount-1,Math.floor(sampleCount*.95))].toFixed(2);canvas.dataset.glObjects=String(window.graphics.objects.size);canvas.dataset.glSurfaces=String(window.graphics.surfaces?.size||0);diagnostics.performance={frames:diagnostics.frames,cpuMeanMs:Number(canvas.dataset.frameMeanMs),cpuP95Ms:Number(canvas.dataset.frameP95Ms),glObjects:window.graphics.objects.size,glSurfaces:window.graphics.surfaces?.size||0,uniformHandles:window.graphics.locations.size,decodedAudio:host.options.audio.buffers.size,heapBytes:performance.memory?.usedJSHeapSize??null};}}requestAnimationFrame(tick);}catch(e){fail(e);}}
bindTouchAction($('start'),()=>{
 
 if(running||diagnostics.state!=='ready')return;
 try{
  // Enter the game independently of the optional audio activation. Still call
  // unlock synchronously inside this gesture, as mobile audio requires.
  $('start').disabled=true;status.textContent='Starting original game…';running=true;diagnostics.state='starting';
  startFirstFrame().catch(fail);
  try{host.options.audio.unlock();}catch(e){log('Audio activation: '+e.message);}
 }catch(e){fail(e);}
});
async function startFirstFrame(){
 const methods=['UpdateGame','RenderGame_Early','RenderGame_Late','RenderGame_End'];
 const steps=methods.map(method=>[method,()=>vm.call(host.delegate.$class,method,[host.delegate])]);
 steps.push(['drainUpdates',()=>host.drainUpdates(vm)]);
 for(let frame=1;frame<=3;frame++){
  await runStartupFrame(steps,name=>{status.textContent=name==='drainUpdates'?'Initializing game data…':'Preparing the first game screen…';},()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  diagnostics.frames++;
 }
 if(window.graphics.gl.isContextLost?.())throw Error('The browser lost the WebGL context during startup.');
 diagnostics.state='running';$('loader').hidden=true;
 requestAnimationFrame(tick);
}
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fail(Error('WebGL context lost. Reload the page to rebuild graphics; saved progress is retained.'));});
const pointers=new Map();for(const [event,code]of [['pointerdown',7],['pointermove',9],['pointerup',8],['pointercancel',8]])canvas.addEventListener(event,e=>{e.preventDefault();if(!running||paused)return;let slot=pointers.get(e.pointerId);if(code===7){slot=[...Array(32).keys()].find(i=>![...pointers.values()].includes(i));pointers.set(e.pointerId,slot);canvas.setPointerCapture(e.pointerId);}if(slot===undefined)return;const b=canvas.getBoundingClientRect(),v=[code,slot,(e.clientX-b.left)*canvas.width/b.width,(e.clientY-b.top)*canvas.height/b.height];if(code===9&&input.at(-1)?.[0]===9&&input.at(-1)?.[1]===slot)input[input.length-1]=v;else input.push(v);if(code===8)pointers.delete(e.pointerId);});
bindTouchAction($('tools'),()=>{if($('options').open)return;try{$('options').showModal();paused=true;}catch(e){fail(e);}});bindTouchAction($('close'),()=>$('options').close());$('options').onclose=()=>paused=false;
$('backup').onclick=async()=>{try{if(running)saveProgressCheckpoint(vm);await storage.flush();const saved=exportProgress(storage);const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(saved)],{type:'application/json'}));a.download='nsm-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);$('offline').textContent='Backup exported.';}catch(e){$('offline').textContent=e.message;}};
$('restore').onchange=async e=>{try{const saved=JSON.parse(await e.target.files[0].text());await importProgress(storage,saved);location.reload();}catch(e){$('offline').textContent=e.message;}};
document.addEventListener('visibilitychange',()=>{if(!vm||!running)return;try{if(document.hidden)saveProgressCheckpoint(vm);vm.call(host.delegate.$class,document.hidden?'SuspendGame':'ResumeGame',[host.delegate]);storage.flush().catch(e=>log(e.message));}catch(e){fail(e);}});
window.addEventListener('pagehide',()=>{if(vm&&running)try{saveProgressCheckpoint(vm);}catch(e){log(e.message);}});
boot().catch(fail);

let offlineWorker;
if('serviceWorker' in navigator && isSecureContext){
 navigator.serviceWorker.register('./sw.js').then(async registration=>{await navigator.serviceWorker.ready;offlineWorker=registration.active;$('downloadOffline').disabled=!offlineWorker;$('offline').textContent='Download the game resources for offline use on this browser.';}).catch(e=>{$('offline').textContent='Offline cache unavailable: '+e.message;});
}else $('offline').textContent='Offline download requires HTTPS or localhost. Local-network HTTP works while this server is running.';
$('downloadOffline').onclick=async()=>{if(!offlineWorker)return;$('downloadOffline').disabled=true;$('offline').textContent='Downloading original resources…';await navigator.storage?.persist?.();offlineWorker.postMessage({type:'CACHE_GAME'});};
navigator.serviceWorker?.addEventListener('message',event=>{const message=event.data;if(message?.type==='CACHE_GAME_PROGRESS')$('offline').textContent=`Downloading for offline play: ${message.completed}/${message.total}`;else if(message?.type==='CACHE_GAME_COMPLETE'){$('offline').textContent='Offline resources saved. Add this page to your Home Screen.';$('downloadOffline').disabled=false;}else if(message?.type==='CACHE_GAME_ERROR'){$('offline').textContent='Offline download failed: '+message.message;$('downloadOffline').disabled=false;}});

installFullscreen({button:$('fullscreen'),status:$('fullscreenStatus'),beforeRequest:()=>{$('options').close();paused=false;}});

$('diagnostic').onclick=()=>{const report={format:'nsm-performance',version:1,createdAt:new Date().toISOString(),userAgent:navigator.userAgent,performance:diagnostics.performance??null,error:diagnostics.error,logs:diagnostics.logs.slice(-40)};const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));link.download='nsm-performance.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);};
