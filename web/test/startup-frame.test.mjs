import test from 'node:test';import assert from 'node:assert/strict';
import {runStartupFrame} from '../dist/startup-frame.js';
test('First-frame work preserves game order and yields before each phase',async()=>{
 const trace=[];
 await runStartupFrame(['update','early','late','end','drain'].map(name=>[name,()=>trace.push('work '+name)]),name=>trace.push('status '+name),async()=>trace.push('yield'));
 assert.deepEqual(trace,['status update','yield','work update','status early','yield','work early','status late','yield','work late','status end','yield','work end','status drain','yield','work drain']);
});
test('A failing original phase stops startup without running later phases',async()=>{
 const trace=[],error=Error('original render failed');
 await assert.rejects(runStartupFrame([['early',()=>{throw error;}],['late',()=>trace.push('late')]],name=>trace.push(name),async()=>{}),e=>e===error);
 assert.deepEqual(trace,['early']);
});
