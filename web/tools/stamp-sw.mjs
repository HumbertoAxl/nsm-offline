// Writes dist/cache-index.json (content hash of every offline file) and names
// the service worker version after it. A deploy that changes any cached file
// gets a new version; unchanged files are copied, not downloaded again.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist'),file=path.join(root,'sw.js');
let source=fs.readFileSync(file,'utf8');
const shell=JSON.parse(source.match(/const NSM_SHELL = (\[[^\]]*\]);/)[1].replace(/'/g,'"')).filter(entry=>entry!=='');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'asset-manifest.json'),'utf8'));
const assets=manifest.map(asset=>asset.path).filter(p=>/\.(png|jpe?g|mp3|ttf)$/i.test(p)).map(p=>'assets/'+p);
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex').slice(0,16);
const index={};
for(const entry of [...shell,...assets].sort())index[entry]=digest(fs.readFileSync(path.join(root,entry)));
const text=JSON.stringify(index);
fs.writeFileSync(path.join(root,'cache-index.json'),text);
const version=digest(text).slice(0,12);
source=source.replace(/const NSM_VERSION = '[^']*';/,`const NSM_VERSION = '${version}';`);
fs.writeFileSync(file,source);
console.log(version,Object.keys(index).length+' files');
