import test from 'node:test';import assert from 'node:assert/strict';import {DexVM} from '../dist/dex-vm.js';
function fixture(scalar,words,registers,ins){const vm=new DexVM({classes:[],fields:[],methods:[['LTest;','run',0]],protos:[['I',[]]],types:[],strings:[]});vm.scalarRegistersEnabled=scalar;return{vm,method:{id:0,registers,ins,code:Buffer.from(new Uint16Array(words).buffer).toString('base64')}};}
test('scalar registers preserve conditional loops, raw float bits and wide arguments',()=>{
 // Accumulate integers until n reaches zero; checks backward branches and lifetimes.
 const loop=[0x0012,0x0138,7,0x0090,0x0100,0x01d8,0xff01,0xfa28,0x000f];
 for(const args of [[0],[1],[17],[1000]]){const a=fixture(true,loop,2,1),b=fixture(false,loop,2,1);assert.equal(a.vm.execute(a.method,args),b.vm.execute(b.method,args));}
 const wide=[0x3004,0x0010];
 for(const value of [0n,-1n,9223372036854775807n]){const a=fixture(true,wide,5,2),b=fixture(false,wide,5,2);assert.equal(a.vm.execute(a.method,[value,0]),b.vm.execute(b.method,[value,0]));}
});
test('compiled scalar path does not allocate a register array and still enforces budget',()=>{
 const f=fixture(true,[0x7012,0x000f],1,0);assert.equal(f.vm.execute(f.method,[]),7);assert.doesNotMatch(f.method.compiled.toString(),/new Array/);
 f.vm.limit=0;assert.throws(()=>f.vm.execute(f.method,[]),/Instruction budget/);assert.equal(f.vm.depth,0);assert.deepEqual(f.vm.trace,[]);
});

