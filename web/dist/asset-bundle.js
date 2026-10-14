// Indexed binary resource pack. Entries are views of one retained payload.
export function decodeAssetBundle(buffer){
 const bytes=new Uint8Array(buffer),view=new DataView(buffer);
 if(bytes.length<8||String.fromCharCode(...bytes.subarray(0,4))!=='NSM1')throw Error('Invalid resource bundle signature');
 const length=view.getUint32(4,true),start=8+length;
 if(start>bytes.length)throw Error('Truncated resource bundle index');
 const index=JSON.parse(new TextDecoder().decode(bytes.subarray(8,start)));
 if(!Array.isArray(index))throw Error('Invalid resource bundle index');
 const files=new Map();
 for(const entry of index){
  if(!Array.isArray(entry)||entry.length!==3)throw Error('Invalid resource bundle entry');
  const [path,offset,size]=entry;
  if(typeof path!=='string'||files.has(path)||path.split('/').some(p=>!p||p==='.'||p==='..')||path.includes('\\')||!Number.isSafeInteger(offset)||!Number.isSafeInteger(size)||offset<0||size<0||offset>bytes.length-start-size)throw Error('Invalid resource bundle bounds or path');
  files.set(path,new Uint8Array(buffer,start+offset,size));
 }
 return files;
}
