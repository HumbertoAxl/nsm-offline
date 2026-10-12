import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {bindTouchAction} from '../dist/touch-controls.js';
const app=await readFile(new URL('../dist/app.js',import.meta.url),'utf8');
// Execute the shipped DOM handler itself, without booting unrelated game assets.
const handler=app.slice(app.indexOf("bindTouchAction($('start'),"),app.indexOf('async function startFirstFrame()'));
function startFixture(unlock){
 const events={},elements={start:{addEventListener:(name,action)=>events[name]=action},loader:{hidden:false}},frames=[],logs=[],errors=[];
 const scope={window:{},status:{textContent:''},bindTouchAction,$:id=>elements[id],host:{options:{audio:{unlock}}},running:false,diagnostics:{state:'ready'},tick:()=>{},startFirstFrame:()=>{frames.push(()=>{});return Promise.resolve();},requestAnimationFrame:cb=>frames.push(cb),log:s=>logs.push(s),fail:e=>errors.push(e)};
 runInNewContext(handler,scope);return {scope,elements,frames,logs,errors,events};
}
test('Shipped Play handler enters the game even when audio activation throws',()=>{
 const f=startFixture(()=>{throw Error('Mobile audio denied');});
 assert.doesNotThrow(()=>f.elements.start.onclick());
 assert.equal(f.elements.loader.hidden,false);assert.equal(f.scope.running,true);
 assert.equal(f.scope.diagnostics.state,'starting');assert.equal(f.frames.length,1);
 assert.equal(f.errors.length,0);assert.match(f.logs[0],/Mobile audio denied/);
});
test('Play schedules exactly one loop and keeps audio in the initiating gesture',()=>{
 let unlocked=0;const f=startFixture(()=>unlocked++);
 f.elements.start.onclick();f.elements.start.onclick();
 assert.equal(unlocked,1);assert.equal(f.frames.length,1);
});

test('Shipped Play handler starts on the phone pointerdown without a release or click',()=>{
 const f=startFixture(()=>{throw Error('Audio denied');});
 f.events.pointerdown({pointerType:'touch',pointerId:1,preventDefault(){}});
 assert.equal(f.elements.loader.hidden,false);assert.equal(f.scope.running,true);
 assert.equal(f.frames.length,1);assert.equal(f.errors.length,0);
});
