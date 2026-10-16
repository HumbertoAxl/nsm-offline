import {JavaHost} from './java-host.js';
import {BF,F} from './dex-vm.js';
const P='Luk/fiveaces/nsfc/';
const T=name=>P+name+';';
const DATA_BUFFER_METHODS=new Set(['CopyBytes','_PokeFloats','GetByteBuffer','_LoadChunk','_LoadAsync','_New','_Load','Discard']);
const THREAD_METHODS=new Set(['Start','NotifyIn','NotifyOut','SyncIn','SyncOut','IsRunning','Wait','Result','SetResult','CurrentThreadId','SetThreadPriority','DoSynchedIn','DoSynchedOut','run']);
const GRAPHICS_METHODS=new Set(['PreallocateSurface','BeginRender','EndRender','BindFBO','UnbindFBO']);

// Native platform boundary only: game/render/model code remains in the DEX VM.
export class NSMHost extends JavaHost {
  constructor(options={}) { super(options);this.fastStringAccess=true;this.pendingUpdater=null;this.updater=null;this.fieldCache=new Map(); }
  shouldHandle(ref) {
    const [type,name]=ref,short=type.startsWith(P)?type.slice(P.length,-1):type;
    if(short==='c_DataBuffer'&&DATA_BUFFER_METHODS.has(name))return true;
    if(short==='BBThread')return name!=='Run__UNSAFE__';
    if(['c_Thread','c_UpdateThread'].includes(short)&&THREAD_METHODS.has(name))return true;
    if(short==='bb_opengl_gles20')return true;
    if(short==='gxtkGraphics'&&GRAPHICS_METHODS.has(name))return true;
    return super.shouldHandle(ref);
  }
  field(vm,owner,name) {
    const key=owner+'.'+name;if(this.fieldCache.has(key))return this.fieldCache.get(key);
    const id=vm.dex.fields.findIndex(f=>f[0]===T(owner)&&f[1]===name);
    if(id<0)throw new Error('Missing NSM field '+key);
    const resolved=vm.fieldIds[id];this.fieldCache.set(key,resolved);return resolved;
  }
  put(vm,self,owner,name,value) {
    const id=this.field(vm,owner,name),packed=vm.pack(vm.dex.fields[id][2],value);
    (self?self.$fields:vm.statics).set(id,packed);
  }
  setSurfaceFields(vm,surface) {
    for(const name of ['width','height','twidth','theight','uscale','vscale','texId','seq','fbo','createMipmaps','keepBitmap','hasAlpha','tiled','bitmap']) {
      if(name in surface)this.put(vm,surface,'gxtkSurface',name,surface[name]);
    }
  }
  makeSurface(width,height) {
    const surface={$class:T('gxtkSurface'),$fields:new Map(),width,height,seq:1,texId:0,fbo:0,keepBitmap:true,hasAlpha:true,tiled:false,createMipmaps:0};
    surface.bitmap={$class:'Landroid/graphics/Bitmap;',surface};
    this.options.graphics?.registerSurface(surface);return surface;
  }
  surfaceFor(path,destination=null) {
    const source=this.options.surface?.(path);if(!source)return null;
    if(!destination||destination===source)return source;
    // Reuse the DEX surface object, without sharing disposal of another texture.
    if(destination.texture)this.options.graphics?.discardSurface(destination);
    for(const name of ['width','height','twidth','theight','image','canvas','pixels','premultiplied']) {
      if(name in source)destination[name]=source[name];else delete destination[name];
    }
    destination.bitmap={$class:'Landroid/graphics/Bitmap;',surface:destination};
    destination.seq=1;destination.hasAlpha=true;
    this.options.graphics?.registerSurface(destination);if(source.texture)this.options.graphics?.discardSurface(source);return destination;
  }
  drainUpdates(vm) {
    const updater=this.pendingUpdater;if(!updater)return false;
    this.pendingUpdater=null;
    vm.call(updater.$class,'p_OnUpdate',[updater]);
    vm.call(updater.$class,'p_OnRender_Late',[updater]);
    return true;
  }
  invoke(vm,ref,proto,raw,staticCall) {
    const [type,name]=ref,short=type.startsWith(P)?type.slice(P.length,-1):type,self=staticCall?null:raw[0],a=[];
    let i=staticCall?0:1;for(const t of proto[1]){a.push(vm.unpack(t,raw[i++]));if(t==='J'||t==='D')i++;}
    const ret=value=>({handled:true,value}),graphics=this.options.graphics;
    if(short==='BBThread'||(['c_Thread','c_UpdateThread'].includes(short)&&THREAD_METHODS.has(name))) {
      if(name==='<init>')return ret(0);
      if(name==='CurrentThreadId')return ret(1);
      if(name==='SetThreadPriority')return ret(0);
      if(name==='Start') {
        if(self._running)return ret(0);self._running=true;
        if(vm.isInstance(self,T('c_UpdateThread'))) {
          this.updater=self;
          for(const owner of ['c_Mat4','c_Vec3','c_Quaternion'])this.put(vm,null,owner,'m_safeThread',1);
        } else {
          try {vm.call(T('BBThread'),'Run__UNSAFE__',[self]);} finally {self._running=false;}
        }
        return ret(0);
      }
      if(name==='NotifyIn'){if(self===this.updater)this.pendingUpdater=self;return ret(0);}
      if(['NotifyOut','SyncIn','SyncOut','DoSynchedIn','DoSynchedOut','Wait'].includes(name))return ret(0);
      if(name==='IsRunning')return ret(!!self._running);
      if(name==='SetResult'){self._result=a[0];return ret(0);}
      if(name==='Result')return ret(self._result||0);
      if(name==='run') { if(self===this.updater)throw new Error('NSM updater must use the frame scheduler');try{vm.call(T('BBThread'),'Run__UNSAFE__',[self]);}finally{self._running=false;}return ret(0); }
      throw new Error('Unsupported NSM BBThread.'+name);
    }
    if((short==='BBDataBuffer'||short==='c_DataBuffer')&&DATA_BUFFER_METHODS.has(name)) {
      if(name==='_New'){if(self.bytes)return ret(false);self.bytes=new Uint8Array(a[0]);self.view=new DataView(self.bytes.buffer);self.nioBuffer=null;return ret(true);}
      if(name==='_Load'){if(self.bytes)return ret(false);const data=this.files.get(this.path(a[0]));if(!data)return ret(false);self.bytes=data.slice();self.view=new DataView(self.bytes.buffer,self.bytes.byteOffset,self.bytes.byteLength);self.nioBuffer=null;return ret(true);}
      if(name==='Discard'){self.bytes=null;self.view=null;self.nioBuffer=null;return ret(0);}
      if(name==='GetByteBuffer')return ret(this.byteBuffer(self));
      if(name==='CopyBytes') {
        const [offset,destination,destOffset,count]=a;
        if(!self.bytes||!destination?.bytes)throw new Error('CopyBytes requires allocated buffers');
        if(offset<0||destOffset<0||count<0||offset+count>self.bytes.length||destOffset+count>destination.bytes.length)throw new RangeError('CopyBytes range exceeds buffer');
        destination.bytes.set(self.bytes.subarray(offset,offset+count),destOffset);return ret(0);
      }
      if(name==='_PokeFloats') {
        if(!self.bytes)throw new Error('_PokeFloats requires an allocated buffer');
        const values=a[0];if(values.length*4>self.bytes.length)throw new RangeError('_PokeFloats range exceeds buffer');
        for(let j=0;j<values.length;j++)self.view.setFloat32(j*4,values instanceof Float32Array?values[j]:F(values[j]),true);
        return ret(0);
      }
      if(name==='_LoadChunk'){const data=this.files.get(this.path(a[0]));if(!data||!self.bytes)return ret(false);if(a[1]<0||a[1]+self.bytes.length>data.length)throw new RangeError('_LoadChunk range exceeds file');self.bytes.set(data.subarray(a[1],a[1]+self.bytes.length));return ret(true);}
      if(name==='_LoadAsync'){const data=this.files.get(this.path(a[0]));if(data&&!self.bytes){self.bytes=data.slice();self.view=new DataView(self.bytes.buffer);self.nioBuffer=null;vm.call(T('BBThread'),'SetResult',[a[1],self]);}return ret(0);}
    }
    if(short==='BBGame'||short==='BBAndroidGame') {
      if(name==='SaveState') {
        const key=a.length===2?a[0]:'.monkeystate',data=a.length===2?a[1]:a[0];
        this.options.storage?.setItem('nsm-state:'+key,data);return ret(1);
      }
      if(name==='LoadState')return ret(this.options.storage?.getItem('nsm-state:'+(a[0]||'.monkeystate'))||'');
      if(name==='LoadBitmap') {const surface=this.surfaceFor(a[0]);if(!surface)return ret(0);const bitmap=surface.bitmap||{$class:'Landroid/graphics/Bitmap;',surface};graphics.discardSurface(surface);return ret(bitmap);}
      if(name==='SetAutoCapitalText'){this.keyboardText=a[0];this.options.keyboard?.setText(a[0]);return ret(0);}
    }
    if(short==='gxtkGraphics') {
      if(name==='PreallocateSurface')return ret({$class:T('gxtkSurface'),$fields:new Map(),texId:0,seq:0,fbo:0,keepBitmap:true});
      if(name==='LoadSurface'||name==='LoadSurface__UNSAFE__') {
        const unsafe=name.endsWith('__UNSAFE__'),destination=unsafe?a[0]:a[3],path=unsafe?a[1]:a[0];
        const surface=this.surfaceFor(path,destination);if(!surface)return ret(unsafe?false:0);
        surface.keepBitmap=unsafe?true:!!a[1];surface.createMipmaps=unsafe?0:a[2];surface.seq=1;
        this.setSurfaceFields(vm,surface);return ret(unsafe?true:surface);
      }
      if(name==='CreateSurface') {
        const surface=a[2]||this.makeSurface(a[0],a[1]);
        if(a[2]){graphics?.discardSurface(surface);surface.width=a[0];surface.height=a[1];surface.twidth=0;surface.theight=0;delete surface.image;delete surface.canvas;surface.pixels=new Uint8Array(a[0]*a[1]*4);surface.bitmap={$class:'Landroid/graphics/Bitmap;',surface};}
        surface.createMipmaps=a[3]||0;surface.seq=1;surface.keepBitmap=true;surface.hasAlpha=true;
        graphics?.registerSurface(surface);this.setSurfaceFields(vm,surface);return ret(surface);
      }
      if(name==='BeginRender'){this.put(vm,self,'gxtkGraphics','drawCalls',0);this.put(vm,self,'gxtkGraphics','width',this.options.width||1280);this.put(vm,self,'gxtkGraphics','height',this.options.height||720);const seq=vm.statics.get(this.field(vm,'gxtkGraphics','seq'))||1;if(self.$fields.get(this.field(vm,'gxtkGraphics','vbo_seq'))!==seq)vm.withInstructionBudget(500_000_000,()=>vm.call(T('gxtkGraphics'),'CreateBuffers',[self]));graphics.gl.viewport(0,0,this.options.width||1280,this.options.height||720);return ret(0);}
      if(name==='EndRender')return ret(0);
      if(name==='BindFBO') {const surface=a[0],id=graphics.createSurfaceFramebuffer(surface,!!a[1]);graphics.invoke('glBindFramebuffer',[36160,id]);graphics.gl.viewport(0,0,surface.width,surface.height);this.put(vm,self,'gxtkGraphics','activeFBO',id);this.setSurfaceFields(vm,surface);return ret(0);}
      if(name==='UnbindFBO'){graphics.invoke('glBindFramebuffer',[36160,0]);graphics.gl.viewport(0,0,this.options.width||640,this.options.height||960);this.put(vm,self,'gxtkGraphics','activeFBO',0);return ret(0);}
    }
    if(short==='gxtkSurface') {
      if(name==='<init>'){Object.assign(self,{texId:0,seq:0,fbo:0,keepBitmap:true,tiled:false,createMipmaps:0});if(a[0]){const source=a[0].surface;Object.assign(self,{width:source.width,height:source.height,image:source.image,canvas:source.canvas,pixels:source.pixels,bitmap:a[0]});graphics.registerSurface(self);}this.setSurfaceFields(vm,self);return ret(0);}
      if(name==='SetBitmap'){const source=a[0].surface;Object.assign(self,{width:source.width,height:source.height,image:source.image,canvas:source.canvas,pixels:source.pixels,bitmap:a[0]});graphics.registerSurface(self);this.setSurfaceFields(vm,self);return ret(0);}
      if(name==='APIHandle')return ret(self.texId||0);
      if(name==='HasValidAPIHandle')return ret((self.texId||0)>0);
      if(name==='Width'||name==='Height'||name==='TWidth'||name==='THeight')return ret(self[{Width:'width',Height:'height',TWidth:'twidth',THeight:'theight'}[name]]||0);
      if(name==='Pow2Size')return ret(2**Math.ceil(Math.log2(Math.max(1,a[0]))));
      if(name==='Loaded')return ret(1);
      if(name==='Bind'||name==='Bind2'||name==='BindDirect') {this.boundSurface=self;graphics.bindSurface(self,name==='BindDirect'?a[0]:0);self.seq=1;this.setSurfaceFields(vm,self);return ret(0);}
      if(name==='Discard'||name==='Invalidate'){graphics.discardSurface(self);if(this.boundSurface===self)this.boundSurface=null;if(name==='Discard'){self.bitmap=null;self.image=null;self.canvas=null;self.pixels=null;}self.seq=0;this.setSurfaceFields(vm,self);return ret(0);}
      if(name==='EnableTiling'){self.tiled=!!a[0];if(self.uploaded)graphics.updateSurface(self);this.setSurfaceFields(vm,self);return ret(0);}
      if(name==='SetMipMapping'){self.createMipmaps=a[0];if(a[1]&&self.uploaded)graphics.updateSurface(self);this.setSurfaceFields(vm,self);return ret(0);}
      if(name==='RefreshMipMaps'){graphics.bindSurface(self);if(self.createMipmaps>0)graphics.gl.generateMipmap(graphics.gl.TEXTURE_2D);return ret(0);}
      if(['FlushDiscarded','OnUnsafeLoadComplete','DiscardData'].includes(name))return ret(0);
      throw new Error('Unsupported NSM gxtkSurface.'+name);
    }
    if(short==='bb_opengl_gles20') {
      if(name==='LoadImageData'||name==='LoadStaticTexImage') {
        const surface=this.surfaceFor(a[name==='LoadImageData'?1:0]);if(!surface)return ret(0);
        const dimensions=a[name==='LoadImageData'?2:1];if(dimensions.length>0)dimensions[0]=surface.width;if(dimensions.length>1)dimensions[1]=surface.height;
        graphics.discardSurface(surface);
        if(name==='LoadStaticTexImage'){const bitmap=surface.bitmap||{$class:'Landroid/graphics/Bitmap;',surface};bitmap.temporary=true;return ret(bitmap);}
        // Transfer the temporary readback to the DEX buffer, retaining no registry copy.
        a[0].bytes=graphics.surfacePixels(surface);a[0].view=new DataView(a[0].bytes.buffer,a[0].bytes.byteOffset,a[0].bytes.byteLength);surface.pixels=null;surface.image=null;surface.canvas=null;surface.bitmap=null;return ret(a[0]);
      }
      if(name==='initNativeGL'||name==='<init>')return ret(0);
      if(name==='_glTexImage2D2'||name==='_glTexSubImage2D2') {const index=name==='_glTexImage2D2'?5:4,bitmap=a[index];if(bitmap?.surface){const surface=bitmap.surface;if(surface.image||surface.canvas)a[index]=surface.image||surface.canvas;else {const data={bytes:graphics.surfacePixels(surface)};return ret(name==='_glTexImage2D2'?graphics.invoke('_glTexImage2D',[a[0],a[1],a[2],surface.width,surface.height,0,a[3],a[4],data]):graphics.invoke('_glTexSubImage2D',[a[0],a[1],a[2],a[3],surface.width,surface.height,6408,5121,data]));}}}
      return ret(graphics.invoke(name,a,proto));
    }
    if(type==='Landroid/opengl/GLES20;')return ret(graphics.invoke(name,a,proto));
    if(type==='Landroid/graphics/Bitmap;') {
      if(name==='hasAlpha')return ret(true);
      if(name==='recycle'){if(self.temporary&&self.surface){graphics.discardSurface(self.surface);self.surface.image=null;self.surface.canvas=null;self.surface.pixels=null;self.surface.bitmap=null;self.surface=null;}return ret(0);}
    }
    if(/^Ljava\/nio\/(Byte|Short|Int|Float)Buffer;$/.test(type)&&(name==='allocate'||name==='allocateDirect')) {
      const unit=type.includes('ByteBuffer')?1:type.includes('ShortBuffer')?2:4;
      return ret({$class:type,bytes:new Uint8Array(a[0]*unit),position:0,unit});
    }
    if(type==='Ljava/nio/ByteBuffer;'&&name==='asShortBuffer')return ret({$class:'Ljava/nio/ShortBuffer;',bytes:self.bytes,position:0,unit:2});
    if(short==='FontNative') {
      if(name==='IsSwitchDevice')return ret(false);
      if(name==='ResolveLigatures')return ret(a[0]);
      if(name==='ConfigureFallbackFonts'||name==='Print')return ret(0);
      if(name==='GetFaceIdFromIndex'||name==='GetFaceSizeIdFromIndex') {let index=0;for(let face=0;face<self.faces.length;face++)for(let size=0;size<self.faces[face].sizes.length;size++){if(index++===a[0])return ret(name==='GetFaceIdFromIndex'?face:size);}return ret(-1);}
    }
    if(short==='gxtkAudio'&&name==='LoadSample__UNSAFE__'){a[0].path=a[1];this.options.audio?.load(a[1]);return ret(true);}
    return super.invoke(vm,ref,proto,raw,staticCall);
  }
  byteBuffer(self){if(!self.bytes)return 0;if(!self.nioBuffer||self.nioBuffer.bytes!==self.bytes)self.nioBuffer={$class:'Ljava/nio/ByteBuffer;',bytes:self.bytes,position:0,unit:1};return self.nioBuffer;}
  interceptsField(vm,id){return vm.dex.fields[id][0]===T('BBDataBuffer')||super.interceptsField(vm,id);}
  getField(vm,obj,id) {
    const [fieldOwner,bufferName]=vm.dex.fields[id];if(fieldOwner===T('BBDataBuffer')){if(bufferName==='_data')return this.byteBuffer(obj);if(bufferName==='_length')return obj.bytes?.length||0;}
    if(obj.$class===T('gxtkSurface')) {
      const [,name,type]=vm.dex.fields[id];
      if(name in obj)return type==='F'?BF(obj[name]):type==='Z'?obj[name]?1:0:obj[name];
    }
    return super.getField(vm,obj,id);
  }
}






