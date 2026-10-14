import test from 'node:test';import assert from 'node:assert/strict';
import {NSMHost} from '../dist/nsm-host.js';import {GLESHost} from '../dist/gles-host.js';
const P='Luk/fiveaces/nsfc/';
function fixture(){const gl={getExtension:()=>null,createTexture:()=>({}),deleteTexture:()=>{}},graphics=new GLESHost(null,{gl}),host=new NSMHost({graphics}),image={width:2,height:2};host.options.surface=()=>{const surface=host.makeSurface(2,2);surface.image=image;return surface;};const vm={unpack:(t,v)=>v};return{graphics,host,image,vm,invoke:(name,proto,args)=>host.invoke(vm,[P+'bb_opengl_gles20;',name],proto,args,true).value};}
test('1000 native 3D bitmap loads retain no temporary GL surfaces and recycle only owned wrappers',()=>{
 const f=fixture(),shared=f.host.makeSurface(2,2);shared.image=f.image;
 for(let i=0;i<1000;i++){const dimensions=[0,0],bitmap=f.invoke('LoadStaticTexImage',['Landroid/graphics/Bitmap;',['Ljava/lang/String;','[I']],['texture',dimensions]);assert.equal(bitmap.surface.image,f.image);assert.deepEqual(dimensions,[2,2]);assert.equal(f.graphics.objects.size,1);f.host.invoke(f.vm,['Landroid/graphics/Bitmap;','recycle'],['V',[]],[bitmap],false);assert.equal(bitmap.surface,null);assert.equal(shared.image,f.image);}
 assert.equal(f.graphics.surfaces.size,1);
});
test('3D image readback transfers its bytes without retaining a surface or duplicating the buffer',()=>{
 const f=fixture(),bytes=new Uint8Array([255,0,0,128]);f.graphics.surfacePixels=()=>bytes;
 for(let i=0;i<1000;i++){const data={},dimensions=[0,0],result=f.invoke('LoadImageData',['Ljava/lang/Object;',['Ljava/lang/Object;','Ljava/lang/String;','[I']],[data,'texture',dimensions]);assert.equal(result.bytes,bytes);assert.equal(result.view.buffer,bytes.buffer);assert.equal(f.graphics.objects.size,0);assert.equal(f.graphics.surfaces.size,0);}
});
