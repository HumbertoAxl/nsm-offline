// DEX execution substrate. Game instructions are retained from the supplied APK.
// Numeric registers retain raw bits; float conversions follow DEX rather than JS coercion.
import {compileDex} from './dex-jit.js';
const view=new DataView(new ArrayBuffer(8));
export const F=v=>{view.setInt32(0,v|0,true);return view.getFloat32(0,true);};
export const BF=v=>{view.setFloat32(0,v,true);return view.getInt32(0,true);};
export const D=v=>{view.setBigInt64(0,BigInt(v||0),true);return view.getFloat64(0,true);};
export const BD=v=>{view.setFloat64(0,v,true);return view.getBigInt64(0,true);};
const i16=v=>(v<<16)>>16, i8=v=>(v<<24)>>24;
const i32=(a,b)=>(a|(b<<16))|0;
const sig=(name,proto)=>name+'('+proto[1].join('')+')'+proto[0];
export class VMError extends Error{constructor(message){super(message);this.fatal=true;}}
export class JavaError extends Error{constructor(type,message){super(message);this.$class=type;}}
export class DexVM{
  constructor(dex,host={}){
    this.dex=dex;this.host=host;this.classes=new Map();this.statics=new Map();this.depth=0;this.steps=0;this.limit=100_000_000;this.trace=[];this.jitEnabled=true;this.overrides=new Map();this.overrideSignatures=new Set();
    for(const c of dex.classes){
      c.state=0;c.lookup=new Map();
      for(const m of c.methods){const ref=dex.methods[m.id];m.signature=sig(ref[1],dex.protos[ref[2]]);c.lookup.set(m.signature,m);}
      this.classes.set(c.name,c);
      for(const [id,flags]of c.fields)if(flags&8)this.statics.set(id,this.defaultValue(dex.fields[id][2]));
      for(const [id,value]of c.values)this.statics.set(id,this.pack(dex.fields[id][2],value));
    }
    this.fieldIds=dex.fields.map((field,id)=>{
      for(let c=this.classes.get(field[0]);c;c=this.classes.get(c.parent)){
        const found=c.fields.find(([index])=>dex.fields[index][1]===field[1]&&dex.fields[index][2]===field[2]);
        if(found)return found[0];
      }
      return id;
    });
    this.methodInfo=dex.methods.map(ref=>({ref,proto:dex.protos[ref[2]],signature:sig(ref[1],dex.protos[ref[2]]),host:host.shouldHandle?.(ref)??true,targets:new Map()}));
  }
  defaultValue(t){return t==='J'||t==='D'?0n:0;}
  pack(t,v){if(t==='F')return BF(v);if(t==='D')return BD(v);if(t==='J')return BigInt(v||0);if(t==='Z')return v?1:0;return v??0;}
  unpack(t,v){if(t==='F')return F(v);if(t==='D')return D(v);if(t==='J')return BigInt(v||0);return v;}
  init(name){
    const c=this.classes.get(name);if(!c||c.state)return;
    c.state=1;if(c.parent)this.init(c.parent);
    const method=c.lookup.get('<clinit>()V');if(method)this.execute(method,[]);c.state=2;
  }
  newObject(name){
    this.init(name);const object={$class:name,$fields:new Map()};let c=this.classes.get(name);
    while(c){for(const [id,flags]of c.fields)if(!(flags&8))object.$fields.set(id,this.defaultValue(this.dex.fields[id][2]));c=this.classes.get(c.parent);}
    return object;
  }
  isInstance(value,name){
    if(value===null||value===undefined||value===0)return false;if(name==='Ljava/lang/Object;')return true;
    if(typeof value==='string')return name==='Ljava/lang/String;'||name==='Ljava/lang/CharSequence;';
    const pending=[value.$class],seen=new Set();while(pending.length){const type=pending.pop();if(type===name)return true;if(!type||seen.has(type))continue;seen.add(type);const c=this.classes.get(type);if(c)pending.push(c.parent,...(c.interfaces||[]));}
    if(value instanceof Error)return name==='Ljava/lang/Throwable;'||name==='Ljava/lang/Exception;'||name===value.$class;
    return false;
  }
  find(name,signature){for(let c=this.classes.get(name);c;c=this.classes.get(c.parent)){const m=c.lookup.get(signature);if(m)return m;}return null;}
  ref(name,method){return this.dex.methods.findIndex(m=>m[0]===name&&m[1]===method);}
  call(name,method,args=[]){
    const id=this.ref(name,method);if(id<0)throw new VMError('Method not found '+name+' '+method);
    const ref=this.dex.methods[id],proto=this.dex.protos[ref[2]],target=this.find(name,sig(method,proto));
    const raw=[];let i=0;if(target&&!(target.flags&8))raw.push(args[i++]);
    for(const t of proto[1]){raw.push(this.pack(t,args[i++]));if(t==='J'||t==='D')raw.push(0);}
    const outerCalls=this.callDepth||0;if(this.depth===0&&outerCalls===0)this.steps=0;this.callDepth=outerCalls+1;
    try{return this.unpack(proto[0],this.invoke(id,raw,target&&!(target.flags&8)?0x6e:0x71));}finally{this.callDepth=outerCalls;}
  }
  invoke(id,args,opcode){
    if(this.overrideSignatures.has(this.methodInfo[id].signature)){const info=this.methodInfo[id],dynamic=[0x6e,0x72,0x74,0x78].includes(opcode),name=dynamic&&args[0]?.$class?args[0].$class:info.ref[0],method=this.find(name,info.signature),replacement=this.overrides.get(method?.id);if(replacement){const staticCall=opcode===0x71||opcode===0x77,values=[];let i=staticCall?0:1;for(const t of info.proto[1]){values.push(this.unpack(t,args[i++]));if(t==='J'||t==='D')i++;}return this.pack(info.proto[0],replacement({vm:this,self:staticCall?null:args[0],args:values,original:()=>this.unpack(info.proto[0],this.invokeOriginal(id,args,opcode))}));}}
    return this.invokeOriginal(id,args,opcode);
  }
  installOverride(type,signature,callback){const m=this.find(type,signature);if(!m)throw new VMError('Override target not found: '+type+'.'+signature);this.overrides.set(m.id,callback);this.overrideSignatures.add(signature);return ()=>{this.overrides.delete(m.id);if(![...this.overrides.keys()].some(id=>this.methodInfo[id].signature===signature))this.overrideSignatures.delete(signature);};}
  withInstructionBudget(limit,work){
    const outerSteps=this.steps,outerLimit=this.limit;this.steps=0;this.limit=limit;
    try{return work();}finally{this.steps=outerSteps;this.limit=outerLimit;}
  }
  invokeOriginal(id,args,opcode){
    const info=this.methodInfo[id],{ref,proto,signature}=info;
    const staticCall=opcode===0x71||opcode===0x77;
    const hostResult=info.host?this.host.invoke?.(this,ref,proto,args,staticCall):null;
    if(hostResult?.handled)return this.pack(proto[0],hostResult.value);
    const dynamic=opcode===0x6e||opcode===0x72||opcode===0x74||opcode===0x78;
    if(!staticCall&&!args[0])throw new JavaError('Ljava/lang/NullPointerException;',ref[0]+'.'+ref[1]);
    const name=dynamic&&args[0]?.$class?args[0].$class:ref[0];
    if(staticCall)this.init(ref[0]);
    let m=info.targets.get(name);if(m===undefined){m=this.find(name,signature);info.targets.set(name,m);}
    if(!m?.code)throw new VMError('Missing implementation: '+name+'.'+signature);
    return this.execute(m,args);
  }
  words(m){
    if(!m.words){const binary=atob(m.code);const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));m.words=new Uint16Array(bytes.buffer);}
    return m.words;
  }
  execute(m,args){
    if(++this.depth>700){this.depth--;throw new VMError('Call depth exceeded');}
    const ref=this.dex.methods[m.id],label=m.traceLabel??(m.traceLabel=ref[0]+'.'+ref[1]);this.trace.push(label);
    try{
      if(this.jitEnabled){if(m.compiled===undefined)m.compiled=compileDex(this,m,[F,BF,D,BD,JavaError,VMError]);if(m.compiled)return m.compiled(this,args);}
      const c=this.words(m),r=new Array(m.registers).fill(0);for(let i=0;i<args.length;i++)r[m.registers-m.ins+i]=args[i];
      let pc=0,result=0,exception=0;
      while(pc<c.length){
        if(++this.steps>this.limit)throw new VMError('Instruction budget exceeded in '+label);
        const p=pc,w=c[pc],op=w&255,a=w>>>8,A=a&15,B=a>>>4,x=c[pc+1],y=c[pc+2];
        try{
          if(op>=0x44&&op<=0x51){
            const array=r[x&255],index=r[x>>>8];if(!array)throw new JavaError('Ljava/lang/NullPointerException;','array');
            if(index<0||index>=array.length)throw new JavaError('Ljava/lang/ArrayIndexOutOfBoundsException;',String(index));
            if(op<=0x4a)r[a]=array[index]??0;else array[index]=r[a];pc+=2;continue;
          }
          if(op>=0x52&&op<=0x5f){
            const obj=r[B];if(!obj)throw new JavaError('Ljava/lang/NullPointerException;',this.dex.fields[x]?.[1]);
            const key=this.fieldIds[x];
            if(op<=0x58)r[A]=this.host.getField?.(this,obj,key)??obj.$fields?.get(key)??this.defaultValue(this.dex.fields[key][2]);
            else {if(!obj.$fields)obj.$fields=new Map();obj.$fields.set(key,r[A]);}pc+=2;continue;
          }
          if(op>=0x60&&op<=0x6d){
            const key=this.fieldIds[x],field=this.dex.fields[key];this.init(field[0]);
            if(op<=0x66)r[a]=this.host.getStatic?.(this,key)??this.statics.get(key)??this.defaultValue(field[2]);else this.statics.set(key,r[a]);pc+=2;continue;
          }
          if((op>=0x6e&&op<=0x72)||(op>=0x74&&op<=0x78)){
            let values;if(op<0x74){const registers=[y&15,(y>>>4)&15,(y>>>8)&15,y>>>12,A];values=registers.slice(0,B).map(v=>r[v]);}
            else values=Array.from({length:a},(_,i)=>r[y+i]);
            result=this.invoke(x,values,op);pc+=3;continue;
          }
          if(op>=0x90&&op<=0xcf){
            const two=op>=0xb0,kind=two?op-0x20:op;
            const dest=two?A:a, left=two?r[A]:r[x&255],right=two?r[B]:r[x>>>8];
            r[dest]=this.binary(kind,left,right);pc+=two?1:2;continue;
          }
          if(op>=0xd0&&op<=0xe2){
            const eight=op>=0xd8,kind=eight?op-0xd8:op-0xd0;
            const dest=eight?a:A,left=eight?r[x&255]:r[B],right=eight?i8(x>>>8):i16(x);
            r[dest]=kind===1?(right-left)|0:this.binary(0x90+kind,left,right);pc+=2;continue;
          }
          switch(op){
            case 0x00:pc++;break;
            case 0x01:case 0x04:case 0x07:r[A]=r[B];pc++;break;
            case 0x02:case 0x05:case 0x08:r[a]=r[x];pc+=2;break;
            case 0x03:case 0x06:case 0x09:r[x]=r[y];pc+=3;break;
            case 0x0a:case 0x0b:case 0x0c:r[a]=result;pc++;break;
            case 0x0d:r[a]=exception;pc++;break;
            case 0x0e:return 0;
            case 0x0f:case 0x10:case 0x11:return r[a];
            case 0x12:r[A]=(B<<28)>>28;pc++;break;
            case 0x13:r[a]=i16(x);pc+=2;break;
            case 0x14:r[a]=i32(x,y);pc+=3;break;
            case 0x15:r[a]=(x<<16)|0;pc+=2;break;
            case 0x16:r[a]=BigInt(i16(x));pc+=2;break;
            case 0x17:r[a]=BigInt(i32(x,y));pc+=3;break;
            case 0x18:r[a]=BigInt.asIntN(64,BigInt(x)|(BigInt(y)<<16n)|(BigInt(c[pc+3])<<32n)|(BigInt(c[pc+4])<<48n));pc+=5;break;
            case 0x19:r[a]=BigInt.asIntN(64,BigInt(x)<<48n);pc+=2;break;
            case 0x1a:r[a]=this.dex.strings[x];pc+=2;break;
            case 0x1b:r[a]=this.dex.strings[i32(x,y)>>>0];pc+=3;break;
            case 0x1c:r[a]={$class:'Ljava/lang/Class;',name:this.dex.types[x]};pc+=2;break;
            case 0x1d:case 0x1e:pc++;break;
            case 0x1f:if(r[a]&&!this.isInstance(r[a],this.dex.types[x]))throw new JavaError('Ljava/lang/ClassCastException;',this.dex.types[x]);pc+=2;break;
            case 0x20:r[A]=this.isInstance(r[B],this.dex.types[x])?1:0;pc+=2;break;
            case 0x21:if(!r[B])throw new JavaError('Ljava/lang/NullPointerException;','length');r[A]=r[B].length;pc++;break;
            case 0x22:r[a]=this.newObject(this.dex.types[x]);pc+=2;break;
            case 0x23:{const t=this.dex.types[x],size=r[B];if(size<0)throw new JavaError('Ljava/lang/NegativeArraySizeException;',String(size));r[A]=new Array(size).fill(this.defaultValue(t.slice(1)));r[A].$class=t;pc+=2;break;}
            case 0x24:case 0x25:{const registers=op===0x24?[y&15,(y>>>4)&15,(y>>>8)&15,y>>>12,A].slice(0,B):Array.from({length:a},(_,i)=>y+i);result=registers.map(v=>r[v]);result.$class=this.dex.types[x];pc+=3;break;}
            case 0x26:{const q=pc+i32(x,y),width=c[q+1],size=i32(c[q+2],c[q+3]),array=r[a];const bytes=new DataView(c.buffer);for(let i=0;i<size;i++){const off=(q+4)*2+i*width;array[i]=width===1?bytes.getInt8(off):width===2?bytes.getInt16(off,true):width===4?bytes.getInt32(off,true):bytes.getBigInt64(off,true);}pc+=3;break;}
            case 0x27:throw r[a];
            case 0x28:pc+=i8(a);break;
            case 0x29:pc+=i16(x);break;
            case 0x2a:pc+=i32(x,y);break;
            case 0x2b:case 0x2c:{const q=pc+i32(x,y),size=c[q+1],value=r[a];let jump=3;if(op===0x2b){const first=i32(c[q+2],c[q+3]),i=value-first;if(i>=0&&i<size)jump=i32(c[q+4+2*i],c[q+5+2*i]);}else{for(let i=0;i<size;i++)if(i32(c[q+2+2*i],c[q+3+2*i])===value){jump=i32(c[q+2+2*size+2*i],c[q+3+2*size+2*i]);break;}}pc+=jump;break;}
            case 0x2d:case 0x2e:case 0x2f:case 0x30:case 0x31:{const left=op===0x31?r[x&255]:op<0x2f?F(r[x&255]):D(r[x&255]);const right=op===0x31?r[x>>>8]:op<0x2f?F(r[x>>>8]):D(r[x>>>8]);r[a]=Number.isNaN(left)||Number.isNaN(right)?(op===0x2d||op===0x2f?-1:1):left>right?1:left<right?-1:0;pc+=2;break;}
            case 0x32:case 0x33:case 0x34:case 0x35:case 0x36:case 0x37:pc+=this.condition(op-0x32,r[A],r[B])?i16(x):2;break;
            case 0x38:case 0x39:case 0x3a:case 0x3b:case 0x3c:case 0x3d:pc+=this.condition(op-0x38,r[a],0)?i16(x):2;break;
            case 0x7b:r[A]=(-r[B])|0;pc++;break;
            case 0x7c:r[A]=~r[B];pc++;break;
            case 0x7d:r[A]=BigInt.asIntN(64,-BigInt(r[B]));pc++;break;
            case 0x7e:r[A]=BigInt.asIntN(64,~BigInt(r[B]));pc++;break;
            case 0x7f:r[A]=BF(-F(r[B]));pc++;break;
            case 0x80:r[A]=BD(-D(r[B]));pc++;break;
            case 0x81:r[A]=BigInt(r[B]|0);pc++;break;
            case 0x82:r[A]=BF(r[B]|0);pc++;break;
            case 0x83:r[A]=BD(r[B]|0);pc++;break;
            case 0x84:r[A]=Number(BigInt.asIntN(32,BigInt(r[B])));pc++;break;
            case 0x85:r[A]=BF(Number(r[B]));pc++;break;
            case 0x86:r[A]=BD(Number(r[B]));pc++;break;
            case 0x87:r[A]=this.toInt(F(r[B]));pc++;break;
            case 0x88:r[A]=this.toLong(F(r[B]));pc++;break;
            case 0x89:r[A]=BD(F(r[B]));pc++;break;
            case 0x8a:r[A]=this.toInt(D(r[B]));pc++;break;
            case 0x8b:r[A]=this.toLong(D(r[B]));pc++;break;
            case 0x8c:r[A]=BF(D(r[B]));pc++;break;
            case 0x8d:r[A]=i8(r[B]);pc++;break;
            case 0x8e:r[A]=r[B]&65535;pc++;break;
            case 0x8f:r[A]=i16(r[B]);pc++;break;
            default:throw new VMError('Unsupported DEX opcode 0x'+op.toString(16)+' in '+label+' @'+pc);
          }
        }catch(error){
          if(error?.fatal)throw error;
          const region=m.tries?.find(t=>p>=t[0]&&p<t[0]+t[1]);const handler=region?.[2].find(h=>h[0]===null||this.isInstance(error,h[0]));
          if(!handler)throw error;exception=error;pc=handler[1];
        }
      }
      throw new VMError('Method fell through: '+label);
    }catch(error){if(!error.dexTrace)error.dexTrace=this.trace.slice(-24);throw error;}
    finally{this.trace.pop();this.depth--;}
  }
  condition(op,a,b){switch(op){case 0:return a===b;case 1:return a!==b;case 2:return a<b;case 3:return a>=b;case 4:return a>b;case 5:return a<=b;}}
  toInt(v){return Number.isNaN(v)?0:v>=2147483647?2147483647:v<=-2147483648?-2147483648:Math.trunc(v)|0;}
  toLong(v){return Number.isNaN(v)?0n:v>=9223372036854775807?9223372036854775807n:v<=-9223372036854775808?-9223372036854775808n:BigInt(Math.trunc(v));}
  binary(op,a,b){
    if(op<=0x9a){switch(op-0x90){case 0:return(a+b)|0;case 1:return(a-b)|0;case 2:return Math.imul(a,b);case 3:if(!b)throw new JavaError('Ljava/lang/ArithmeticException;','/ by zero');return Math.trunc(a/b)|0;case 4:if(!b)throw new JavaError('Ljava/lang/ArithmeticException;','/ by zero');return(a%b)|0;case 5:return a&b;case 6:return a|b;case 7:return a^b;case 8:return a<<(b&31);case 9:return a>>(b&31);case 10:return(a>>>(b&31))|0;}}
    if(op<=0xa5){a=BigInt(a);b=BigInt(b);let v;switch(op-0x9b){case 0:v=a+b;break;case 1:v=a-b;break;case 2:v=a*b;break;case 3:if(!b)throw new JavaError('Ljava/lang/ArithmeticException;','/ by zero');v=a/b;break;case 4:if(!b)throw new JavaError('Ljava/lang/ArithmeticException;','/ by zero');v=a%b;break;case 5:v=a&b;break;case 6:v=a|b;break;case 7:v=a^b;break;case 8:v=a<<(b&63n);break;case 9:v=a>>(b&63n);break;case 10:v=BigInt.asUintN(64,a)>>(b&63n);break;}return BigInt.asIntN(64,v);}
    const float=op<=0xaa,index=float?op-0xa6:op-0xab;a=float?F(a):D(a);b=float?F(b):D(b);
    const v=index===0?a+b:index===1?a-b:index===2?a*b:index===3?a/b:a%b;return float?BF(v):BD(v);
  }
}

