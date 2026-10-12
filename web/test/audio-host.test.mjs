import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioHost} from '../dist/audio-host.js';
test('Missing mobile AudioContext cannot prevent starting without sound',()=>{
 const logs=[],audio=new AudioHost(p=>p,s=>logs.push(s),{});
 assert.equal(audio.unlock(),false);assert.equal(audio.context,null);assert.match(logs[0],/continuing without sound/);
});
test('Audio construction and synchronous resume failures never escape the Play gesture',()=>{
 const logs=[];
 const unavailable=new AudioHost(p=>p,s=>logs.push(s),{AudioContext:class{constructor(){throw Error('Audio blocked');}}});
 assert.equal(unavailable.unlock(),false);
 const resumeFailure=new AudioHost(p=>p,s=>logs.push(s),{AudioContext:class{resume(){throw Error('Resume blocked');}}});
 assert.equal(resumeFailure.unlock(),false);assert.equal(logs.length,2);
});
test('Asynchronous audio policy rejection is handled without an unhandled promise',async()=>{
 const logs=[],audio=new AudioHost(p=>p,s=>logs.push(s),{AudioContext:class{resume(){return Promise.reject(Error('Policy denied'));}}});
 assert.equal(audio.unlock(),true);await Promise.resolve();assert.match(logs[0],/Policy denied/);
});
test('Repeated gestures reuse a context and support the iOS prefixed constructor',()=>{
 let created=0,resumed=0;const audio=new AudioHost(p=>p,()=>{},{webkitAudioContext:class{constructor(){created++;}resume(){resumed++;return Promise.resolve();}}});
 audio.unlock();audio.unlock();assert.equal(created,1);assert.equal(resumed,2);
 audio.context.state='closed';audio.unlock();assert.equal(created,2);
});
