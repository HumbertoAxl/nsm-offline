import {F, BF} from './dex-vm.js';

// Android GLES2 uses integer names and Java arrays; WebGL uses opaque objects.
// Keep this bridge independent of game classes so other GLES2 DEX games can use it.
export class GLESHost {
  constructor(canvas, options = {}) {
    this.gl = options.gl || canvas.getContext('webgl', {alpha:false, depth:true, stencil:true, antialias:true, preserveDrawingBuffer:false});
    if (!this.gl) throw new Error('WebGL 1 is unavailable');
    this.objects = new Map(); this.ids = new WeakMap(); this.nextId = 1;
    this.locations = new Map(); this.locationIds = new Map(); this.nextLocation = 1;
    this.boundBuffers = new Map(); this.clientAttributes = new Map(); this.clientIndexBuffer = null;
    this.stats = {draws:0, uploads:0, shaders:0};
    this.gl.getExtension('OES_element_index_uint');
    this.discard = this.gl.getExtension('EXT_discard_framebuffer');
  }
  register(object, kind) {
    if (!object) return 0;
    const existing = this.ids.get(object); if (existing) return existing;
    const id = this.nextId++; this.objects.set(id, {object,kind}); this.ids.set(object,id); return id;
  }
  object(id, kind) {
    if (id === 0 || id == null) return null;
    const item = this.objects.get(id);
    if (!item || (kind && item.kind !== kind)) throw new Error(`Unknown GLES ${kind || 'object'} ${id}`);
    return item.object;
  }
  location(id) { if (id === -1) return null; if (!this.locations.has(id)) throw new Error(`Unknown GLES uniform location ${id}`); return this.locations.get(id); }
  parameter(value) {
    if (value && typeof value === 'object' && !ArrayBuffer.isView(value) && !Array.isArray(value)) return this.ids.get(value) || 0;
    return value;
  }
  write(destination, offset, value, floats = false) {
    const values = Array.isArray(value) || ArrayBuffer.isView(value) ? value : [this.parameter(value)];
    if (destination?.bytes) {
      const v = new DataView(destination.bytes.buffer, destination.bytes.byteOffset, destination.bytes.byteLength);
      let pos = ((destination.position || 0) + (offset || 0)) * (destination.unit || 4);
      for (const item of values) { if (floats) v.setFloat32(pos, Number(item), true); else v.setInt32(pos, Number(item), true); pos += 4; }
    } else {
      const array = destination?.array || destination;
      if (!array) throw new Error('Missing GLES output array');
      const start = (destination?.position || 0) + (offset || 0);
      for (let i=0;i<values.length;i++) array[start+i] = floats ? BF(values[i]) : Number(values[i]);
    }
  }
  bytes(source, offset=0, length) {
    if (source == null || source === 0) return null;
    if (source instanceof ArrayBuffer) source = new Uint8Array(source);
    if (ArrayBuffer.isView(source)) return new Uint8Array(source.buffer,source.byteOffset+offset,length ?? source.byteLength-offset);
    if (source.bytes) {
      const start = (source.position || 0) * (source.unit || 1) + offset;
      return source.bytes.subarray(start,length == null ? undefined : start+length);
    }
    if (source.array || Array.isArray(source)) {
      const array = source.array || source, unit = source.unit || 1;
      const start = (source.position || 0) * unit + offset;
      const count = length ?? array.length * unit - start;
      if(!Number.isInteger(start)||!Number.isInteger(count)||start<0||count<0||start+count>array.length*unit)throw new RangeError('GLES array buffer range exceeds backing array');
      if(ArrayBuffer.isView(array)&&array.BYTES_PER_ELEMENT===unit)return new Uint8Array(array.buffer,array.byteOffset+start,count);
      const result = new Uint8Array(count), view = new DataView(result.buffer);
      const setter = unit===4?'setInt32':unit===2?'setInt16':'setInt8';
      let src=start,dst=0;
      // Handle a partial leading element, then write only complete requested
      // elements. Never materialize unused capacity of Java's large VBO array.
      while(dst<count&&src%unit){result[dst++]=(array[Math.floor(src/unit)]>>((src%unit)*8))&255;src++;}
      while(dst+unit<=count){view[setter](dst,array[src/unit],true);src+=unit;dst+=unit;}
      while(dst<count){result[dst++]=(array[Math.floor(src/unit)]>>((src%unit)*8))&255;src++;}
      return result;
    }
    const wrapped = source._data || source.data;
    if (wrapped) return this.bytes(wrapped,offset,length);
    throw new Error('Unsupported GLES data buffer');
  }
  array(source, offset, length, floats) {
    if (source?.bytes) {
      const bytes = this.bytes(source,offset*4,length*4), data = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
      return Array.from({length},(_,i)=>floats?data.getFloat32(i*4,true):data.getInt32(i*4,true));
    }
    const array = source?.array || source, start = (source?.position || 0)+(offset || 0);
    return Array.from({length},(_,i)=>floats?(array instanceof Float32Array?array[start+i]:F(array[start+i])):array[start+i]);
  }
  pixelView(source, type, offset=0) {
    const bytes = this.bytes(source,offset); if (!bytes) return null;
    const Constructor = type===this.gl.FLOAT?Float32Array:[this.gl.UNSIGNED_SHORT,this.gl.UNSIGNED_SHORT_4_4_4_4,this.gl.UNSIGNED_SHORT_5_5_5_1,this.gl.UNSIGNED_SHORT_5_6_5].includes(type)?Uint16Array:type===this.gl.UNSIGNED_INT?Uint32Array:Uint8Array;
    if (bytes.byteOffset % Constructor.BYTES_PER_ELEMENT) return new Constructor(bytes.slice().buffer);
    return new Constructor(bytes.buffer,bytes.byteOffset,Math.floor(bytes.byteLength/Constructor.BYTES_PER_ELEMENT));
  }
  invoke(originalName, input, proto) {
    const gl = this.gl, wrapper = originalName.startsWith('_'), name = wrapper ? originalName.slice(1) : originalName;
    const a = [...input];
    if (name === 'initNativeGL') return 0;
    const create = {glCreateBuffer:'Buffer',glCreateTexture:'Texture',glCreateFramebuffer:'Framebuffer',glCreateRenderbuffer:'Renderbuffer',glCreateProgram:'Program',glCreateShader:'Shader'};
    if (create[name]) { const kind=create[name]; if(kind==='Shader')this.stats.shaders++; return this.register(gl['create'+kind](...a),kind); }
    const generated = /^glGen(Buffers|Textures|Framebuffers|Renderbuffers)$/.exec(name);
    if (generated) { const kind=generated[1].slice(0,-1); for(let i=0;i<a[0];i++)this.write(a[1],(a[2]||0)+i,this.register(gl['create'+kind](),kind)); return 0; }
    const deletion = /^glDelete(Buffer|Texture|Framebuffer|Renderbuffer|Program|Shader)(s?)$/.exec(name);
    if (deletion) { const kind=deletion[1], ids=deletion[2]?this.array(a[1],a[2]||0,a[0],false):[a[0]]; for(const id of ids){if(!id)continue; gl['delete'+kind](this.object(id,kind)); this.objects.delete(id); if(kind==='Texture'){const surface=this.surfaces?.get(id);this.surfaces?.delete(id);if(surface){surface.texture=null;surface.texId=0;surface.uploaded=false;if(this.bound===surface)this.bound=null;}} if(kind==='Program'){for(const [key,location]of this.locationIds){if(key.startsWith(id+':')){this.locationIds.delete(key);this.locations.delete(location);}}}} return 0; }
    const bindings={glBindBuffer:'Buffer',glBindTexture:'Texture',glBindFramebuffer:'Framebuffer',glBindRenderbuffer:'Renderbuffer'};
    if(name==='glBindTexture'&&this.surfaces?.has(a[1])){const surface=this.surfaces.get(a[1]);if(!surface.uploaded)this.updateSurface(surface);}
    if(bindings[name]) { gl[name.slice(2,3).toLowerCase()+name.slice(3)](a[0],this.object(a[1],bindings[name])); if(name==='glBindBuffer')this.boundBuffers.set(a[0],a[1]); return 0; }
    if(name==='glUseProgram'){gl.useProgram(this.object(a[0],'Program'));return 0;}
    if(name==='glAttachShader'||name==='glDetachShader'){gl[name==='glAttachShader'?'attachShader':'detachShader'](this.object(a[0],'Program'),this.object(a[1],'Shader'));return 0;}
    if(name==='glShaderSource'){gl.shaderSource(this.object(a[0],'Shader'),a[1]);return 0;}
    if(name==='glCompileShader'||name==='glLinkProgram'||name==='glValidateProgram'){const kind=name==='glCompileShader'?'Shader':'Program';gl[name.slice(2,3).toLowerCase()+name.slice(3)](this.object(a[0],kind));return 0;}
    if(name==='glBindAttribLocation'){gl.bindAttribLocation(this.object(a[0],'Program'),a[1],a[2]);return 0;}
    if(name==='glGetAttribLocation')return gl.getAttribLocation(this.object(a[0],'Program'),a[1]);
    if(name==='glGetUniformLocation'){
      const key=a[0]+':'+a[1]; if(this.locationIds.has(key))return this.locationIds.get(key);
      const location=gl.getUniformLocation(this.object(a[0],'Program'),a[1]); if(location===null)return -1;
      const id=this.nextLocation++;this.locations.set(id,location);this.locationIds.set(key,id);return id;
    }
    if(name==='glGetShaderInfoLog'||name==='glGetProgramInfoLog'||name==='glGetShaderSource')return gl[name.slice(2,3).toLowerCase()+name.slice(3)](this.object(a[0],name.includes('Program')?'Program':'Shader')) || '';
    if(name==='glGetProgramiv'||name==='glGetShaderiv'){this.write(a[2],a[3]||0,gl[name==='glGetProgramiv'?'getProgramParameter':'getShaderParameter'](this.object(a[0],name==='glGetProgramiv'?'Program':'Shader'),a[1]));return 0;}
    if(name==='glGetActiveUniform'||name==='glGetActiveAttrib'){
      const value=gl[name==='glGetActiveUniform'?'getActiveUniform':'getActiveAttrib'](this.object(a[0],'Program'),a[1]) || {name:'',size:0,type:0};
      if(wrapper){this.write(a[2],0,value.size);this.write(a[3],0,value.type);a[4][0]=value.name;}
      else if(a.length===4){this.write(a[2],0,value.size);this.write(a[3],0,value.type);return value.name;}
      else {const bytes=new TextEncoder().encode(value.name),count=Math.min(bytes.length,a[2]-1);this.write(a[3],a[4],count);this.write(a[5],a[6],value.size);this.write(a[7],a[8],value.type);for(let i=0;i<count;i++)a[9][a[10]+i]=bytes[i];a[9][a[10]+count]=0;}
      return 0;
    }
    if(name==='glGetAttachedShaders'){
      const values=(gl.getAttachedShaders(this.object(a[0],'Program'))||[]).slice(0,a[1]).map(o=>this.ids.get(o));
      this.write(a[2],wrapper?0:a[3],values.length);this.write(wrapper?a[3]:a[4],wrapper?0:a[5],values);return 0;
    }
    const uniform=/^glUniform([1-4])(f|i)(v?)$/.exec(name);
    if(uniform){const size=Number(uniform[1]),floats=uniform[2]==='f',vector=!!uniform[3],location=this.location(a[0]);if(location===null)return 0;const method='uniform'+uniform[1]+uniform[2]+uniform[3];if(vector)gl[method](location,this.array(a[2],a[3]||0,a[1]*size,floats));else gl[method](location,...a.slice(1));return 0;}
    const matrix=/^glUniformMatrix([2-4])fv$/.exec(name);
    if(matrix){const size=Number(matrix[1]),location=this.location(a[0]);if(location!==null)gl['uniformMatrix'+size+'fv'](location,!!a[2],this.array(a[3],a[4]||0,a[1]*size*size,true));return 0;}
    const attrib=/^glVertexAttrib([1-4])(f|fv)$/.exec(name);
    if(attrib){gl['vertexAttrib'+attrib[1]+attrib[2]](a[0],...(attrib[2]==='fv'?[this.array(a[1],a[2]||0,Number(attrib[1]),true)]:a.slice(1)));return 0;}
    if(name==='glBufferData'){gl.bufferData(a[0],a[2]==null||a[2]===0?a[1]:this.bytes(a[2],0,a[1]),a[3]);this.stats.uploads++;return 0;}
    if(name==='glBufferSubData'){gl.bufferSubData(a[0],a[1],this.bytes(a[3],a[4]||0,a[2]));this.stats.uploads++;return 0;}
    if(name==='glVertexAttribPointer'){
      if(typeof a[5]==='number'){this.clientAttributes.delete(a[0]);gl.vertexAttribPointer(a[0],a[1],a[2],!!a[3],a[4],a[5]);}
      else {let record=this.clientAttributes.get(a[0]);if(!record){record={buffer:gl.createBuffer()};this.clientAttributes.set(a[0],record);}Object.assign(record,{source:a[5],offset:a[6]||0,args:a.slice(0,5)});this.uploadClientAttribute(record);}
      return 0;
    }
    if(name==='glDrawArrays'){this.uploadClientAttributes();gl.drawArrays(...a);this.stats.draws++;return 0;}
    if(name==='glDrawElements'){
      this.uploadClientAttributes(); if(typeof a[3]==='number')gl.drawElements(...a);
      else {const bound=this.boundBuffers.get(gl.ELEMENT_ARRAY_BUFFER)||0;this.clientIndexBuffer ||= gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.clientIndexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,this.bytes(a[3],a[4]||0),gl.STREAM_DRAW);gl.drawElements(a[0],a[1],a[2],0);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.object(bound,'Buffer'));}
      this.stats.draws++;return 0;
    }
    if(name==='glTexImage2D2'){const image=a[5]?.image||a[5]?.canvas||a[5];if(image)gl.texImage2D(a[0],a[1],a[2],a[3],a[4],image);this.stats.uploads++;return 0;}
    if(name==='glTexSubImage2D2'){const image=a[4]?.image||a[4]?.canvas||a[4];if(image)gl.texSubImage2D(a[0],a[1],a[2],a[3],gl.RGBA,gl.UNSIGNED_BYTE,image);this.stats.uploads++;return 0;}
    if(name==='glTexImage2D'){gl.texImage2D(...a.slice(0,8),this.pixelView(a[8],a[7]));this.stats.uploads++;return 0;}
    if(name==='glTexSubImage2D'){gl.texSubImage2D(...a.slice(0,8),this.pixelView(a[8],a[7],a[9]||0));this.stats.uploads++;return 0;}
    if(name==='glReadPixels'){gl.readPixels(...a.slice(0,6),this.pixelView(a[6],a[5],a[7]||0));return 0;}
    if(name==='glFramebufferTexture2D'){const surface=this.surfaces?.get(a[3]);if(surface&&!surface.uploaded)this.updateSurface(surface);gl.framebufferTexture2D(a[0],a[1],a[2],this.object(a[3],'Texture'),a[4]);return 0;}
    if(name==='glFramebufferRenderbuffer'){gl.framebufferRenderbuffer(a[0],a[1],a[2],this.object(a[3],'Renderbuffer'));return 0;}
    if(name==='glDiscardZ'){if(this.discard)this.discard.discardFramebufferEXT(gl.FRAMEBUFFER,[gl.DEPTH_ATTACHMENT]);return 0;}
    if(name==='glIsTexture')return gl.isTexture(this.object(a[0],'Texture'));
    if(name==='glGetIntegerv'||name==='glGetBooleanv'||name==='glGetFloatv'){this.write(a[1],a[2]||0,gl.getParameter(a[0]),name==='glGetFloatv');return 0;}
    const getters={glGetBufferParameteriv:['getBufferParameter',2,false],glGetRenderbufferParameteriv:['getRenderbufferParameter',2,false],glGetTexParameteriv:['getTexParameter',2,false],glGetTexParameterfv:['getTexParameter',2,true],glGetFramebufferAttachmentParameteriv:['getFramebufferAttachmentParameter',3,false],glGetVertexAttribiv:['getVertexAttrib',2,false],glGetVertexAttribfv:['getVertexAttrib',2,true]};
    if(getters[name]){const [method,count,float]=getters[name];this.write(a[count],a[count+1]||0,gl[method](...a.slice(0,count)),float);return 0;}
    if(name==='glGetUniformfv'||name==='glGetUniformiv'){this.write(a[2],a[3]||0,gl.getUniform(this.object(a[0],'Program'),this.location(a[1])),name==='glGetUniformfv');return 0;}
    if(name==='glDepthRangef'){gl.depthRange(...a);return 0;}
    if(name==='glClearDepthf'){gl.clearDepth(...a);return 0;}
    const direct=new Set(['glActiveTexture','glBlendFunc','glBlendFuncSeparate','glBlendEquation','glBlendEquationSeparate','glBlendColor','glCheckFramebufferStatus','glClear','glClearColor','glColorMask','glCullFace','glDepthFunc','glDepthMask','glDisable','glDisableVertexAttribArray','glEnable','glEnableVertexAttribArray','glFinish','glFlush','glFrontFace','glGenerateMipmap','glGetError','glGetString','glHint','glLineWidth','glPixelStorei','glPolygonOffset','glRenderbufferStorage','glSampleCoverage','glScissor','glStencilFunc','glStencilFuncSeparate','glStencilMask','glStencilMaskSeparate','glStencilOp','glStencilOpSeparate','glTexParameteri','glTexParameterf','glViewport']);
    if(direct.has(name)){if(name==='glGetString')return gl.getParameter(a[0]);const method=name.slice(2,3).toLowerCase()+name.slice(3);return gl[method](...a) ?? 0;}
    throw new Error(`GLES20 bridge is missing ${originalName}`);
  }
  uploadClientAttribute(record) {
    const gl=this.gl,bound=this.boundBuffers.get(gl.ARRAY_BUFFER)||0;
    gl.bindBuffer(gl.ARRAY_BUFFER,record.buffer);gl.bufferData(gl.ARRAY_BUFFER,this.bytes(record.source),gl.STREAM_DRAW);
    gl.vertexAttribPointer(record.args[0],record.args[1],record.args[2],!!record.args[3],record.args[4],record.offset);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.object(bound,'Buffer'));
  }
  uploadClientAttributes(){for(const record of this.clientAttributes.values())this.uploadClientAttribute(record);}
  registerSurface(surface) {
    const pow2 = n => 2 ** Math.ceil(Math.log2(Math.max(1,n)));
    surface.width ||= surface.image?.width || surface.canvas?.width || surface.bitmap?.width || 1;
    surface.height ||= surface.image?.height || surface.canvas?.height || surface.bitmap?.height || 1;
    surface.twidth ||= pow2(surface.width); surface.theight ||= pow2(surface.height);
    surface.uscale = 1/surface.twidth; surface.vscale = 1/surface.theight;
    if (!surface.texture || !this.objects.has(surface.texId)) {
      surface.texture = this.gl.createTexture(); surface.texId = this.register(surface.texture,'Texture'); surface.uploaded = false;
    }
    this.surfaces ||= new Map(); this.surfaces.set(surface.texId,surface); return surface.texId;
  }
  makeCanvas(width,height) {
    const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(width,height) : document.createElement('canvas');
    canvas.width=width;canvas.height=height;return canvas;
  }
  surfacePixels(surface) {
    if (!surface.pixels) {
      const image=surface.image||surface.canvas||surface.bitmap?.image||surface.bitmap?.canvas;
      if(image){const canvas=this.makeCanvas(surface.width,surface.height),ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,surface.width,surface.height).data;surface.pixels=new Uint8Array(data.buffer,data.byteOffset,data.byteLength);canvas.width=canvas.height=0;}
      else surface.pixels=new Uint8Array(surface.width*surface.height*4);
    }
    return surface.pixels;
  }
  paddedPixels(surface) {
    const pixels=this.surfacePixels(surface),width=surface.width,height=surface.height,tw=surface.twidth,th=surface.theight;
    const result=new Uint8Array(tw*th*4);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const src=(y*width+x)*4,dst=(y*tw+x)*4,alpha=pixels[src+3];
      for(let k=0;k<3;k++)result[dst+k]=surface.premultiplied?pixels[src+k]:Math.round(pixels[src+k]*alpha/255);
      result[dst+3]=alpha;
    }
    // Duplicate border texels, matching the Android atlas padding convention.
    if(width<tw)for(let y=0;y<height;y++)result.set(result.subarray((y*tw+width-1)*4,(y*tw+width)*4),(y*tw+width)*4);
    if(height<th)result.set(result.subarray((height-1)*tw*4,height*tw*4),height*tw*4);
    return result;
  }
  withSurfaceTexture(surface,callback) {
    const gl=this.gl;this.registerSurface(surface);
    const previous=gl.getParameter(gl.TEXTURE_BINDING_2D),premultiply=gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL),flip=gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL),alignment=gl.getParameter(gl.UNPACK_ALIGNMENT);
    gl.bindTexture(gl.TEXTURE_2D,surface.texture);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
    try{return callback();}finally{gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,premultiply);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,flip);gl.pixelStorei(gl.UNPACK_ALIGNMENT,alignment);gl.bindTexture(gl.TEXTURE_2D,previous);}
  }
  uploadSurface(surface) {
    const gl=this.gl;
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,surface.twidth,surface.theight,0,gl.RGBA,gl.UNSIGNED_BYTE,this.paddedPixels(surface));
    // Retain pixels only for mutable surfaces; immutable images can recreate them.
    if((surface.image||surface.canvas)&&!surface.modified)surface.pixels=null;
    const filter=surface.createMipmaps<0?gl.NEAREST:gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,surface.tiled?gl.REPEAT:gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,surface.tiled?gl.REPEAT:gl.CLAMP_TO_EDGE);
    if(surface.createMipmaps>0){gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,surface.createMipmaps>1?gl.LINEAR_MIPMAP_LINEAR:gl.NEAREST_MIPMAP_LINEAR);}
    surface.uploaded=true;this.stats.uploads++;
  }
  bindSurface(surface,channel=0) {
    const gl=this.gl;this.registerSurface(surface);gl.activeTexture(gl.TEXTURE0+channel);
    if(!surface.uploaded)this.withSurfaceTexture(surface,()=>this.uploadSurface(surface));
    gl.bindTexture(gl.TEXTURE_2D,surface.texture);this.bound=surface;return surface.texId;
  }
  updateSurface(surface) {this.withSurfaceTexture(surface,()=>this.uploadSurface(surface));}
  discardSurface(surface) {
    if(surface.texture){this.gl.deleteTexture(surface.texture);this.objects.delete(surface.texId);this.surfaces?.delete(surface.texId);}
    if(surface.fbo){this.invoke('glDeleteFramebuffer',[surface.fbo]);surface.fbo=0;}
    if(surface.depthBuffer){this.invoke('glDeleteRenderbuffer',[surface.depthBuffer]);surface.depthBuffer=0;}
    if(this.bound===surface)this.bound=null;
    surface.texture=null;surface.texId=0;surface.uploaded=false;
  }
  createSurfaceFramebuffer(surface, depth=false) {
    this.registerSurface(surface);if(!surface.uploaded)this.updateSurface(surface);
    if(!surface.fbo){const gl=this.gl,previous=gl.getParameter(gl.FRAMEBUFFER_BINDING);surface.fbo=this.invoke('glCreateFramebuffer',[]);gl.bindFramebuffer(gl.FRAMEBUFFER,this.object(surface.fbo,'Framebuffer'));gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,surface.texture,0);const status=gl.checkFramebufferStatus(gl.FRAMEBUFFER);gl.bindFramebuffer(gl.FRAMEBUFFER,previous);if(status!==gl.FRAMEBUFFER_COMPLETE)throw new Error(`Surface framebuffer incomplete: ${status}`);}
    if(depth&&!surface.depthBuffer){const gl=this.gl,previous=gl.getParameter(gl.FRAMEBUFFER_BINDING),renderbuffer=gl.getParameter(gl.RENDERBUFFER_BINDING);surface.depthBuffer=this.invoke('glCreateRenderbuffer',[]);gl.bindFramebuffer(gl.FRAMEBUFFER,this.object(surface.fbo,'Framebuffer'));gl.bindRenderbuffer(gl.RENDERBUFFER,this.object(surface.depthBuffer,'Renderbuffer'));gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,surface.twidth,surface.theight);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,this.object(surface.depthBuffer,'Renderbuffer'));gl.bindRenderbuffer(gl.RENDERBUFFER,renderbuffer);gl.bindFramebuffer(gl.FRAMEBUFFER,previous);}
    return surface.fbo;
  }
  drawGlyph(surface,char,point,family,x,y,metrics,size,fy) {
    const width=Math.max(1,Math.ceil(metrics.width+1)),height=Math.max(1,Math.ceil(metrics.height+1)),canvas=this.makeCanvas(width,height),ctx=canvas.getContext('2d');
    ctx.font=`${point}px '${family}'`;ctx.fillStyle='#fff';ctx.fillText(char,-metrics.bearingX,metrics.bearingY);
    const pixels=ctx.getImageData(0,0,width,height).data,gradient=size.gradient?this.surfacePixels(size.gradient):null;
    for(let row=0;row<height;row++)for(let col=0;col<width;col++){
      const p=(row*width+col)*4,alpha=pixels[p+3];
      if(gradient){const yy=Math.max(0,Math.min(size.gradient.height-1,row+Math.trunc(size.gradient.height/2)-Math.trunc(fy)+(size.gradientY||0))),xx=Math.min(size.gradient.width-1,col),g=(yy*size.gradient.width+xx)*4;for(let k=0;k<3;k++)pixels[p+k]=Math.trunc(gradient[g+k]*alpha/255);}
      else pixels[p]=pixels[p+1]=pixels[p+2]=alpha;
    }
    this.writeSurfacePatch(surface,x,y,width,height,pixels,true);
  }
  writeSurfacePatch(surface,x,y,width,height,pixels,premultiplied=false) {
    this.registerSurface(surface);surface.modified=true;const target=this.surfacePixels(surface);
    // Dynamic font atlases start transparent and store premultiplied RGB.
    if(premultiplied&&!surface.premultiplied){for(let p=0;p<target.length;p+=4)for(let k=0;k<3;k++)target[p+k]=Math.round(target[p+k]*target[p+3]/255);surface.premultiplied=true;}
    const patch=new Uint8Array(width*height*4);patch.set(pixels);
    if(surface.premultiplied&&!premultiplied)for(let p=0;p<patch.length;p+=4)for(let k=0;k<3;k++)patch[p+k]=Math.round(patch[p+k]*patch[p+3]/255);
    for(let row=0;row<height;row++){if(row+y<0||row+y>=surface.height)continue;const left=Math.max(0,-x),right=Math.min(width,surface.width-x);if(right>left)target.set(patch.subarray((row*width+left)*4,(row*width+right)*4),((row+y)*surface.width+x+left)*4);}
    this.withSurfaceTexture(surface,()=>{if(!surface.uploaded)this.uploadSurface(surface);else if(x>=0&&y>=0&&x+width<=surface.twidth&&y+height<=surface.theight){const gpu=new Uint8Array(patch);if(!surface.premultiplied)for(let p=0;p<gpu.length;p+=4)for(let k=0;k<3;k++)gpu[p+k]=Math.round(gpu[p+k]*gpu[p+3]/255);this.gl.texSubImage2D(this.gl.TEXTURE_2D,0,x,y,width,height,this.gl.RGBA,this.gl.UNSIGNED_BYTE,gpu);this.stats.uploads++;}else this.uploadSurface(surface);});
  }
  copySurface(source,x,y,width,height,destination) {
    const pixels=this.surfacePixels(source),patch=new Uint8Array(width*height*4);
    for(let row=0;row<Math.min(height,source.height);row++)patch.set(pixels.subarray(row*source.width*4,row*source.width*4+Math.min(width,source.width)*4),row*width*4);
    this.writeSurfacePatch(destination,x,y,width,height,patch,!!source.premultiplied);
  }
}
