import test from 'node:test';
import assert from 'node:assert/strict';
import {installFullscreen} from '../dist/fullscreen.js';
function setup({app=false,request,exit}={}){
  const button={},status={},events={},doc={addEventListener:(name,fn)=>events[name]=fn,exitFullscreen:exit};
  let before=0;
  installFullscreen({button,status,target:{requestFullscreen:request},beforeRequest:()=>before++,doc,nav:{standalone:app},media:()=>({matches:false}),locale:'en'});
  return {button,status,doc,events,before:()=>before};
}
test('unsupported browser gets installation guidance without requesting full screen',async()=>{const s=setup();await s.button.onclick();assert.match(s.status.textContent,/Add to Home Screen/);assert.match(s.status.textContent,/Export your progress/);assert.equal(s.before(),0);});
test('request preserves gesture ordering and follows actual enter and exit events',async()=>{const order=[];const s=setup({request:()=>{order.push('request');assert.equal(s.before(),1);},exit:()=>{order.push('exit');}});await s.button.onclick();s.doc.fullscreenElement={};s.events.fullscreenchange();assert.equal(s.button.textContent,'Exit full screen');await s.button.onclick();assert.deepEqual(order,['request','exit']);});
test('rejection gives a recovery instruction and standalone avoids duplicate request',async()=>{const s=setup({request:()=>Promise.reject(Error('Denied'))});await s.button.onclick();assert.match(s.status.textContent,/did not allow/);const app=setup({app:true});assert.equal(app.button.disabled,true);assert.equal(app.button.textContent,'Opened as an app');});
