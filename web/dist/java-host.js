import {JavaError,VMError,F,BF} from './dex-vm.js';
import {fontCall} from './font-host.js';
const PREFIX='Luk/fiveaces/nsfc/';
export class JavaHost{
  shouldHandle([type,name]){
    if(!type.startsWith(PREFIX))return true;
    const short=type.slice(PREFIX.length,-1);
    if(short==='BBAndroidGame$GameView')return true;
    if(short==='Firebase')return name==='SetConsent';
    if(short==='gxtkGraphics')return ['LoadSurface','LoadSurface__UNSAFE__','CreateSurface','RamInMB','GetLanguageCode','GetOSVersion'].includes(name);
    if(short==='bb_std_lang')return ['fromChars','toChars','print','debugLog','as','resize'].includes(name);
    if(short.startsWith('c_'))return (short==='c_DataBuffer'&&['p_PeekInts','p_PeekBytes','_Load','_New','Length','Discard','PeekByte','PeekShort','PeekInt','PeekFloat','PokeByte','PokeShort','PokeInt','PokeFloat'].includes(name))||(short==='c_FileStream'&&['Open','Close','Eof','Length','Offset','Seek','Read','Write'].includes(name));
    return ['BBFlurry','Skn3CheckOnline','AdMob','Fyber','GooglePlayBB','FontNative','BBFileSystem','BBFileStream','BBDataBuffer','BBGameService','diddy','CoreUtils','gxtkSurface','gxtkAudio','BBGame','BBAndroidGame'].includes(short);
  }
  constructor(options={}){this.options=options;this.start=Date.now();this.game={$class:PREFIX+'BBAndroidGame;',$fields:new Map()};this.files=new Map();this.dirs=new Set();this.calls=new Map();this.delegate=null;this.rate=60;}
  invoke(vm,ref,proto,raw,staticCall){
    const [type,name]=ref,self=staticCall?null:raw[0],args=[];let i=staticCall?0:1;
    for(const t of proto[1]){args.push(vm.unpack(t,raw[i++]));if(t==='J'||t==='D')i++;}
    const ret=value=>({handled:true,value});
    const short=type.startsWith(PREFIX)?type.slice(PREFIX.length,-1):type;
    if(short==='Firebase'&&name==='SetConsent')return ret(0);
    if(type==='Lcom/google/firebase/messaging/FirebaseMessaging;'){
      if(name==='getInstance')return ret({$class:type});
      if(name==='setAutoInitEnabled')return ret(0);
    }
    if(short==='BBFlurry'&&name!=='GetFlurry'&&name!=='<init>')return ret(0);
    if(short==='Skn3CheckOnline')return ret(false);
    if(short==='GooglePlayBB'){
      if(['IsAvailable','IsPurchased','IsConnected','IsReady'].includes(name))return ret(false);
      if(name==='GetStore')return ret('GooglePlay');
      if(proto[0]==='Ljava/lang/String;')return ret('');
      if(proto[0].startsWith('['))return ret([]);
      return ret(0);
    }
    if(short==='AdMob'){
      if(name==='GetInstance')return ret(this.admob||(this.admob={$class:type,$fields:new Map()}));
      if(name==='IsAdAvailable'||name==='IsRewardedAdAvailable')return ret(false);
      if(['StartSession','EndSession','PauseSession','ResumeSession','RequestConsent','PreLoadAd','PreLoadRewardedAd','DisplayAd','DisplayRewardedAd'].includes(name))return ret(0);
    }
    if(short==='Fyber'){
      if(name==='GetInstance')return ret(this.fyber||(this.fyber={$class:type,$fields:new Map()}));
      if(name==='IsAdAvailable'||name==='IsRewardedAdAvailable')return ret(false);
      if(['StartSession','EndSession','PauseSession','ResumeSession','PreLoadAd','PreLoadRewardedAd','DisplayAd','DisplayRewardedAd','SetConsent'].includes(name))return ret(0);
    }
    if(type==='Landroid/util/Log;'){this.options.log?.(args.at(-1));return ret(0);}
    if(type==='Landroid/graphics/Bitmap;'){
      if(name==='getWidth')return ret(self.surface.width);
      if(name==='getHeight')return ret(self.surface.height);
      if(name==='getPixels'||name==='setPixels'){
        const [array,offset,stride,x,y,w,h]=args,s=self.surface;
        const pixels=this.options.graphics?.surfacePixels(s)||s.pixels||(s.pixels=new Uint8Array(s.width*s.height*4));
        for(let row=0;row<h;row++)for(let col=0;col<w;col++){const j=((y+row)*s.width+x+col)*4,k=offset+row*stride+col;if(name==='getPixels')array[k]=(pixels[j+3]<<24)|(pixels[j]<<16)|(pixels[j+1]<<8)|pixels[j+2];else {const v=array[k];pixels[j]=v>>>16&255;pixels[j+1]=v>>>8&255;pixels[j+2]=v&255;pixels[j+3]=v>>>24;}}
        if(name==='setPixels')this.options.graphics?.updateSurface(s);return ret(0);
      }
    }
    if(short==='FontNative'){const value=fontCall(this,self,name,args);if(value!==undefined)return ret(value);}
    if(short==='BBFileSystem'){
      const key=this.path(args[0]||'');
      const paths=[...this.files.keys(),...(this.options.assets||[]).map(a=>a.path)];
      if(name==='FixPath'||name==='RealPath')return ret(args[0]);
      if(name==='FileType')return ret(paths.includes(key)?1:paths.some(p=>p.startsWith(key.replace(/\/$/,'')+'/'))||this.dirs.has(key)?2:0);
      if(name==='FileSize')return ret(this.files.get(key)?.length||this.options.assets?.find(a=>a.path===key)?.size||0);
      if(name==='FileTime')return ret(0);
      if(name==='LoadDir'){const prefix=key.replace(/\/$/,'')+'/';return ret([...new Set(paths.filter(p=>p.startsWith(prefix)).map(p=>p.slice(prefix.length).split('/')[0]))]);}
      if(name==='CreateDir'){this.dirs.add(key);return ret(true);}
      if(name==='CreateFile'){this.files.set(key,new Uint8Array());return ret(true);}
      if(name==='DeleteFile'){this.options.storage?.removeItem('nsm-file:'+key);return ret(this.files.delete(key));}
      if(name==='DeleteDir')return ret(this.dirs.delete(key));
      if(name==='CopyFile'){const bytes=this.files.get(key);if(!bytes)return ret(false);const dest=this.path(args[1]);this.files.set(dest,bytes.slice());this.persist(dest);return ret(true);}
    }
    if(short==='BBFileStream'||vm.isInstance(self,PREFIX+'BBFileStream;')){
      if(name==='Open'){self.path=this.path(args[0]);self.position=0;self.open=true;if(args[1]==='r'&&!this.files.has(self.path)){self.open=false;return ret(false);}if(args[1]==='w'||!this.files.has(self.path))this.files.set(self.path,new Uint8Array());return ret(true);}
      if(name==='Close'){if(self.path)this.persist(self.path);self.open=false;return ret(0);}
      if(name==='Eof')return ret(!self.open?-1:self.position>=this.files.get(self.path).length?1:0);
      if(name==='Length')return ret(this.files.get(self.path)?.length||0);
      if(name==='Offset')return ret(self.position||0);
      if(name==='Seek'){self.position=args[0];return ret(self.position);}
      if(name==='Read'){if(!self.open)return ret(0);const bytes=this.files.get(self.path),count=Math.min(args[2],bytes.length-self.position);args[0].bytes.set(bytes.subarray(self.position,self.position+count),args[1]);self.position+=count;return ret(count);}
      if(name==='Write'){if(!self.open)return ret(0);let bytes=this.files.get(self.path);const size=self.position+args[2];if(size>bytes.length){const bigger=new Uint8Array(size);bigger.set(bytes);this.files.set(self.path,bytes=bigger);}bytes.set(args[0].bytes.subarray(args[1],args[1]+args[2]),self.position);self.position=size;return ret(args[2]);}
    }
    if(short==='BBGameService'){
      if(['<init>','unlockAchievement','revealAchievement','incrementAchievement','submitHighscore','setMaxUserSignIns','signOut'].includes(name))return ret(0);
      if(name==='isLoggedIn'||name==='isNetworkAvailable')return ret(false);
      if(name==='getLoginState'||name==='getDataState')return ret(0);
      if(name==='getData')return ret('');
    }
    if(short==='diddy'){
      if(name==='systemMillisecs')return ret(Date.now()|0);
      if(name==='getUserName')return ret('');
      if(name==='getOS')return ret('Android');
      if(name==='startVibrate'||name==='stopVibrate')return ret(0);
      if(name==='loadStringFromExternalFile')return ret(this.loadString(args[0]));
    }
    if(short==='CoreUtils'){
      if(name==='GetDeviceType')return ret('Browser');
      if(name==='GetLanguageCode')return ret(this.options.language||'pt-BR');
      // In this APK, ShowDialog is used only by FeelGood's store/social prompts.
      // Button 1 is "Never" for all four prompts. Let the original update/save
      // process that answer instead of opening an Android Activity in the browser.
      if(name==='ShowDialog'){
        this.dialogButton=1;
        const id=vm.dex.fields.findIndex(f=>f[0]===PREFIX+'CoreUtils;'&&f[1]==='dialogButton');
        if(id>=0)vm.statics.set(vm.fieldIds[id],1);
        return ret(0);
      }
      if(name==='GetDialogButton')return ret(this.dialogButton??0);
    }
    if(short==='BBDataBuffer'||vm.isInstance(self,PREFIX+'BBDataBuffer;')){
      if(name==='<init>')return ret(0);
      if(name==='_Load'){const bytes=this.files.get(this.path(args[0]));if(!bytes)return ret(false);self.bytes=bytes.slice();self.view=new DataView(self.bytes.buffer);return ret(true);}
      if(name==='_New'){self.bytes=new Uint8Array(args[0]);self.view=new DataView(self.bytes.buffer);return ret(true);}
      if(name==='Length')return ret(self.bytes?.length||0);
      if(name==='Discard'){self.bytes=null;self.view=null;return ret(0);}
      if(name==='p_PeekInts'||name==='p_PeekBytes'){
        const [offset,array,start,requested]=args,width=name==='p_PeekInts'?4:1;
        const count=Math.min(requested,Math.trunc((self.bytes.length-offset)/width),array.length-start);
        for(let j=0;j<count;j++)array[start+j]=width===4?self.view.getInt32(offset+4*j,true):self.view.getInt8(offset+j);
        return ret(0);
      }
      if(name.startsWith('Peek')||name.startsWith('Poke')){
        const formats={Byte:'Int8',Short:'Int16',Int:'Int32',Float:'Float32'};const format=formats[name.slice(4)];
        if(format){if(name.startsWith('Peek'))return ret(self.view['get'+format](args[0],true));self.view['set'+format](args[0],args[1],true);return ret(0);}
      }
    }
    if(short==='gxtkGraphics'){
      if(name==='LoadSurface')return ret(this.options.surface?.(args[0])||0);
      if(name==='LoadSurface__UNSAFE__'){const surface=this.options.surface?.(args[1]);if(!surface)return ret(false);Object.assign(args[0],surface);return ret(true);}
      if(name==='CreateSurface')return ret(this.makeSurface(args[0],args[1]));
      if(name==='RamInMB')return ret(2048);
      if(name==='GetLanguageCode')return ret(this.options.language||'pt-BR');
      if(name==='GetOSVersion')return ret('browser');
    }
    if(short==='gxtkSurface'){
      if(name==='<init>')return ret(0);
      if(name==='Width')return ret(self.width||0);
      if(name==='Height')return ret(self.height||0);
      if(name==='Loaded')return ret(1);
      if(name==='Bind'){this.boundSurface=self;this.options.graphics?.bindSurface(self);return ret(0);}
      if(['Discard','Invalidate','DiscardData','FlushDiscarded'].includes(name))return ret(0);
    }
    if(short==='gxtkAudio'){
      if(name==='<init>')return ret(0);
      if(name==='LoadSample'){const sample={$class:PREFIX+'gxtkSample;',path:args[0],$fields:new Map()};this.options.audio?.load(sample.path);return ret(sample);}
      if(name==='LoadSample__UNSAFE__'){args[0].path=args[1];return ret(args[0]);}
      if(this.options.audio&&name!=='<init>')return ret(this.options.audio.invoke(name,args));
      if(['Suspend','Resume','SetVolume','SetPan','SetRate','SetMusicVolume','PlaySample','StopChannel','PauseChannel','ResumeChannel','PlayMusic','StopMusic','PauseMusic','ResumeMusic'].includes(name))return ret(0);
      if(name==='ChannelState'||name==='MusicState')return ret(0);
    }
    if(type==='Ljava/lang/Thread;'){
      if(name==='<init>'){self.target=args[0];return ret(0);}
      if(name==='start'){if(self.target)vm.invoke(vm.ref(PREFIX+'BBThread;','run'),[self.target],0x6e);return ret(0);}
      if(name==='join'||name==='sleep')return ret(0);
    }
    if(short==='BBGame'||short==='BBAndroidGame'){
      if(name==='Game'||name==='AndroidGame')return ret(this.game);
      if(name==='GetGameView')return ret({$class:'Landroid/view/View;'});
      if(name==='SetDelegate'){this.delegate=args[0];return ret(0);}
      if(name==='Delegate')return ret(this.delegate||0);
      if(name==='GetDeviceWidth')return ret(this.options.width||640);
      if(name==='GetDeviceHeight')return ret(this.options.height||960);
      if(name==='Millisecs')return ret(Date.now()-this.start);
      if(name==='GetNativeHours')return ret(Math.floor(Date.now()/3600000));
      if(name==='GetDate'){const d=new Date();const vals=[d.getFullYear(),d.getMonth()+1,d.getDate(),d.getHours(),d.getMinutes(),d.getSeconds(),d.getMilliseconds()];vals.forEach((v,j)=>args[0][j]=v);return ret(0);}
      if(name==='SetUpdateRate'){this.rate=args[0];return ret(0);}
      if(name==='UpdateRate')return ret(this.rate);
      if(name==='GetDisplayModes')return ret([]);
      if(name==='GetDesktopMode')return ret(0);
      if(name==='LoadState')return ret(this.options.storage?.getItem('nsm-state')||'');
      if(name==='SaveState'){this.options.storage?.setItem('nsm-state',args[0]);return ret(1);}
      if(name==='LoadString')return ret(this.loadString(args[0]));
      if(name==='LoadData')return ret(this.files.has(this.path(args[0]))?Array.from(this.files.get(this.path(args[0])),b=>b>127?b-256:b):0);
      if(name==='PathToFilePath')return ret(args[0]);
      if(name==='SetAutoCapitalText'){this.keyboardText=args[0];this.options.keyboard?.setText(args[0]);return ret(0);}
      if(name==='SetKeyboardEnabled'){this.keyboardEnabled=!!args[0];this.keyboardAlt=!!args[1];this.options.keyboard?.enable(this.keyboardEnabled,this.keyboardAlt);return ret(0);}
      if(['SetMouseVisible','SetSwapInterval','SetDeviceWindow','OpenUrl'].includes(name))return ret(0);
      if(name==='KeyboardEnabled')return ret(this.keyboardEnabled);
      if(name==='PollJoystick')return ret(false);
      if(name==='GetAutoCapitalText')return ret(this.options.keyboard?.value()??this.keyboardText??'');
    }
    if(short==='bb_std_lang'){
      if(name==='fromChars'){let s='';for(let j=0;j<args[0].length;j+=8192)s+=String.fromCharCode(...args[0].slice(j,j+8192));return ret(s);}
      if(name==='toChars'){const text=String(args[0]);return ret(Array.from({length:text.length},(_,i)=>text.charCodeAt(i)));}
      if(name==='print'||name==='debugLog'){this.options.log?.(args[0]);return ret(0);}
      if(name==='as')return ret(vm.isInstance(args[1],args[0].name)?args[1]:0);
      if(name==='resize') {const arr=args[0].slice(0,args[1]);while(arr.length<args[1])arr.push(args[0].$class==='[Ljava/lang/String;'?'':0);arr.$class=args[0].$class;return ret(arr);}
    }
    if(type==='Ljava/lang/Object;'){
      if(name==='<init>')return ret(0);
      if(name==='getClass')return ret({$class:'Ljava/lang/Class;',name:self.$class||'Ljava/lang/String;'});
      if(name==='equals')return ret(self===args[0]);
      if(name==='toString')return ret(String(self));
    }
    if(type==='Ljava/io/PrintStream;'&&name==='println'){this.options.log?.(String(args[0]));return ret(0);}
    if((type.endsWith('Exception;')||type==='Ljava/lang/Error;')&&name==='<init>'){self.message=String(args[0]??'');return ret(0);}
    if(type==='Ljava/lang/Class;'){
      if(name==='isInstance')return ret(vm.isInstance(args[0],self.name));
      if(name==='cast')return ret(args[0]);
      if(name==='getName')return ret(self.name.slice(1,-1).replaceAll('/','.'));
      if(name==='getComponentType')return ret({$class:'Ljava/lang/Class;',name:self.name.slice(1)});
    }
    if(type==='Ljava/lang/reflect/Array;'&&name==='newInstance'){const array=new Array(args[1]).fill(0);array.$class='['+args[0].name;return ret(array);}
    if(type==='Ljava/lang/reflect/Array;'&&name==='getLength')return ret(args[0].length);
    if(type==='Ljava/lang/Math;'||type==='Ljava/lang/StrictMath;'){
      const fn=name==='toRadians'?v=>v*Math.PI/180:name==='toDegrees'?v=>v*180/Math.PI:name==='signum'?Math.sign:Math[name];
      if(fn)return ret(fn(...args));
    }
    if(type==='Ljava/lang/System;'){
      if(name==='currentTimeMillis')return ret(BigInt(Date.now()));
      if(name==='nanoTime')return ret(BigInt(Math.trunc(performance.now()*1e6)));
      if(name==='arraycopy'){const [src,s,dest,t,n]=args;const part=src.slice(s,s+n);for(let j=0;j<n;j++)dest[t+j]=part[j];return ret(0);}
      if(name==='gc')return ret(0);
      if(name==='getProperty')return ret(args[0]==='os.name'?'Browser':args[1]||'');
    }
    if(type==='Landroid/view/View;'||type==='Luk/fiveaces/nsfc/BBAndroidGame$GameView;'){
      if(name==='getWidth')return ret(this.options.width||640);
      if(name==='getHeight')return ret(this.options.height||960);
    }
    if(type.startsWith('[')&&name==='clone'){const array=self.slice();array.$class=self.$class;return ret(array);}
    if(type==='Ljava/nio/ByteBuffer;'||type==='Ljava/nio/ShortBuffer;'||type==='Ljava/nio/IntBuffer;'||type==='Ljava/nio/FloatBuffer;'||type==='Ljava/nio/Buffer;'){
      if(name==='allocate'||name==='allocateDirect')return ret({$class:'Ljava/nio/ByteBuffer;',bytes:new Uint8Array(args[0]),position:0,unit:1});
      if(name==='wrap')return ret({$class:type,array:args[0],position:args[1]||0,unit:type==='Ljava/nio/ByteBuffer;'?1:type==='Ljava/nio/ShortBuffer;'?2:4});
      if(name==='order')return ret(self);
      if(name==='asIntBuffer'||name==='asFloatBuffer')return ret({$class:name==='asIntBuffer'?'Ljava/nio/IntBuffer;':'Ljava/nio/FloatBuffer;',bytes:self.bytes,position:0,unit:4});
      if(name==='array')return ret(Array.from(self.bytes,b=>b>127?b-256:b));
      if(name==='position'){if(args.length){self.position=args[0];return ret(self);}return ret(self.position);}
      if(name==='rewind'||name==='clear'){self.position=0;return ret(self);}
      if(name==='capacity')return ret(self.array?.length||self.bytes.length/self.unit);
      if(name==='put'||name==='get'){
        if(self.array){if(Array.isArray(args[0])){const array=args[0],start=args[1]||0,count=args[2]??array.length;for(let j=0;j<count;j++){if(name==='put')self.array[self.position++]=array[start+j];else array[start+j]=self.array[self.position++];}return ret(self);}const off=args.length===2?args[0]:name==='get'&&args.length?args[0]:self.position++;if(name==='get')return ret(self.$class==='Ljava/nio/FloatBuffer;'?F(self.array[off]):self.array[off]);self.array[off]=self.$class==='Ljava/nio/FloatBuffer;'?BF(args.at(-1)):args.at(-1);return ret(self);}
        const v=new DataView(self.bytes.buffer,self.bytes.byteOffset,self.bytes.byteLength),format=self.$class==='Ljava/nio/FloatBuffer;'?'Float32':self.unit===4?'Int32':self.unit===2?'Int16':'Int8';
        if(Array.isArray(args[0])){const arr=args[0],start=args[1]||0,count=args.length>2?args[2]:arr.length;for(let j=0;j<count;j++){if(name==='put')v['set'+format](self.position++*self.unit,format==='Float32'?F(arr[start+j]):arr[start+j],true);else arr[start+j]=format==='Float32'?BF(v['get'+format](self.position++*self.unit,true)):v['get'+format](self.position++*self.unit,true);}return ret(self);}
        const off=args.length===2?args[0]:name==='get'&&args.length?args[0]:self.position++;
        if(name==='get')return ret(v['get'+format](off*self.unit,true));v['set'+format](off*self.unit,args.at(-1),true);return ret(self);
      }
    }
    if(type==='Ljava/nio/ByteOrder;'&&name==='nativeOrder')return ret({$class:type});
    if(type==='Landroid/opengl/GLES11;'||type==='Landroid/opengl/GLES11Ext;'){
      if(this.options.graphics)return ret(this.options.graphics.invoke(name,args));
      if(name.startsWith('glGen'))for(let j=0;j<args[0];j++)args[1][(args[2]||0)+j]=j+1;
      if(name==='glIsTexture')return ret(true);
      if(name==='glCheckFramebufferStatusOES')return ret(36053);
      return ret(0);
    }
    if(type==='Ljava/lang/StringBuilder;'||type==='Ljava/lang/StringBuffer;'){
      if(name==='<init>'){self.text=typeof args[0]==='string'?args[0]:'';return ret(0);}
      if(name==='append'){self.text+=(proto[1][0]==='C'?String.fromCharCode(args[0]):proto[1][0]==='Z'?String(!!args[0]):args[0]===0&&proto[1][0].startsWith('L')?'null':String(args[0]));return ret(self);}
      if(name==='toString')return ret(self.text||'');
      if(name==='length')return ret((self.text||'').length);
    }
    if(type==='Ljava/lang/String;'){
      if(name==='valueOf')return ret(proto[1][0]==='C'?String.fromCharCode(args[0]):proto[1][0]==='Z'?String(!!args[0]):String(args[0]));
      if(name==='<init>'){if(proto[1][0]==='[C'){const array=args.length>1?args[0].slice(args[1],args[1]+args[2]):args[0];self.text='';for(let j=0;j<array.length;j+=8192)self.text+=String.fromCharCode(...array.slice(j,j+8192));}else self.text=typeof args[0]==='string'?args[0]:new TextDecoder(typeof args[1]==='string'?args[1]:'utf-8').decode(Uint8Array.from(args.length>2?args[0].slice(args[1],args[1]+args[2]):args[0]||[]));self.toString=()=>self.text;return ret(0);}
      const s=typeof self==='string'?self:self?.text;
      if(name==='concat'){if(args[0]===0||args[0]==null)throw new JavaError('Ljava/lang/NullPointerException;','String.concat');return ret(s+String(args[0]));}
      if(name==='length')return ret(s.length);
      if(name==='isEmpty')return ret(!s.length);
      if(name==='charAt')return ret(s.charCodeAt(args[0]));
      if(name==='equals'||name==='equalsIgnoreCase')return ret(name==='equals'?s===String(args[0]):s.toLowerCase()===String(args[0]).toLowerCase());
      if(name==='substring')return ret(s.substring(...args));
      if(name==='indexOf'||name==='lastIndexOf')return ret(s[name](proto[1][0]==='I'?String.fromCharCode(args[0]):args[0],args[1]));
      if(name==='startsWith')return ret(s.startsWith(args[0],args[1]||0));
      if(name==='endsWith')return ret(s.endsWith(args[0]));
      if(name==='trim')return ret(s.trim());
      if(name==='toLowerCase')return ret(s.toLowerCase());
      if(name==='toUpperCase')return ret(s.toUpperCase());
      if(name==='replace')return ret(s.replaceAll(proto[1][0]==='C'?String.fromCharCode(args[0]):args[0],proto[1][1]==='C'?String.fromCharCode(args[1]):args[1]));
      if(name==='compareTo'){const other=String(args[0]);for(let j=0;j<Math.min(s.length,other.length);j++){const difference=s.charCodeAt(j)-other.charCodeAt(j);if(difference)return ret(difference);}return ret(s.length-other.length);}
      if(name==='toCharArray')return ret(Array.from({length:s.length},(_,i)=>s.charCodeAt(i)));
      if(name==='getBytes')return ret(Array.from(new TextEncoder().encode(s),b=>b>127?b-256:b));
      if(name==='hashCode'){let n=0;for(let j=0;j<s.length;j++)n=(Math.imul(n,31)+s.charCodeAt(j))|0;return ret(n);}
    }
    if(['Ljava/lang/Integer;','Ljava/lang/Float;','Ljava/lang/Double;','Ljava/lang/Long;','Ljava/lang/Boolean;'].includes(type)){
      if(name.startsWith('parse')){const n=name==='parseBoolean'?args[0]==='true':name==='parseInt'?parseInt(args[0],args[1]||10):Number(args[0]);if(Number.isNaN(n))throw new JavaError('Ljava/lang/NumberFormatException;',args[0]);return ret(n);}
      if(name==='valueOf')return ret(args[0]);
      if(name==='toString')return ret(String(args[0]??self));
      if(name==='floatToIntBits'||name==='floatToRawIntBits')return ret(BF(args[0]));
      if(name==='intBitsToFloat')return ret(F(args[0]));
      if(name.endsWith('Value'))return ret(self.value??self);
    }
    if(type==='Ljava/util/Vector;'||type==='Ljava/util/ArrayList;'||type==='Ljava/util/List;'){
      if(name==='<init>'){self.items=[];return ret(0);}
      if(name==='addElement'||name==='add'){self.items.push(args[0]);return ret(true);}
      if(name==='size')return ret(self.items.length);
      if(name==='remove')return ret(self.items.splice(args[0],1)[0]);
      if(name==='get'||name==='elementAt')return ret(self.items[args[0]]);
      if(name==='clear'){self.items=[];return ret(0);}
      if(name==='iterator')return ret({$class:'Ljava/util/Iterator;',items:self.items,index:0});
      if(name==='isEmpty')return ret(self.items.length===0);
    }
    if(type==='Ljava/util/HashMap;'||type==='Ljava/util/Map;'){
      if(name==='<init>'){self.map=new Map();return ret(0);}
      if(name==='put'){const old=self.map.get(args[0]);self.map.set(args[0],args[1]);return ret(old||0);}
      if(name==='get')return ret(self.map.get(args[0])||0);
      if(name==='remove'){const old=self.map.get(args[0]);self.map.delete(args[0]);return ret(old||0);}
      if(name==='containsKey')return ret(self.map.has(args[0]));
      if(name==='entrySet')return ret({$class:'Ljava/util/Set;',items:[...self.map.entries()].map(([key,value])=>({$class:'Ljava/util/Map$Entry;',key,value}))});
      if(name==='size')return ret(self.map.size);
      if(name==='clear'){self.map.clear();return ret(0);}
    }
    if(type==='Ljava/util/Set;'&&name==='iterator')return ret({$class:'Ljava/util/Iterator;',items:self.items,index:0});
    if(type==='Ljava/util/Iterator;'){
      if(name==='hasNext')return ret(self.index<self.items.length);
      if(name==='next')return ret(self.items[self.index++]);
      if(name==='remove'){self.items.splice(--self.index,1);return ret(0);}
    }
    if(type==='Ljava/text/NumberFormat;'){
      if(name==='getInstance')return ret({$class:type});
      if(name.startsWith('set'))return ret(0);
      if(name==='format')return ret(String(args[0]));
    }
    if(type==='Ljava/util/Calendar;'||type==='Ljava/util/GregorianCalendar;'){
      if(name==='getInstance')return ret({$class:'Ljava/util/Calendar;',date:new Date()});
      if(name==='get'){const d=self.date;const values={1:d.getFullYear(),2:d.getMonth(),5:d.getDate(),7:d.getDay()+1,10:d.getHours()%12,11:d.getHours(),12:d.getMinutes(),13:d.getSeconds(),14:d.getMilliseconds()};return ret(values[args[0]]||0);}
      if(name==='getTimeInMillis')return ret(BigInt(self.date.getTime()));
      if(name==='setTimeInMillis'){self.date=new Date(Number(args[0]));return ret(0);}
    }
    if(type==='Ljava/util/Arrays;'){
      if(name==='copyOf'){const result=args[0].slice(0,args[1]);while(result.length<args[1])result.push(0);result.$class=args[0].$class;return ret(result);}
      if(name==='fill'){const [array,...v]=args;if(v.length===1)array.fill(v[0]);else array.fill(v[2],v[0],v[1]);return ret(0);}
    }
    return this.options.invoke?.(vm,ref,proto,raw,staticCall,args,self);
  }
  path(path){return path.replace(/^monkey:\/\/data\//,'').replace(/^monkey\//,'').replace(/^monkey:\/\/internal\//,'@internal/').replace(/^monkey:\/\/external\//,'@external/');}
  persist(path){if(!path.startsWith('@')||!this.options.storage)return;const bytes=this.files.get(path);let binary='';for(let p=0;p<bytes.length;p+=8192)binary+=String.fromCharCode(...bytes.subarray(p,p+8192));this.options.storage.setItem('nsm-file:'+path,btoa(binary));}
  loadString(path){const key=this.path(path);return this.files.has(key)?new TextDecoder().decode(this.files.get(key)):this.options.storage?.getItem(path)||'';}
  makeSurface(width,height){const s={$class:PREFIX+'gxtkSurface;',$fields:new Map(),width,height,seq:1,texId:++this.surfaceId|| (this.surfaceId=1)};s.bitmap={$class:'Landroid/graphics/Bitmap;',surface:s};this.options.graphics?.registerSurface(s);return s;}
  getField(vm,obj,id){const name=vm.dex.fields[id][1];if(obj.$class===PREFIX+'gxtkSurface;'){
    if(name in obj)return obj[name];
    if(name==='width'||name==='twidth')return obj.width||0;
    if(name==='height'||name==='theight')return obj.height||0;
    if(name==='uscale')return BF(1/obj.width);
    if(name==='vscale')return BF(1/obj.height);
    if(name==='keepBitmap'||name==='hasAlpha')return 1;
  }}
}

