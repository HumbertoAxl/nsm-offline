import test from 'node:test';
import assert from 'node:assert/strict';
import {GLESHost} from '../dist/gles-host.js';
function host(){
 const calls=[],gl={getExtension:()=>null,getError:()=>{calls.push('getError');return 0;}};
 for(const method of ['useProgram','uniform4f','uniformMatrix4fv','viewport','enable'])gl[method]=(...args)=>calls.push([method,...args]);
 gl.createProgram=()=>({program:true});gl.deleteProgram=()=>{};gl.getUniformLocation=()=>({location:true});
 return {graphics:new GLESHost(null,{gl}),calls};
}
test('frames queued before ResumeGame may bind destroyed shaders without stopping the game',()=>{
 const {graphics,calls}=host(),program=graphics.invoke('glCreateProgram',[]),location=graphics.invoke('glGetUniformLocation',[program,'tint']);
 graphics.invoke('glDeleteProgram',[program]);
 // c_Shader.p_Destroy leaves m_program at -1; GLES reports GL_INVALID_VALUE.
 assert.doesNotThrow(()=>graphics.invoke('glUseProgram',[-1]));
 assert.equal(graphics.invoke('glGetError',[]),1281);assert.equal(graphics.invoke('glGetError',[]),0);
 // A location of the deleted program: GL_INVALID_OPERATION, call ignored.
 assert.doesNotThrow(()=>graphics.invoke('glUniform4f',[location,1,1,1,1]));
 assert.equal(graphics.invoke('glGetError',[]),1282);
 assert.ok(!calls.some(call=>call[0]==='useProgram'||call[0]==='uniform4f'));
});
test('glGetError does not synchronize with the GPU unless checks are requested',()=>{
 const {graphics,calls}=host();
 for(let i=0;i<80;i++)assert.equal(graphics.invoke('glGetError',[]),0);
 assert.equal(calls.filter(call=>call==='getError').length,0);
 graphics.checkErrors=true;graphics.invoke('glGetError',[]);assert.equal(calls.filter(call=>call==='getError').length,1);
});
