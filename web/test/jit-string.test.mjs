import test from 'node:test';import assert from 'node:assert/strict';
import {DexVM} from '../dist/dex-vm.js';import {NSMHost} from '../dist/nsm-host.js';
function fixture(jit,operation='charAt'){
 const dex={classes:[],fields:[],methods:[['LTest;','read',0],['Ljava/lang/String;','charAt',1],['Ljava/lang/String;','length',2]],protos:[['I',[]],['C',['I']],['I',[]]],types:[],strings:[]};
 const host=new NSMHost(),vm=new DexVM(dex,host);vm.jitEnabled=jit;
 const words=new Uint16Array(operation==='charAt'?[0x206e,1,0x0021,0x000a,0x000f]:[0x106e,2,0x0001,0x000a,0x000f]);
 const method={id:0,registers:operation==='charAt'?3:2,ins:operation==='charAt'?2:1,code:Buffer.from(words.buffer).toString('base64')};
 return {vm,host,method,read:(...args)=>vm.execute(method,args)};
}
test('Compiled String reads preserve interpreter UTF-16, empty and out-of-range results',()=>{
 for(const [text,index]of [['abc',0],['',0],['😀',0],['😀',1],['abc',-1],['abc',9]]){
  assert.equal(fixture(true).read(text,index),fixture(false).read(text,index));
  assert.equal(fixture(true,'length').read(text),fixture(false,'length').read(text));
 }
});
test('Fast String reads avoid native dispatch, while unsupported receivers/hosts fall back',()=>{
 const f=fixture(true);let calls=0;const original=f.host.invoke.bind(f.host);
 f.host.invoke=(...args)=>{calls++;return original(...args);};
 assert.equal(f.read('abc',1),98);assert.equal(calls,0);
 f.host.fastStringAccess=false;assert.equal(f.read('abc',1),98);assert.equal(calls,1);
 f.host.fastStringAccess=true;assert.throws(()=>f.read(0,0),TypeError);assert.equal(calls,2);
});
test('An installed String signature override cannot be bypassed by the fast path',()=>{
 const f=fixture(true);f.vm.overrideSignatures.add('charAt(I)C');let calls=0;
 f.vm.invoke=()=>{calls++;return 65;};assert.equal(f.read('abc',1),65);assert.equal(calls,1);
});
