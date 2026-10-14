// Logic-only DEX boot smoke. The fake GPU verifies API dispatch and handles;
// it does not compile GLSL, rasterize textures, or validate visible graphics.
import {readFile,writeFile} from 'node:fs/promises';
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
const vm=new DexVM(dex,host);installOfflineRuntime(vm);
console.log('NSM DEX smoke: logic only; fake GPU, no visual rendering validation.');
// Original pointer events only. Read-only state logging helps explain gestures.
const fields=new Map();
const value=(owner,name,self=null)=>{const key=owner+'.'+name;let id=fields.get(key);if(id===undefined){id=dex.fields.findIndex(f=>f[0]===P+owner+';'&&f[1]===name);if(id<0)return undefined;id=vm.fieldIds[id];fields.set(key,id);}return vm.unpack(dex.fields[id][2],self?self.$fields.get(id):vm.statics.get(id));};
const variable=name=>{const v=value('bb_generated',name);return v?vm.call(v.$class,'p_Output',[v]):null;};
let frame=0;
const invokeNative=host.invoke.bind(host);
host.invoke=(vm,ref,proto,raw,staticCall)=>{if([P+'BBGame;',P+'BBAndroidGame;'].includes(ref[0])&&ref[1]==='Millisecs')return {handled:true,value:Math.floor(frame*1000/60)};return invokeNative(vm,ref,proto,raw,staticCall);};
const state=()=>({frame,screen:value('c_TScreen','m_activescreen')&&value('c_TScreen','m_name',value('c_TScreen','m_activescreen')),ftue:variable('g_tFtue_Step'),training:variable('g_tFtue_TrainingStep'),touching:value('c_TMatchTouch','m_touching'),kickOrPath:value('c_TMatchTouch','m_kickordrawpath'),distance:value('c_TMatchTouch','m_dragdistUnclamped'),touchState:variable('g_tMatch_ControllerTouchState'),speed:value('c_MatchEngine','m_gamespeed'),pitchScale:variable('g_tPitch_Scale'),matchState:value('c_TMatch','m_matchstate')});
const tick=()=>{for(const method of ['UpdateGame','RenderGame_Early','RenderGame_Late','RenderGame_End'])vm.call(host.delegate.$class,method,[host.delegate]);host.drainUpdates(vm);frame++;};
const advance=async(count,label)=>{for(let n=0;n<count;n++){tick();if(n%20===19){console.log(label,JSON.stringify(state()));await new Promise(r=>setTimeout(r,0));}}};
const waitStep=async(target,label)=>{for(let n=0;n<240&&variable('g_tFtue_Step')<target;n++)tick();console.log(label,JSON.stringify(state()));if(variable('g_tFtue_Step')<target)throw Error('Original FTUE did not reach step '+target+' after '+label);};
const waitScreen=async(target)=>{for(let n=0;n<240&&state().screen!==target;n++)tick();if(state().screen!==target)throw Error('Original screen did not open '+target);await advance(30,'screen settle');};
const pointer=(event,x,y)=>vm.call(host.delegate.$class,'TouchEvent',[host.delegate,event,0,x,y]);
const tap=async(x,y,settle=30)=>{pointer(7,x,y);await advance(2,'down');pointer(8,x,y);await advance(settle,'tap');};
const drag=async(x,y,toX,toY,settle=30)=>{pointer(7,x,y);await advance(2,'drag down');for(let n=1;n<=10;n++){pointer(9,x+(toX-x)*n/10,y+(toY-y)*n/10);await advance(1,'drag');}pointer(8,toX,toY);await advance(settle,'drag release');};
try{
 vm.withInstructionBudget(500000000,()=>{vm.call(P+'bb_;','bbInit');vm.call(P+'bb_;','bbMain');vm.call(host.delegate.$class,'StartGame',[host.delegate]);});
 console.log('Training probe: original game, fake GPU; graphics are not visually validated.');
 await advance(30,'menu');await tap(640,685,60);await waitScreen('home');console.log('HOME',JSON.stringify(state()));
 await tap(675,516,30);await waitStep(3,'ASSISTANT ONE');await tap(675,516,60);await waitStep(5,'TRAINING');await advance(30,'training settle');
 await tap(918,73,50);await waitStep(6,'PASS');await advance(30,'pass settle');
 await tap(838,193,50);await waitStep(7,'SPACE');await advance(30,'space settle');
 await drag(1018,187,1040,485,30);await waitStep(8,'RUN');await advance(30,'run settle');
 await tap(1030,353,80);await waitStep(10,'PASS TO RUN');await advance(30,'dribble settle');
 pointer(7,640,245);await advance(3,'dribble down');
 for(let n=1;n<=12;n++){pointer(9,640,245+(690-245)*n/12);await advance(1,'dribble pull');}
 console.log('DRIBBLE HELD',JSON.stringify(state()));
 for(let n=0;n<300&&variable('g_tFtue_Step')<11;n++){tick();if(n%30===29)console.log('dribble hold',JSON.stringify(state()));}
 console.log('DRIBBLE END',JSON.stringify(state()));pointer(8,640,690);await advance(20,'dribble release');
 console.log('AFTER DRIBBLE',JSON.stringify(state()));
 await advance(40,'shooting settle');
 const ball=value('bb_class_matchenginesoccer','g_activeball'),scale=variable('g_tPitch_Scale');
 const x=value('c_TFootball','m_x',ball),y=value('c_TFootball','m_y',ball);
 const world=vm.call(P+'c_Vec3;','m_Tmp2',[x*scale,y*scale,0]);
 const projected=vm.call(P+'c_AMatchEngine;','p_WorldToScreen',[value('c_MatchEngine','m_gmatchengine'),world]);
 const px=640+value('c_Vec3','m_x',projected)*640,py=360-value('c_Vec3','m_y',projected)*360;
 console.log('SHOOT PLAYER',JSON.stringify({x,y,scale,px,py}));
 if(Number.isFinite(px)&&Number.isFinite(py)){await drag(px,py,px,Math.min(710,py+160),80);console.log('SHOOT ARROW',JSON.stringify(state()));await tap(600,570,180);console.log('SHOOT BALL',JSON.stringify(state()));}

 console.log('Recent logs',logs.slice(-20));
 saveProgressCheckpoint(vm);
 if(storageData.size){await writeFile(new URL('../test-output/training-progress.json',import.meta.url),JSON.stringify({format:'nsm-progress',version:1,entries:Object.fromEntries(storageData)},null,2));console.log('Original save snapshot exported',storageData.size,'entries');}else console.log('Tutorial reached shooting; no original career save is available yet. This is not a complete tutorial or match test.');
}catch(error){console.error(error.stack||error);console.error('DEX trace',error.dexTrace);console.error('State',JSON.stringify(state()));console.error('Recent logs',logs.slice(-20));process.exitCode=1;}



