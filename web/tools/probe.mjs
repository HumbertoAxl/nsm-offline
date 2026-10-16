// Logic-only DEX boot smoke. The fake GPU verifies API dispatch and handles;
// it does not compile GLSL, rasterize textures, or validate visible graphics.
import {readFile} from 'node:fs/promises';
import {DexVM} from '../dist/dex-vm.js';
import {NSMHost} from '../dist/nsm-host.js';
import {GLESHost} from '../dist/gles-host.js';
import {installOfflineRuntime,saveProgressCheckpoint} from '../dist/offline-runtime.js';
const P='Luk/fiveaces/nsfc/';
const load=async name=>JSON.parse(await readFile(new URL('../dist/'+name,import.meta.url),'utf8'));
const tapStart=process.argv.includes('--tap-start');
const profile=process.argv.includes('--profile');
const afterTapFrames=Number(process.argv.find(value=>value.startsWith('--after-tap-frames='))?.split('=')[1]??50);
if(!Number.isSafeInteger(afterTapFrames)||afterTapFrames<0)throw Error('Invalid after-tap frame count');
const frameArgument=process.argv.slice(2).find(value=>!value.startsWith('--'));
const frames=Math.max(0,Number(frameArgument??3));
if(!Number.isSafeInteger(frames))throw Error('Frame count must be a nonnegative integer');
function fakeGL(){
 const gl={ARRAY_BUFFER:34962,ELEMENT_ARRAY_BUFFER:34963,STREAM_DRAW:35040,FLOAT:5126,UNSIGNED_BYTE:5121,UNSIGNED_SHORT:5123,UNSIGNED_INT:5125,UNSIGNED_SHORT_4_4_4_4:32819,UNSIGNED_SHORT_5_5_5_1:32820,UNSIGNED_SHORT_5_6_5:33635,RGBA:6408,TEXTURE_2D:3553,TEXTURE0:33984,TEXTURE_BINDING_2D:32873,UNPACK_PREMULTIPLY_ALPHA_WEBGL:37441,UNPACK_FLIP_Y_WEBGL:37440,UNPACK_ALIGNMENT:3317,LINEAR:9729,NEAREST:9728,TEXTURE_MIN_FILTER:10241,TEXTURE_MAG_FILTER:10240,TEXTURE_WRAP_S:10242,TEXTURE_WRAP_T:10243,CLAMP_TO_EDGE:33071,REPEAT:10497,LINEAR_MIPMAP_LINEAR:9987,NEAREST_MIPMAP_LINEAR:9986,FRAMEBUFFER:36160,FRAMEBUFFER_BINDING:36006,RENDERBUFFER:36161,RENDERBUFFER_BINDING:36007,DEPTH_COMPONENT16:33189,DEPTH_ATTACHMENT:36096,COLOR_ATTACHMENT0:36064,FRAMEBUFFER_COMPLETE:36053};
 let serial=0;const state=new Map([[3317,4],[34016,33984]]);gl.getExtension=()=>null;
 for(const kind of ['Buffer','Texture','Framebuffer','Renderbuffer','Program','Shader']){gl['create'+kind]=()=>({kind,id:++serial,shaders:[],uniforms:[]});gl['delete'+kind]=object=>{if(object)object.deleted=true;};}
 const methods=['bufferData','bufferSubData','vertexAttribPointer','drawElements','drawArrays','framebufferTexture2D','framebufferRenderbuffer','texImage2D','texSubImage2D','readPixels','compileShader','useProgram','bindAttribLocation','validateProgram','activeTexture','blendFunc','blendFuncSeparate','blendEquation','blendEquationSeparate','blendColor','clear','clearColor','colorMask','cullFace','depthFunc','depthMask','depthRange','clearDepth','disable','disableVertexAttribArray','enable','enableVertexAttribArray','finish','flush','frontFace','generateMipmap','hint','lineWidth','polygonOffset','renderbufferStorage','sampleCoverage','scissor','stencilFunc','stencilFuncSeparate','stencilMask','stencilMaskSeparate','stencilOp','stencilOpSeparate','texParameteri','texParameterf','viewport'];
 for(const method of methods)gl[method]=()=>{};
 for(let n=1;n<=4;n++){for(const tail of ['f','i','fv','iv'])gl['uniform'+n+tail]=()=>{};for(const tail of ['f','fv'])gl['vertexAttrib'+n+tail]=()=>{};if(n>1)gl['uniformMatrix'+n+'fv']=()=>{};}
 gl.bindTexture=(target,object)=>state.set(32873,object);gl.bindFramebuffer=(target,object)=>state.set(36006,object);gl.bindRenderbuffer=(target,object)=>state.set(36007,object);gl.bindBuffer=()=>{};gl.pixelStorei=(key,value)=>state.set(key,value);
 gl.getParameter=key=>state.has(key)?state.get(key):key===3379?4096:[34921,35660,35661,36347,36348,36349,34930].includes(key)?16:[7936,7937,7938,35724].includes(key)?'Logic-only fake WebGL':0;
 gl.shaderSource=(shader,source)=>shader.source=source;gl.getShaderSource=shader=>shader.source||'';gl.getShaderParameter=(shader,key)=>key===35713?true:0;gl.getShaderInfoLog=()=>'';gl.getProgramInfoLog=()=>'';
 gl.attachShader=(program,shader)=>program.shaders.push(shader);gl.detachShader=(program,shader)=>program.shaders=program.shaders.filter(s=>s!==shader);
 gl.linkProgram=program=>{const uniforms=new Map();for(const shader of program.shaders)for(const match of (shader.source||'').matchAll(/uniform\s+(?:(?:lowp|mediump|highp)\s+)?(\w+)\s+(\w+)(?:\[(\d+)\])?\s*;/g)){const types={float:5126,vec2:35664,vec3:35665,vec4:35666,mat2:35674,mat3:35675,mat4:35676,sampler2D:35678,int:5124};uniforms.set(match[2],{name:match[2]+(match[3]?'[0]':''),size:Number(match[3]||1),type:types[match[1]]||5126});}program.uniforms=[...uniforms.values()];};
 gl.getProgramParameter=(program,key)=>key===35714||key===35715?true:key===35718?program.uniforms.length:key===35717?program.shaders.length:0;
 gl.getActiveUniform=(program,index)=>program.uniforms[index];gl.getActiveAttrib=()=>({name:'position',size:1,type:35665});gl.getUniformLocation=(program,name)=>({program,name});gl.getAttribLocation=()=>0;gl.getAttachedShaders=program=>program.shaders;gl.getUniform=()=>0;gl.getBufferParameter=()=>0;gl.getRenderbufferParameter=()=>0;gl.getTexParameter=()=>9729;gl.getFramebufferAttachmentParameter=()=>0;gl.getVertexAttrib=()=>0;gl.checkFramebufferStatus=()=>36053;gl.getError=()=>0;gl.isTexture=texture=>!!texture&&!texture.deleted;
 return gl;
}
function context2D(){return{font:'12px sans-serif',fillStyle:'#fff',measureText:text=>({width:String(text).length*8,actualBoundingBoxLeft:0,actualBoundingBoxRight:String(text).length*8,actualBoundingBoxAscent:10,actualBoundingBoxDescent:3}),fillText:()=>{},drawImage:()=>{},getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)})};}
const [dex,assets,data]=await Promise.all(['game-dex.json','asset-manifest.json','runtime-data.json'].map(load));
const graphics=new GLESHost(null,{gl:fakeGL()});graphics.makeCanvas=(width,height)=>({width,height,getContext:context2D});
const logs=[],storageData=new Map(),storage={getItem:key=>storageData.get(key)??null,setItem:(key,value)=>storageData.set(key,String(value)),removeItem:key=>storageData.delete(key)};
const host=new NSMHost({assets,graphics,width:1280,height:720,language:'en',storage,fontContext:context2D(),log:message=>{logs.push(String(message));if(logs.length>80)logs.shift();}});
for(const [path,value]of Object.entries(data))host.files.set(path,new Uint8Array(Buffer.from(value,'base64')));
const images=new Map(assets.filter(a=>a.width&&a.height).map(a=>[a.path,a]));
host.options.surface=path=>{const entry=images.get(host.path(path));if(!entry)return 0;const surface=host.makeSurface(entry.width,entry.height);surface.path=entry.path;return surface;};
function profileFrames(vm,host,count,tick){
 const stack=[],dexStats=new Map(),nativeStats=new Map(),oldExecute=vm.execute,oldInvoke=host.invoke;
 const timed=(map,key,call,compiled)=>{let stat=map.get(key);if(!stat){stat={method:key,count:0,selfMs:0,totalMs:0,jitCalls:0,interpretedCalls:0};map.set(key,stat);}const frame={start:performance.now(),children:0};stack.push(frame);try{return call();}finally{const elapsed=performance.now()-frame.start;stack.pop();if(stack.length)stack.at(-1).children+=elapsed;stat.count++;stat.totalMs+=elapsed;stat.selfMs+=elapsed-frame.children;if(compiled){if(compiled())stat.jitCalls++;else stat.interpretedCalls++;}}};
 vm.execute=function(method,args){const ref=this.dex.methods[method.id],key=ref[0].slice(P.length,-1)+'.'+ref[1]+'#'+method.id;return timed(dexStats,key,()=>oldExecute.call(this,method,args),()=>!!method.compiled);};
 host.invoke=function(runtime,ref,...rest){const key=ref[0]+'.'+ref[1];return timed(nativeStats,key,()=>oldInvoke.call(this,runtime,ref,...rest));};
 const started=performance.now();try{for(let frame=0;frame<count;frame++)tick();}finally{vm.execute=oldExecute;host.invoke=oldInvoke;}
 const elapsed=performance.now()-started,round=x=>Math.round(x*1000)/1000;
 const summarize=(map,limit)=>[...map.values()].sort((a,b)=>b.selfMs-a.selfMs).slice(0,limit).map(s=>({...s,selfMs:round(s.selfMs),totalMs:round(s.totalMs)}));
 const allDex=[...dexStats.values()],jitCalls=allDex.reduce((sum,s)=>sum+s.jitCalls,0),interpretedCalls=allDex.reduce((sum,s)=>sum+s.interpretedCalls,0);
 console.log('Stable-frame CPU profile: instrumentation overhead included; fake GPU has no rendering cost.');
 console.log(JSON.stringify({profileFrames:count,totalMs:round(elapsed),averageFrameMs:round(elapsed/count),dexCalls:jitCalls+interpretedCalls,jitCalls,interpretedCalls,jitCoveragePercent:round(jitCalls/(jitCalls+interpretedCalls)*100),distinctDexMethods:allDex.length,dexHotspots:summarize(dexStats,25),nativeHotspots:summarize(nativeStats,15)},null,2));
}
const vm=new DexVM(dex,host);installOfflineRuntime(vm);
console.log('NSM DEX smoke: logic only; fake GPU, no visual rendering validation.');
try{
 const started=performance.now();vm.withInstructionBudget(500000000,()=>{vm.call(P+'bb_;','bbInit');vm.call(P+'bb_;','bbMain');vm.call(host.delegate.$class,'StartGame',[host.delegate]);});console.log('Original boot complete',Math.round(performance.now()-started)+'ms');
 if(process.argv.includes('--profile-start'))profileFrames(vm,host,1,()=>{for(const name of ['UpdateGame','RenderGame_Early','RenderGame_Late','RenderGame_End'])vm.call(host.delegate.$class,name,[host.delegate]);host.drainUpdates(vm);});
 for(let frame=0;frame<frames;frame++){for(const name of ['UpdateGame','RenderGame_Early','RenderGame_Late','RenderGame_End'])vm.call(host.delegate.$class,name,[host.delegate]);host.drainUpdates(vm);console.log('Frame',frame+1,'completed');}
 if(tapStart){
  const tick=()=>{for(const name of ['UpdateGame','RenderGame_Early','RenderGame_Late','RenderGame_End'])vm.call(host.delegate.$class,name,[host.delegate]);host.drainUpdates(vm);};
  for(let frame=0;frame<30;frame++)tick();
  console.log('Tap-start: original pointer down at 640,685');
  vm.call(host.delegate.$class,'TouchEvent',[host.delegate,7,0,640,685]);tick();
  vm.call(host.delegate.$class,'TouchEvent',[host.delegate,8,0,640,685]);
  for(let frame=0;frame<afterTapFrames;frame++)tick();
  console.log('Tap-start flow completed',afterTapFrames,'frames after release');
 }
 if(process.argv.includes('--checkpoint')){console.log('Checkpoint result',saveProgressCheckpoint(vm),'stored files',[...storageData.keys()]);if(tapStart&&afterTapFrames===50&&[...storageData.keys()].some(key=>key.includes(':career')))throw Error('Incomplete trial career was serialized');}
 // Uninstrumented timing of stable frames: --bench=N
 const bench=Number(process.argv.find(value=>value.startsWith('--bench='))?.split('=')[1]??0);
 if(bench>0){const tick=()=>{for(const name of ['UpdateGame','RenderGame_Early','RenderGame_Late','RenderGame_End'])vm.call(host.delegate.$class,name,[host.delegate]);host.drainUpdates(vm);};const times=[];for(let i=0;i<bench;i++){const t=performance.now();tick();times.push(performance.now()-t);}times.sort((a,b)=>a-b);console.log(JSON.stringify({benchFrames:bench,meanMs:+(times.reduce((a,b)=>a+b,0)/bench).toFixed(3),medianMs:+times[bench>>1].toFixed(3),p95Ms:+times[Math.floor(bench*.95)].toFixed(3)}));}
 if(profile)profileFrames(vm,host,20,()=>{for(const name of ['UpdateGame','RenderGame_Early','RenderGame_Late','RenderGame_End'])vm.call(host.delegate.$class,name,[host.delegate]);host.drainUpdates(vm);});
 console.log(JSON.stringify({frames,graphics:graphics.stats,logs:logs.slice(-12),storageEntries:storageData.size},null,2));
}catch(error){console.error(error.stack||error);console.error('DEX trace:',error.dexTrace||vm.trace);console.error('Recent game logs:',logs.slice(-20));
 if(error.message.includes('budget')){const state={};for(const name of ['m_at','m_length','m_matchLen','m_parameterMarkerChar','m_source']){const index=vm.dex.fields.findIndex(f=>f[0]===P+'c_ParseBuffer;'&&f[1]===name);if(index>=0){const id=vm.fieldIds[index];state[name]=vm.unpack(vm.dex.fields[id][2],vm.statics.get(id));}}const source=state.m_source;delete state.m_source;state.sourceSnippet=typeof source==='string'?source.substring(Math.max(0,state.m_at-30),state.m_at+100):null;console.error('ParseBuffer diagnostics:',JSON.stringify(state));}
 process.exitCode=1;}
