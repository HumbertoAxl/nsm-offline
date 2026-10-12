import test from 'node:test';
import assert from 'node:assert/strict';
import {exportProgress,importProgress} from '../dist/progress-backup.js';
const store=entries=>{const m=new Map(entries);return{m,get length(){return m.size},key:i=>[...m.keys()][i],getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),flush:async()=>{}}};
test('All career segments and timestamps survive export and replacement',async()=>{
 const original=store([['nsm-state:global.monkeystate','options'],['nss-state','soccer']]);for(let i=0;i<16;i++){original.setItem('nsm-state:career0_'+i+'.monkeystate','part'+i);original.setItem('nsm-state:career0_'+i+'_TS.monkeystate','stamp'+i);}
 const saved=exportProgress(original);assert.equal(Object.keys(saved.entries).length,33);const destination=store([['nsm-state:career2_0.monkeystate','old'],['nss-state','keep']]);await importProgress(destination,saved);assert.equal(destination.getItem('nsm-state:career0_15_TS.monkeystate'),'stamp15');assert.equal(destination.getItem('nsm-state:career2_0.monkeystate'),undefined);assert.equal(destination.getItem('nss-state'),'keep');
});
test('Foreign or malformed backup cannot mutate progress',async()=>{const storage=store([['nsm-state:global.monkeystate','keep']]);await assert.rejects(importProgress(storage,{format:'nsm-progress',version:1,entries:{'nss-state':'wrong'}}),/Invalid/);assert.equal(storage.getItem('nsm-state:global.monkeystate'),'keep');});
test('Failed restore restores previous local progress',async()=>{const storage=store([['nsm-state:global.monkeystate','previous']]);let failed=false;storage.flush=async()=>{if(!failed){failed=true;throw Error('disk unavailable');}};await assert.rejects(importProgress(storage,{format:'nsm-progress',version:1,entries:{'nsm-state:global.monkeystate':'replacement'}}));assert.equal(storage.getItem('nsm-state:global.monkeystate'),'previous');});
