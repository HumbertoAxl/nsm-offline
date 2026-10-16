// Translate supported DEX basic blocks to JS. Unsupported methods keep using the interpreter.
// No game rules are replaced: both paths execute the APK's instructions.
export function compileDex(vm,m,helpers){
  if(m.tries?.length)return null;
  const c=vm.words(m),instructions=[],targets=new Set([0]),scalar=vm.scalarRegistersEnabled!==false;
  let sites=0;const s16=v=>(v<<16)>>16,s8=v=>(v<<24)>>24,i32=(a,b)=>(a|(b<<16))|0,R=i=>scalar?`r${i}`:`r[${i}]`,val=v=>typeof v==='bigint'?v+'n':JSON.stringify(v);
  for(let pc=0;pc<c.length;){
    const w=c[pc],op=w&255,a=w>>>8,A=a&15,B=a>>>4,x=c[pc+1],y=c[pc+2];let n=1,code='',end=false;
    const go=p=>{targets.add(p);return `pc=${p};continue;`;};
    if(op===0&&w!==0)break;
    if(op>=0x44&&op<=0x51){const array=R(x&255),index=R(x>>>8);n=2;code=`if(!${array})throw new JavaError('Ljava/lang/NullPointerException;','array');if(${index}<0||${index}>=${array}.length)throw new JavaError('Ljava/lang/ArrayIndexOutOfBoundsException;',String(${index}));`+(op<=0x4a?`${R(a)}=${array}[${index}]??0;`:`${array}[${index}]=${R(a)};`);}
    else if(op>=0x52&&op<=0x5f){n=2;const key=vm.fieldIds[x],obj=R(B),t=vm.dex.fields[key][2];code=`if(!${obj})throw new JavaError('Ljava/lang/NullPointerException;',${JSON.stringify(vm.dex.fields[key][1])});`+(op<=0x58?(vm.host.getField&&vm.host.interceptsField?.(vm,key)===false?`${R(A)}=`:`${R(A)}=vm.host.getField?.(vm,${obj},${key})??`)+`${obj}.$fields?.get(${key})??${t==='J'||t==='D'?'0n':'0'};`:`${obj}.$fields.set(${key},${R(A)});`);}
    else if(op>=0x60&&op<=0x6d){n=2;const key=vm.fieldIds[x],field=vm.dex.fields[key];code=`if(ready[${sites}]!==true){vm.init(${JSON.stringify(field[0])});ready[${sites++}]=vm.classes.get(${JSON.stringify(field[0])})?.state!==1;}`+(op<=0x66?`${R(a)}=vm.host.getStatic?.(vm,${key})??vm.statics.get(${key})??${field[2]==='J'||field[2]==='D'?'0n':'0'};`:`vm.statics.set(${key},${R(a)});`);}
    else if((op>=0x6e&&op<=0x72)||(op>=0x74&&op<=0x78)){n=3;const regs=op<0x74?[y&15,(y>>>4)&15,(y>>>8)&15,y>>>12,A].slice(0,B):Array.from({length:a},(_,i)=>y+i);code=`result=vm.invoke(${x},[${regs.map(R)}],${op});`;
      // Startup parsing reads millions of UTF-16 units. For the Java host's
      // primitive String representation, avoid allocating an invoke argument
      // array and unpacking host arguments for each length/charAt operation.
      const info=vm.methodInfo[x],receiver=R(regs[0]);
      if([0x6e,0x74].includes(op)&&info.ref[0]==='Ljava/lang/String;'&&['length()I','charAt(I)C'].includes(info.signature)){
        const direct=info.signature==='length()I'?`${receiver}.length`:`${receiver}.charCodeAt(${R(regs[1])})`;
        code=`if(vm.host.fastStringAccess&&typeof ${receiver}==='string'&&!vm.overrideSignatures.has(${JSON.stringify(info.signature)})){result=${direct};}else{${code}}`;
      }
    }
    else if(op>=0x90&&op<=0xcf){const two=op>=0xb0,kind=two?op-0x20:op;n=two?1:2;const dest=two?A:a,left=R(two?A:x&255),right=R(two?B:x>>>8);code=`${R(dest)}=vm.binary(${kind},${left},${right});`;}
    else if(op>=0xd0&&op<=0xe2){n=2;const eight=op>=0xd8,kind=eight?op-0xd8:op-0xd0,dest=eight?a:A,left=R(eight?x&255:B),right=eight?s8(x>>>8):s16(x);code=`${R(dest)}=${kind===1?`(${right}-${left})|0`:`vm.binary(${0x90+kind},${left},${right})`};`;}
    else switch(op){
      case 0x00:code='';break;
      case 0x01:case 0x04:case 0x07:code=`${R(A)}=${R(B)};`;break;
      case 0x02:case 0x05:case 0x08:n=2;code=`${R(a)}=${R(x)};`;break;
      case 0x03:case 0x06:case 0x09:n=3;code=`${R(x)}=${R(y)};`;break;
      case 0x0a:case 0x0b:case 0x0c:code=`${R(a)}=result;`;break;
      case 0x0e:code='return 0;';end=true;break;
      case 0x0f:case 0x10:case 0x11:code=`return ${R(a)};`;end=true;break;
      case 0x12:code=`${R(A)}=${(B<<28)>>28};`;break;
      case 0x13:n=2;code=`${R(a)}=${s16(x)};`;break;
      case 0x14:n=3;code=`${R(a)}=${i32(x,y)};`;break;
      case 0x15:n=2;code=`${R(a)}=${(x<<16)|0};`;break;
      case 0x16:n=2;code=`${R(a)}=${s16(x)}n;`;break;
      case 0x17:n=3;code=`${R(a)}=${i32(x,y)}n;`;break;
      case 0x18:n=5;code=`${R(a)}=${BigInt.asIntN(64,BigInt(x)|(BigInt(y)<<16n)|(BigInt(c[pc+3])<<32n)|(BigInt(c[pc+4])<<48n))}n;`;break;
      case 0x19:n=2;code=`${R(a)}=${BigInt.asIntN(64,BigInt(x)<<48n)}n;`;break;
      case 0x1a:n=2;code=`${R(a)}=vm.dex.strings[${x}];`;break;
      case 0x1b:n=3;code=`${R(a)}=vm.dex.strings[${i32(x,y)>>>0}];`;break;
      case 0x1c:n=2;code=`${R(a)}={$class:'Ljava/lang/Class;',name:vm.dex.types[${x}]};`;break;
      case 0x1d:case 0x1e:break;
      case 0x1f:n=2;code=`if(${R(a)}&&!vm.isInstance(${R(a)},vm.dex.types[${x}]))throw new JavaError('Ljava/lang/ClassCastException;',vm.dex.types[${x}]);`;break;
      case 0x20:n=2;code=`${R(A)}=vm.isInstance(${R(B)},vm.dex.types[${x}])?1:0;`;break;
      case 0x21:code=`if(!${R(B)})throw new JavaError('Ljava/lang/NullPointerException;','length');${R(A)}=${R(B)}.length;`;break;
      case 0x22:n=2;code=`${R(a)}=vm.newObject(vm.dex.types[${x}]);`;break;
      case 0x23:n=2;code=`if(${R(B)}<0)throw new JavaError('Ljava/lang/NegativeArraySizeException;','size');${R(A)}=new Array(${R(B)}).fill(vm.defaultValue(vm.dex.types[${x}].slice(1)));${R(A)}.$class=vm.dex.types[${x}];`;break;
      case 0x24:case 0x25:{n=3;const regs=op===0x24?[y&15,(y>>>4)&15,(y>>>8)&15,y>>>12,A].slice(0,B):Array.from({length:a},(_,i)=>y+i);code=`result=[${regs.map(R)}];result.$class=vm.dex.types[${x}];`;break;}
      case 0x26:{n=3;const q=pc+i32(x,y),width=c[q+1],size=i32(c[q+2],c[q+3]),bytes=new DataView(c.buffer),data=[];for(let j=0;j<size;j++){const off=(q+4)*2+j*width;data.push(val(width===1?bytes.getInt8(off):width===2?bytes.getInt16(off,true):width===4?bytes.getInt32(off,true):bytes.getBigInt64(off,true)));}code=`{const d=[${data}];for(let i=0;i<d.length;i++)${R(a)}[i]=d[i];}`;break;}
      case 0x27:code=`throw ${R(a)};`;end=true;break;
      case 0x28:code=go(pc+s8(a));end=true;break;
      case 0x29:n=2;code=go(pc+s16(x));end=true;break;
      case 0x2a:n=3;code=go(pc+i32(x,y));end=true;break;
      case 0x2b:case 0x2c:{n=3;const q=pc+i32(x,y),size=c[q+1];code=`switch(${R(a)}){`;for(let j=0;j<size;j++){const key=op===0x2b?i32(c[q+2],c[q+3])+j:i32(c[q+2+2*j],c[q+3+2*j]),base=op===0x2b?q+4+2*j:q+2+2*size+2*j;code+=`case ${key}:${go(pc+i32(c[base],c[base+1]))}`;}code+=`default:${go(pc+3)}}`;end=true;break;}
      case 0x2d:case 0x2e:case 0x2f:case 0x30:case 0x31:{n=2;const l=op===0x31?R(x&255):`${op<0x2f?'F':'D'}(${R(x&255)})`,r=op===0x31?R(x>>>8):`${op<0x2f?'F':'D'}(${R(x>>>8)})`;code=`{const l=${l},t=${r};${R(a)}=Number.isNaN(l)||Number.isNaN(t)?${op===0x2d||op===0x2f?-1:1}:l>t?1:l<t?-1:0;}`;break;}
      case 0x32:case 0x33:case 0x34:case 0x35:case 0x36:case 0x37:n=2;code=`if(vm.condition(${op-0x32},${R(A)},${R(B)})){${go(pc+s16(x))}}${go(pc+2)}`;end=true;break;
      case 0x38:case 0x39:case 0x3a:case 0x3b:case 0x3c:case 0x3d:n=2;code=`if(vm.condition(${op-0x38},${R(a)},0)){${go(pc+s16(x))}}${go(pc+2)}`;end=true;break;
      case 0x7b:code=`${R(A)}=(-${R(B)})|0;`;break;
      case 0x7c:code=`${R(A)}=~${R(B)};`;break;
      case 0x7d:code=`${R(A)}=BigInt.asIntN(64,-BigInt(${R(B)}));`;break;
      case 0x7e:code=`${R(A)}=BigInt.asIntN(64,~BigInt(${R(B)}));`;break;
      case 0x7f:code=`${R(A)}=BF(-F(${R(B)}));`;break;
      case 0x80:code=`${R(A)}=BD(-D(${R(B)}));`;break;
      case 0x81:code=`${R(A)}=BigInt(${R(B)}|0);`;break;
      case 0x82:code=`${R(A)}=BF(${R(B)}|0);`;break;
      case 0x83:code=`${R(A)}=BD(${R(B)}|0);`;break;
      case 0x84:code=`${R(A)}=Number(BigInt.asIntN(32,BigInt(${R(B)})));`;break;
      case 0x85:code=`${R(A)}=BF(Number(${R(B)}));`;break;
      case 0x86:code=`${R(A)}=BD(Number(${R(B)}));`;break;
      case 0x87:code=`${R(A)}=vm.toInt(F(${R(B)}));`;break;
      case 0x88:code=`${R(A)}=vm.toLong(F(${R(B)}));`;break;
      case 0x89:code=`${R(A)}=BD(F(${R(B)}));`;break;
      case 0x8a:code=`${R(A)}=vm.toInt(D(${R(B)}));`;break;
      case 0x8b:code=`${R(A)}=vm.toLong(D(${R(B)}));`;break;
      case 0x8c:code=`${R(A)}=BF(D(${R(B)}));`;break;
      case 0x8d:code=`${R(A)}=(${R(B)}<<24)>>24;`;break;
      case 0x8e:code=`${R(A)}=${R(B)}&65535;`;break;
      case 0x8f:code=`${R(A)}=(${R(B)}<<16)>>16;`;break;
      default:return null;
    }
    instructions.push({pc,n,code,end});if(end)targets.add(pc+n);pc+=n;
  }
  const registers=scalar?`let ${Array.from({length:m.registers},(_,i)=>`${R(i)}=${i<m.registers-m.ins?'0':`args.length>${i-(m.registers-m.ins)}?args[${i-(m.registers-m.ins)}]:0`}`).join(',') || 'unused=0'};`:`const r=new Array(${m.registers}).fill(0);for(let i=0;i<args.length;i++)r[${m.registers-m.ins}+i]=args[i];`;
  let body=registers+`let result=0,pc=0;while(true){switch(pc){`;
  const ref=vm.dex.methods[m.id],budgetMessage=JSON.stringify('Instruction budget exceeded in '+ref[0].split('/').pop().replace(';','')+'.'+ref[1]);
  let count=0;for(let j=0;j<instructions.length;j++){const i=instructions[j];if(targets.has(i.pc)){let next=j;while(next+1<instructions.length&&!targets.has(instructions[next+1].pc))next++;count=next-j+1;body+=`case ${i.pc}:if((vm.steps+=${count})>vm.limit)throw new VMError(${budgetMessage});`; }body+=i.code;}
  body+='default:throw new VMError("Compiled method fell through");}}';
  try{return new Function('F','BF','D','BD','JavaError','VMError',`const ready=[];return function(vm,args){${body}}`)(...helpers);}catch{return null;}
}

