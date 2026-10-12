const keyAllowed=k=>typeof k==='string'&&(k.startsWith('nsm-state:')||k.startsWith('nsm-file:'));
export function exportProgress(storage){
 const entries={};for(let i=0;i<storage.length;i++){const k=storage.key(i);if(keyAllowed(k))entries[k]=storage.getItem(k);}
 return {format:'nsm-progress',version:1,createdAt:new Date().toISOString(),entries};
}
export async function importProgress(storage,saved){
 if(!saved||saved.format!=='nsm-progress'||saved.version!==1||!saved.entries||Array.isArray(saved.entries)||typeof saved.entries!=='object')throw Error('Invalid NSM backup');
 const entries=Object.entries(saved.entries);let size=0;
 for(const [k,v]of entries){if(!keyAllowed(k)||typeof v!=='string')throw Error('Invalid NSM save entry');size+=k.length+v.length;}
 if(entries.length>4096||size>64*1024*1024)throw Error('NSM backup is too large');
 const previous=exportProgress(storage).entries;
 try{for(const k of Object.keys(previous))storage.removeItem(k);for(const [k,v]of entries)storage.setItem(k,v);await storage.flush();}
 catch(error){try{for(const k of Object.keys(exportProgress(storage).entries))storage.removeItem(k);for(const [k,v]of Object.entries(previous))storage.setItem(k,v);await storage.flush();}catch{}throw error;}
}
