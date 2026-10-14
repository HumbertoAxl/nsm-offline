// CPU-only resource decoding benchmark; network and image decode are excluded.
import {readFile,writeFile} from 'node:fs/promises';import {decodeAssetBundle} from '../dist/asset-bundle.js';
const legacy=await readFile(new URL('../dist/runtime-data.json',import.meta.url),'utf8'),packed=await readFile(new URL('../dist/runtime-data.bin',import.meta.url));
const samples=[];
for(let pass=0;pass<3;pass++){
 let started=performance.now(),data=JSON.parse(legacy),files=new Map();
 for(const [path,value]of Object.entries(data))files.set(path,Uint8Array.from(atob(value),c=>c.charCodeAt(0)));
 const legacyMs=performance.now()-started;let checksum=files.size;data=null;files=null;
 started=performance.now();const binary=decodeAssetBundle(packed.buffer.slice(packed.byteOffset,packed.byteOffset+packed.byteLength));const binaryMs=performance.now()-started;
 if(binary.size!==checksum)throw Error('File count differs');
 samples.push({legacyMs,binaryMs});
}
const result={node:process.version,legacyBytes:Buffer.byteLength(legacy),binaryBytes:packed.length,samples,notes:'Local CPU decoding only; no network, GPU or phone performance measurement. Binary timing includes copying the input Buffer to an ArrayBuffer, unlike browser fetch.'};
console.log(JSON.stringify(result,null,2));
await writeFile(new URL('../../analysis/loading-benchmark.json',import.meta.url),JSON.stringify(result,null,2));
