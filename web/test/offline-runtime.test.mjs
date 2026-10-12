import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {DexVM} from '../dist/dex-vm.js';
import {NSMHost} from '../dist/nsm-host.js';
import {installOfflineRuntime} from '../dist/offline-runtime.js';
const P='Luk/fiveaces/nsfc/';
const dex=JSON.parse(await readFile(new URL('../dist/game-dex.json',import.meta.url),'utf8'));

test('Bounded screen compilation preserves original results, errors and frame limits',()=>{
 const vm=new DexVM(dex,new NSMHost());installOfflineRuntime(vm);
 vm.limit=123456;vm.steps=123;
 for(const [owner,signature]of [['c_GScreen','p_Load()Z'],['c_Language','m_ParseFileUsingBuffer(Ljava/lang/String;)Z']]){
  const method=vm.find(P+owner+';',signature),override=vm.overrides.get(method.id);
  assert.ok(override);
  assert.equal(override({original:()=>{assert.equal(vm.limit,500000000);vm.steps=456;return false;}}),false);
  assert.equal(vm.limit,123456);assert.equal(vm.steps,123);
  const error=new Error('Original script compiler error');
  assert.throws(()=>override({original:()=>{throw error;}}),e=>e===error);
  assert.equal(vm.limit,123456);assert.equal(vm.steps,123);
 }
});

// Use real DEX field identities, with explicit serializer/validator boundaries.
import {saveProgressCheckpoint} from '../dist/offline-runtime.js';
function checkpointFixture(valid = 1) {
 const vm=new DexVM(dex,new NSMHost()),calls=[];
 const write=(owner,name,value,self)=>{
  const index=dex.fields.findIndex(f=>f[0]===P+owner+';'&&f[1]===name);
  assert.ok(index>=0);const id=vm.fieldIds[index];
  (self?self.$fields:vm.statics).set(id,vm.pack(dex.fields[id][2],value));
 };
 const player=vm.newObject(P+'c_TPlayer;');
 write('c_GameEngine','m_gamestate',2);
 write('bb_','g_player',player);
 write('c_TPlayer','m_myclub',vm.newObject(P+'c_TClub;'),player);
 write('c_GameSave','m_currentCareerData',['test']);
 vm.installOverride(P+'c_TPlayer;','p_ValidateClubAndCompData()I',()=>valid);
 vm.installOverride(P+'c_TPlayer;','p_SaveCareer()I',()=>{calls.push('career');return 0;});
 vm.installOverride(P+'c_TPlayer;','m_SaveGlobalData()I',()=>{calls.push('global');return 0;});
 return {vm,calls,write};
}
test('Incomplete trial competitions cannot be forced into a career checkpoint',()=>{
 const {vm,calls}=checkpointFixture(0);
 assert.equal(saveProgressCheckpoint(vm),true);
 assert.deepEqual(calls,['global']);
});
test('Validated career checkpoint preserves original serializer and preferences',()=>{
 const {vm,calls}=checkpointFixture(1);
 assert.equal(saveProgressCheckpoint(vm),true);
 assert.deepEqual(calls,['career','global']);
});
test('A checkpoint outside the running game state does not serialize',()=>{
 const {vm,calls,write}=checkpointFixture(1);write('c_GameEngine','m_gamestate',0);
 assert.equal(saveProgressCheckpoint(vm),false);assert.deepEqual(calls,[]);
});
