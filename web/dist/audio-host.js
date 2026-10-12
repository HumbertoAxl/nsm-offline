export class AudioHost{
  constructor(path,log=()=>{},environment=globalThis){this.environment=environment;this.path=path;this.log=log;this.channels=new Map();this.buffers=new Map();this.context=null;this.musicVolume=1;}
  unlock(){
    // Sound is optional: iOS policies or an unavailable/failed AudioContext must
    // never abort the user gesture that starts the game. Keep one reusable context.
    try{
      if(!this.context||this.context.state==='closed'){
        const Context=this.environment.AudioContext||this.environment.webkitAudioContext;
        if(!Context){this.log('Audio unavailable; continuing without sound.');return false;}
        this.context=new Context();
      }
      Promise.resolve(this.context.resume()).catch(e=>this.log('Audio activation: '+e.message));
      return true;
    }catch(e){this.log('Audio activation: '+e.message);return false;}
  }
  load(path){if(!this.context)return Promise.resolve(null);const key=this.path(path);if(!this.buffers.has(key))this.buffers.set(key,fetch('assets/'+key).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.arrayBuffer();}).then(b=>this.context.decodeAudioData(b)).catch(e=>{this.log('Audio '+key+': '+e.message);return null;}));return this.buffers.get(key);}
  channel(id){if(!this.channels.has(id))this.channels.set(id,{volume:1,rate:1,pan:0,state:0,offset:0});return this.channels.get(id);}
  position(c){const elapsed=c.node?(this.context.currentTime-c.startedAt)*c.rate:0,offset=c.offset+elapsed;return c.buffer?(c.flags&1?offset%c.buffer.duration:Math.min(offset,c.buffer.duration)):offset;}
  disconnect(c){const node=c.node;c.node=null;if(node){node.onended=null;node.stop();node.disconnect();}c.gain?.disconnect();c.panner?.disconnect();c.gain=c.panner=null;}
  stop(id){const c=this.channel(id);c.token=(c.token||0)+1;this.disconnect(c);c.state=0;c.offset=0;}
  play(path,id,flags,offset=0){
    this.stop(id);const c=this.channel(id),token=c.token;c.path=path;c.flags=flags;c.offset=offset;c.state=1;
    this.load(path).then(buffer=>{
      if(c.token!==token||c.state!==1)return;if(!buffer){c.state=0;return;}
      const node=this.context.createBufferSource(),gain=this.context.createGain(),pan=this.context.createStereoPanner?.();c.buffer=buffer;node.buffer=buffer;node.loop=!!(flags&1);node.playbackRate.value=c.rate;gain.gain.value=c.volume*(id===32?this.musicVolume:1);node.connect(gain);
      if(pan){pan.pan.value=c.pan;gain.connect(pan);pan.connect(this.context.destination);}else gain.connect(this.context.destination);
      c.node=node;c.gain=gain;c.panner=pan;c.startedAt=this.context.currentTime;c.offset=flags&1?offset%buffer.duration:Math.min(offset,buffer.duration);
      node.onended=()=>{if(c.node===node){c.state=0;c.node=null;c.offset=0;node.disconnect();gain.disconnect();pan?.disconnect();}};node.start(0,c.offset);
    }).catch(e=>{if(c.token===token)c.state=0;this.log('Unable to start audio: '+e.message);});return 0;
  }
  invoke(name,a){
    if(name==='PlaySample')return this.play(a[0].path,a[1],a[2]);
    if(name==='PlayMusic')return this.play(a[0],32,a[1]);
    if(name==='StopChannel'){this.stop(a[0]);return 0;}
    if(name==='StopMusic'){this.stop(32);return 0;}
    if(name==='ChannelState')return this.channel(a[0]).state;
    if(name==='MusicState')return this.channel(32).state;
    if(name==='SetVolume'){const c=this.channel(a[0]);c.volume=a[1];if(c.gain)c.gain.gain.value=a[1]*(a[0]===32?this.musicVolume:1);return 0;}
    if(name==='SetMusicVolume'){this.musicVolume=a[0];const c=this.channel(32);if(c.gain)c.gain.gain.value=c.volume*a[0];return 0;}
    if(name==='SetRate'||name==='SetPan'){const c=this.channel(a[0]);if(name==='SetRate'){c.offset=this.position(c);c.startedAt=this.context?.currentTime||0;c.rate=a[1];if(c.node)c.node.playbackRate.value=a[1];}else{c.pan=a[1];if(c.panner)c.panner.pan.value=a[1];}return 0;}
    if(name==='PauseChannel'||name==='PauseMusic'){const c=this.channel(name==='PauseMusic'?32:a[0]);if(c.state===1){c.offset=this.position(c);c.token=(c.token||0)+1;this.disconnect(c);c.state=2;}return 0;}
    if(name==='ResumeChannel'||name==='ResumeMusic'){const id=name==='ResumeMusic'?32:a[0],c=this.channel(id);if(c.state===2)this.play(c.path,id,c.flags,c.offset);return 0;}
    if(name==='Resume'){this.context?.resume().catch(this.log);return 0;}
    if(name==='Suspend'){this.context?.suspend().catch(this.log);return 0;}
    if(name==='OnDestroy'){for(const id of this.channels.keys())this.stop(id);return 0;}
    return 0;
  }
}

