import test from 'node:test';import assert from 'node:assert/strict';import {renderSize,installDisplay} from '../dist/display.js';
test('Pro Max landscape uses native aspect with bounded high-density rendering',()=>{
 const s=renderSize(956,440,3);assert.deepEqual(s,{width:1912,height:880});assert.ok(Math.abs(s.width/s.height-956/440)<.01);
 const large=renderSize(2868,1320,3);assert.ok(large.width*large.height<=2250000);assert.ok(Math.abs(large.width/large.height-2868/1320)<.01);
});
test('resizing updates the device boundary without repeatedly resetting the canvas',()=>{
 let rect={width:956,height:440},callback,disconnects=0,resets=0,width=1280,height=720;const canvas={getBoundingClientRect:()=>rect,get width(){return width;},set width(v){resets++;width=v;},get height(){return height;},set height(v){resets++;height=v;}};
 const sizes=[],display=installDisplay(canvas,s=>sizes.push(s),{dpr:()=>3,observe:class{constructor(fn){callback=fn;}observe(){}disconnect(){disconnects++;}}});
 assert.equal(resets,2);callback();assert.equal(resets,2);rect={width:844,height:390};callback();assert.equal(resets,4);assert.deepEqual(sizes.at(-1),{width:1688,height:780});display.dispose();assert.equal(disconnects,1);
});
import {stageBox,toCanvas} from '../dist/stage.js';
test('portrait turns the stage to landscape and maps touches onto the turned canvas',()=>{
 const box=stageBox(430,932);assert.deepEqual([box.rotated,box.width,box.height],[true,932,430]);
 // Canvas fills the stage after a 59px safe-area margin on the stage's left (screen bottom).
 const canvas={offsetLeft:59,offsetTop:0,clientWidth:873,clientHeight:430,width:1746,height:860};
 // Screen bottom-left corner is the stage's top-left content corner.
 const p=toCanvas(box,canvas,0,932-59);assert.deepEqual([p.x,p.y],[0,0]);
 const q=toCanvas(box,canvas,430,0);assert.deepEqual([q.x,q.y],[1746,860]);
 const flat=toCanvas(stageBox(932,430),{...canvas,offsetLeft:0,clientWidth:932,width:932,height:430},100,50);assert.deepEqual([flat.x,flat.y],[100,50]);
});
