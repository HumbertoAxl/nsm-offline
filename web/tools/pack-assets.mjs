import {gzipSync} from 'node:zlib';
// Repack the legacy generated bundle without changing original asset bytes.
import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../dist/',import.meta.url),legacy=JSON.parse(await readFile(new URL('runtime-data.json',root),'utf8'));
const entries=[],payload=[];let offset=0;
for(const [path,base64]of Object.entries(legacy)){const bytes=Buffer.from(base64,'base64');entries.push([path,offset,bytes.length]);payload.push(bytes);offset+=bytes.length;}
const index=Buffer.from(JSON.stringify(entries)),header=Buffer.alloc(8);header.write('NSM1');header.writeUInt32LE(index.length,4);
const packed=Buffer.concat([header,index,...payload]);await writeFile(new URL('runtime-data.bin',root),packed);
const compressed=gzipSync(packed,{level:9});await writeFile(new URL('runtime-data.bin.gz',root),compressed);
console.log(JSON.stringify({gzipBytes:compressed.length,files:entries.length,legacyBytes:Buffer.byteLength(JSON.stringify(legacy)),binaryBytes:packed.length,payloadBytes:offset}));
