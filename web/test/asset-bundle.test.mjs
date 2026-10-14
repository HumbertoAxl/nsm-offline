import {gunzipSync} from 'node:zlib';
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {decodeAssetBundle} from '../dist/asset-bundle.js';
const bytes=await readFile(new URL('../dist/runtime-data.bin',import.meta.url));
const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
test('binary pack preserves every legacy asset byte and uses shared views',async()=>{
 const files=decodeAssetBundle(buffer),legacy=JSON.parse(await readFile(new URL('../dist/runtime-data.json',import.meta.url),'utf8'));
 assert.equal(files.size,Object.keys(legacy).length);
 for(const [path,base64]of Object.entries(legacy)){const actual=files.get(path);assert.equal(actual.buffer,buffer);assert.deepEqual(Buffer.from(actual),Buffer.from(base64,'base64'),path);}
});
test('invalid signatures, truncated indexes and out-of-bounds entries are rejected',()=>{
 assert.throws(()=>decodeAssetBundle(new ArrayBuffer(1)));
 const pack=index=>{const json=Buffer.from(JSON.stringify(index)),out=Buffer.alloc(8+json.length);out.write('NSM1');out.writeUInt32LE(json.length,4);json.copy(out,8);return out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength);};
 for(const index of [[['a',0,1]],[['../a',0,0]],[['a',-1,0]],[['a',0,0],['a',0,0]],{}])assert.throws(()=>decodeAssetBundle(pack(index)));
});

test('HTTP gzip pack inflates to the identical indexed binary payload',async()=>{assert.deepEqual(gunzipSync(await readFile(new URL('../dist/runtime-data.bin.gz',import.meta.url))),bytes);});
