// Synchronous game-facing store, mirrored into IndexedDB for recovery.
const isSaveKey=k=>k.startsWith('nsm-state:')||k==='nsm-state'||k==='nsm-state.previous'||k.startsWith('nsm-file:');
export class SaveStore{
  static async open(log=()=>{}){
    const store=new SaveStore(log);
    try{
      const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('nsm-local-progress',1);r.onupgradeneeded=()=>r.result.createObjectStore('saves');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});store.db=db;
      const entries=await new Promise((resolve,reject)=>{const result=[],r=db.transaction('saves').objectStore('saves').openCursor();r.onsuccess=()=>{const c=r.result;if(!c){resolve(result);return;}result.push([c.key,c.value]);c.continue();};r.onerror=()=>reject(r.error);});
      for(const [key,item]of entries)if(isSaveKey(key)&&item.updatedAt>(store.times.get(key)||0)){if(item.value===null)store.values.delete(key);else store.values.set(key,item.value);store.times.set(key,item.updatedAt);}
    }catch(e){log('Recovery storage unavailable: '+e.message);}return store;
  }
  constructor(log=()=>{}){
    this.log=log;this.values=new Map();this.times=new Map();this.pending=new Set();this.failures=new Map();
    try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(isSaveKey(k))this.values.set(k,localStorage.getItem(k));else if(k.startsWith('nsm-time:')&&isSaveKey(k.slice(9)))this.times.set(k.slice(9),Number(localStorage.getItem(k)||0));}}catch(e){log('Local storage unavailable: '+e.message);}
  }
  get length(){return this.values.size;}
  key(index){return [...this.values.keys()][index]??null;}
  getItem(key){return this.values.get(key)??null;}
  setItem(key,value){value=String(value);if(key==='nsm-state'&&this.values.has(key)&&this.values.get(key)!==value)this.write('nsm-state.previous',this.values.get(key));this.write(key,value);}
  write(key,value){
    const updatedAt=Math.max(Date.now(),(this.times.get(key)||0)+1);let localSaved=false;
    try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);localStorage.setItem('nsm-time:'+key,String(updatedAt));localSaved=true;}catch(e){if(!this.db)throw Error('Unable to save progress: '+e.message);this.log('Local storage unavailable; using IndexedDB.');}
    if(value===null)this.values.delete(key);else this.values.set(key,value);this.times.set(key,updatedAt);this.failures.delete(key);
    if(this.db){
      try{const tx=this.db.transaction('saves','readwrite');tx.objectStore('saves').put({value,updatedAt},key);
        const promise=new Promise(resolve=>{tx.oncomplete=()=>{this.failures.delete(key);resolve();};const failed=()=>{const e=tx.error||Error('Progress transaction aborted');if(!localSaved)this.failures.set(key,e);this.log('Recovery copy failed: '+e.message);resolve();};tx.onerror=failed;tx.onabort=failed;});
        this.pending.add(promise);promise.finally(()=>this.pending.delete(promise));
      }catch(e){if(!localSaved){this.failures.set(key,e);throw Error('Unable to save progress: '+e.message);}this.log('Recovery copy failed: '+e.message);}
    }
  }
  removeItem(key){this.write(key,null);}
  async flush(){while(this.pending.size)await Promise.all([...this.pending]);if(this.failures.size)throw Error('Unable to save progress: '+[...this.failures.values()][0].message);}
}

