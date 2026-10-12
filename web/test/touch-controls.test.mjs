import test from 'node:test';
import assert from 'node:assert/strict';
import {bindTouchAction} from '../dist/touch-controls.js';
function fixture(){
 let time=0,count=0;const events={},button={disabled:false,addEventListener:(name,action)=>events[name]=action};
 bindTouchAction(button,()=>count++,()=>time);
 return {button,events,count:()=>count,advance:ms=>time+=ms};
}
test('Touch release works without a browser click and synthetic click is deduplicated',()=>{
 const f=fixture();let prevented=false;
 f.events.pointerup({pointerType:'touch',preventDefault:()=>prevented=true});
 assert.equal(f.count(),1);assert.equal(prevented,true);
 f.button.onclick({});assert.equal(f.count(),1);
 f.advance(800);f.button.onclick({});assert.equal(f.count(),2);
});
test('Mouse and accessible click remain available; disabled or secondary touch does not activate',()=>{
 const f=fixture();f.events.pointerup({pointerType:'mouse'});assert.equal(f.count(),0);
 f.button.onclick({});assert.equal(f.count(),1);
 f.button.disabled=true;f.events.pointerup({pointerType:'touch'});assert.equal(f.count(),1);
 f.button.disabled=false;f.events.pointerup({pointerType:'touch',isPrimary:false});assert.equal(f.count(),1);
});

test('Reported iPhone pointerdown-only sequence activates immediately',()=>{
 const f=fixture();let prevented=false;
 f.events.pointerdown({pointerType:'touch',pointerId:17,preventDefault:()=>prevented=true});
 assert.equal(f.count(),1);assert.equal(prevented,true);
 // Even with no release, a later primary gesture must work independently.
 f.advance(1000);
 f.events.pointerdown({pointerType:'touch',pointerId:18,preventDefault(){}});
 assert.equal(f.count(),2);
});
test('A long touch, its release and synthetic click execute just one action',()=>{
 const f=fixture(),event={pointerType:'touch',pointerId:17,preventDefault(){}};
 f.events.pointerdown(event);f.advance(1000);f.events.pointerup(event);f.button.onclick({});
 assert.equal(f.count(),1);
});
test('Cancellation does not retain pointer ownership or double-fire the action',()=>{
 const f=fixture(),event={pointerType:'touch',pointerId:17,preventDefault(){}};
 f.events.pointerdown(event);f.events.pointercancel();assert.equal(f.count(),1);
 f.advance(1000);f.events.pointerdown(event);f.events.pointerup(event);assert.equal(f.count(),2);
});
