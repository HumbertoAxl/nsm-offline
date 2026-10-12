import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {DexVM, BF} from '../dist/dex-vm.js';
import {NSMHost} from '../dist/nsm-host.js';
const P='Luk/fiveaces/nsfc/',T=name=>P+name+';';
const dex=JSON.parse(await readFile(new URL('../dist/game-dex.json',import.meta.url),'utf8'));
function fixture(){
 const entries=new Map(),graphics={registerSurface(s){s.twidth=s.width;s.theight=s.height;s.uscale=1/s.width;s.vscale=1/s.height;s.texId=17;},discardSurface(){},surfacePixels:s=>s.pixels||new Uint8Array(s.width*s.height*4)};
 const host=new NSMHost({graphics,storage:{getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,String(v))}}),vm=new DexVM(dex,host);
 return{vm,host,entries};
}
function field(vm,owner,name){const id=dex.fields.findIndex(f=>f[0]===T(owner)&&f[1]===name);assert.ok(id>=0);return vm.fieldIds[id];}
function native(host,vm,owner,name,proto,args=[],self=null){return host.invoke(vm,[owner,name],proto,self?[self,...args]:args,!self).value;}

test('Inherited updater references use one pending bounded update, not its infinite Run loop',()=>{
 const {vm,host}=fixture(),updater=vm.newObject(T('c_UpdateThread')),calls=[];
 vm.installOverride(T('c_UpdateThread'),'p_OnUpdate()I',()=>{calls.push('update');return 0;});
 vm.installOverride(T('c_UpdateThread'),'p_OnRender_Late()I',()=>{calls.push('late');return 0;});
 vm.call(T('c_UpdateThread'),'Start',[updater,163840]);
 assert.equal(host.updater,updater);assert.deepEqual(calls,[]);
 for(const name of ['SyncOut','NotifyOut'])vm.call(T('c_UpdateThread'),name,[updater]);
 vm.call(T('c_UpdateThread'),'NotifyIn',[updater]);
 vm.call(T('c_UpdateThread'),'NotifyIn',[updater]);
 assert.deepEqual(calls,[]);assert.equal(host.drainUpdates(vm),true);
 assert.deepEqual(calls,['update','late']);assert.equal(host.drainUpdates(vm),false);
 for(const owner of ['c_Mat4','c_Vec3','c_Quaternion'])assert.equal(vm.statics.get(field(vm,owner,'m_safeThread')),1);
 assert.equal(host.shouldHandle([T('BBThread'),'Run__UNSAFE__']),false);
});

test('Inherited c_Thread.Start dispatches a finite loader virtual implementation',()=>{
 const {vm,host}=fixture(),loader=vm.newObject(T('c_AsyncImageLoaderThread'));let ran=0;
 vm.installOverride(T('c_AsyncImageLoaderThread'),'Run__UNSAFE__()V',()=>{ran++;return 0;});
 vm.call(T('c_Thread'),'Start',[loader,0]);
 assert.equal(ran,1);assert.equal(loader._running,false);assert.equal(host.pendingUpdater,null);
});

test('Named saves retain independent career files and NSM namespace',()=>{
 const {vm,host,entries}=fixture();
 const save=['I',['Ljava/lang/String;','Ljava/lang/String;']],load=['Ljava/lang/String;',['Ljava/lang/String;']];
 native(host,vm,T('BBGame'),'SaveState',save,['career0_0.monkeystate','slot zero']);
 native(host,vm,T('BBAndroidGame'),'SaveState',save,['career1_15.monkeystate','slot one']);
 assert.equal(native(host,vm,T('BBGame'),'LoadState',load,['career0_0.monkeystate']),'slot zero');
 assert.equal(native(host,vm,T('BBAndroidGame'),'LoadState',load,['career1_15.monkeystate']),'slot one');
 assert.equal(native(host,vm,T('BBGame'),'LoadState',load,['career2_0.monkeystate']),'');
 assert.equal(entries.size,2);assert.ok([...entries.keys()].every(k=>k.startsWith('nsm-state:')));
});

test('NIO IntBuffer allocates four bytes per element and retains integer access',()=>{
 const {vm,host}=fixture();
 const buffer=native(host,vm,'Ljava/nio/IntBuffer;','allocate',['Ljava/nio/IntBuffer;',['I']],[3]);
 assert.equal(buffer.$class,'Ljava/nio/IntBuffer;');assert.equal(buffer.unit,4);assert.equal(buffer.bytes.length,12);
 native(host,vm,'Ljava/nio/IntBuffer;','put',['Ljava/nio/IntBuffer;',['I','I']],[1,123456],buffer);
 assert.equal(native(host,vm,'Ljava/nio/IntBuffer;','get',['I',['I']],[1],buffer),123456);
});

test('Surface float fields return DEX raw bits rather than JavaScript floats',()=>{
 const {vm,host}=fixture(),surface=host.makeSurface(128,64);
 assert.equal(host.getField(vm,surface,field(vm,'gxtkSurface','uscale')),BF(1/128));
 assert.equal(host.getField(vm,surface,field(vm,'gxtkSurface','vscale')),BF(1/64));
 assert.equal(host.getField(vm,surface,field(vm,'gxtkSurface','width')),128);
});

test('DEX CopyBytes copies model buffers with offsets and overlapping ranges',()=>{
 const {vm,host}=fixture(),source=vm.newObject(T('c_DataBuffer')),destination=vm.newObject(T('c_DataBuffer'));
 vm.call(T('c_DataBuffer'),'m_DataBuffer_new',[source,12,false]);
 vm.call(T('c_DataBuffer'),'m_DataBuffer_new',[destination,12,false]);
 source.bytes.set([1,2,3,4,5,6,7,8,9,10,11,12]);
 vm.call(T('c_DataBuffer'),'CopyBytes',[source,2,destination,4,5]);
 assert.deepEqual([...destination.bytes],[0,0,0,0,3,4,5,6,7,0,0,0]);
 vm.call(T('c_DataBuffer'),'CopyBytes',[source,0,source,2,6]);
 assert.deepEqual([...source.bytes],[1,2,1,2,3,4,5,6,9,10,11,12]);
 assert.equal(host.getField(vm,source,field(vm,'BBDataBuffer','_data')).bytes,source.bytes);
 assert.equal(host.getField(vm,source,field(vm,'BBDataBuffer','_length')),12);
 assert.throws(()=>vm.call(T('c_DataBuffer'),'CopyBytes',[source,10,destination,0,3]),/range exceeds buffer/);
});

test('DEX float buffer upload keeps raw bits and allocation ownership',()=>{
 const {vm}=fixture(),buffer=vm.newObject(T('c_DataBuffer'));
 vm.call(T('c_DataBuffer'),'m_DataBuffer_new',[buffer,12,false]);
 vm.call(T('c_DataBuffer'),'_PokeFloats',[buffer,[BF(1.25),BF(-2.5),BF(0.5)]]);
 assert.equal(buffer.view.getFloat32(0,true),1.25);assert.equal(buffer.view.getFloat32(4,true),-2.5);assert.equal(buffer.view.getFloat32(8,true),0.5);
 assert.equal(vm.call(T('BBDataBuffer'),'_New',[buffer,4]),0);
 assert.equal(buffer.bytes.length,12);
 vm.call(T('BBDataBuffer'),'Discard',[buffer]);assert.equal(buffer.bytes,null);
 assert.equal(vm.call(T('BBDataBuffer'),'_New',[buffer,4]),1);
});

test('Surface destination reuse releases the temporary source texture',()=>{
 const {host}=fixture(),discarded=[],source=host.makeSurface(32,16),destination=host.makeSurface(16,16);
 source.texture={};destination.texture={};source.image={width:32,height:16};
 host.options.surface=()=>source;host.options.graphics.discardSurface=s=>discarded.push(s);
 assert.equal(host.surfaceFor('model.png',destination),destination);
 assert.equal(destination.image,source.image);assert.equal(destination.width,32);
 assert.deepEqual(discarded,[destination,source]);
});



test('1000 original bitmap loads, font-surface wraps and discards leave no temporary registry entries',()=>{
 const {host,vm}=fixture(),live=new Set(),sharedImage={width:16,height:16};
 host.options.graphics.registerSurface=s=>{s.texId=live.size+1;s.texture={};s.twidth=s.width;s.theight=s.height;s.uscale=1/s.width;s.vscale=1/s.height;live.add(s);};
 host.options.graphics.discardSurface=s=>{live.delete(s);s.texture=null;s.texId=0;};
 host.options.surface=()=>{const s=host.makeSurface(16,16);s.image=sharedImage;return s;};
 for(let i=0;i<1000;i++){
  const bitmap=native(host,vm,T('BBAndroidGame'),'LoadBitmap','(Ljava/lang/String;)Landroid/graphics/Bitmap;',['font-atlas.png']);
  assert.equal(live.size,0,'CPU-only bitmap must not own an orphan GPU texture');
  const destination=vm.newObject(T('gxtkSurface'));
  native(host,vm,T('gxtkSurface'),'SetBitmap','(Landroid/graphics/Bitmap;)V',[bitmap],destination);
  assert.equal(live.size,1);assert.equal(destination.image,sharedImage);
  native(host,vm,T('gxtkSurface'),'Discard','()I',[],destination);
  assert.equal(live.size,0);assert.equal(destination.bitmap,null);assert.equal(destination.pixels,null);
 }
 assert.equal(sharedImage.width,16,'shared image remains available for another surface');
});
test('Invalidate releases GPU ownership while keeping pixels for re-upload',()=>{
 const {host,vm}=fixture(),surface=host.makeSurface(16,16),pixels=new Uint8Array(1024);surface.pixels=pixels;
 native(host,vm,T('gxtkSurface'),'Invalidate','()V',[],surface);assert.equal(surface.pixels,pixels);
 native(host,vm,T('gxtkSurface'),'Discard','()I',[],surface);assert.equal(surface.pixels,null);
});

import {installOfflineRuntime} from '../dist/offline-runtime.js';
test('1000 original font renderer shutdowns release owned atlases without disposing shared images',()=>{
 const {host,vm}=fixture(),live=new Set(),shared=host.makeSurface(16,16);
 host.options.graphics.registerSurface=s=>{live.add(s);s.texture={};};
 host.options.graphics.discardSurface=s=>{live.delete(s);s.texture=null;s.texId=0;};
 host.options.graphics.registerSurface(shared);
 installOfflineRuntime(vm);
 const set=(self,owner,name,value)=>{const id=field(vm,owner,name);self.$fields.set(id,vm.pack(dex.fields[id][2],value));};
 for(let i=0;i<1000;i++){
  const renderer=vm.newObject(T('c_FontRenderer')),image=vm.newObject(T('c_Image')),surface=host.makeSurface(16,16);
  set(image,'c_Image','m_surface',surface);set(image,'c_Image','m_source',null);
  set(renderer,'c_FontRenderer','m_charImage',image);set(renderer,'c_FontRenderer','m_native',null);
  vm.call(renderer.$class,'p_Shutdown',[renderer]);
  assert.equal(live.size,1);assert.equal(surface.bitmap,null);
  assert.equal(renderer.$fields.get(field(vm,'c_FontRenderer','m_charImage')),0);
  vm.call(renderer.$class,'p_Shutdown',[renderer]);assert.equal(live.size,1);
 }
 const renderer=vm.newObject(T('c_FontRenderer')),subimage=vm.newObject(T('c_Image'));
 set(subimage,'c_Image','m_surface',shared);set(subimage,'c_Image','m_source',vm.newObject(T('c_Image')));
 set(renderer,'c_FontRenderer','m_charImage',subimage);set(renderer,'c_FontRenderer','m_native',null);
 vm.call(renderer.$class,'p_Shutdown',[renderer]);assert.equal(live.size,1);assert.ok(live.has(shared));
});
