import http from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'dist');
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.ogg':'audio/ogg','.ttf':'font/ttf','.css':'text/css','.txt':'text/plain'};
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    const target=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(!target.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
    const info=await stat(target);if(!info.isFile())throw Error('not a file');
    res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache',...(target.endsWith('.bin.gz')?{'Content-Encoding':'gzip'}:{})});
    res.end(await readFile(target));
  }catch{res.writeHead(404).end('Not found');}
}).listen(Number(process.env.PORT||4174),process.env.NSM_HOST||'0.0.0.0',()=>console.log('Local: http://localhost:'+(process.env.PORT||4174)));
