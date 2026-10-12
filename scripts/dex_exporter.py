"""Export original app DEX and bundled resources for a browser runtime.

Does not execute APK code. Rejects ZIP paths escaping the output directory.
"""
from pathlib import Path
import base64
import hashlib
import json
import struct
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'web' / 'dist'
PREFIX = 'Lcom/newstargames/newstarsoccer/'


def export_dex(data):
    u32 = lambda off: struct.unpack_from('<I', data, off)[0]
    def uleb(off):
        val = shift = 0
        while True:
            b = data[off]; off += 1
            val |= (b & 127) << shift
            if b < 128: return val, off
            shift += 7
    def sleb(off):
        val = shift = 0
        while True:
            b = data[off]; off += 1
            val |= (b & 127) << shift; shift += 7
            if b < 128:
                return val - (1 << shift) if b & 64 else val, off
    strings = []
    for i in range(u32(56)):
        _, off = uleb(u32(u32(60) + i * 4))
        strings.append(data[off:data.index(b'\0', off)].decode('utf8', errors='replace'))
    types = [strings[u32(u32(68)+4*i)] for i in range(u32(64))]
    protos = []
    for i in range(u32(72)):
        short, ret, params = struct.unpack_from('<3I', data, u32(76)+12*i)
        args = [] if not params else [types[struct.unpack_from('<H', data, params+4+2*j)[0]] for j in range(u32(params))]
        protos.append([types[ret], args])
    fields = []
    for i in range(u32(80)):
        c,t,n = struct.unpack_from('<HHI', data, u32(84)+8*i)
        fields.append([types[c], strings[n], types[t]])
    methods = []
    for i in range(u32(88)):
        c,p,n = struct.unpack_from('<HHI', data, u32(92)+8*i)
        methods.append([types[c], strings[n], p])
    def encoded(off):
        tag = data[off]; off += 1
        kind, n = tag & 31, (tag >> 5) + 1
        if kind == 0x1e: return None, off
        if kind == 0x1f: return bool(tag >> 5), off
        if kind == 0x1c:
            count, off = uleb(off); vals=[]
            for _ in range(count):
                val,off=encoded(off); vals.append(val)
            return vals,off
        raw=data[off:off+n]; off+=n
        if kind in (0x00,0x02,0x04,0x06): return int.from_bytes(raw,'little',signed=True),off
        if kind in (0x10,0x11):
            width=4 if kind==0x10 else 8
            return struct.unpack('<f' if width==4 else '<d',b'\0'*(width-n)+raw)[0],off
        val=int.from_bytes(raw,'little')
        if kind==0x17: return strings[val],off
        if kind==0x18: return {'type':types[val]},off
        return val,off
    classes = []
    for i in range(u32(96)):
        c,flags,parent,interfaces,source,annotations,classdata,static = struct.unpack_from('<8I',data,u32(100)+32*i)
        if not types[c].startswith(PREFIX): continue
        implemented=[] if not interfaces else [types[struct.unpack_from('<H',data,interfaces+4+2*j)[0]] for j in range(u32(interfaces))]
        item={'name':types[c],'parent':None if parent==0xffffffff else types[parent], 'interfaces':implemented,'flags':flags,'fields':[],'methods':[]}
        static_fields=[]
        if classdata:
            pos=classdata; counts=[]
            for _ in range(4):
                count,pos=uleb(pos); counts.append(count)
            for group,count in enumerate(counts[:2]):
                index=0
                for _ in range(count):
                    diff,pos=uleb(pos); access,pos=uleb(pos); index+=diff
                    item['fields'].append([index,access])
                    if group==0: static_fields.append(index)
            for count in counts[2:]:
                index=0
                for _ in range(count):
                    diff,pos=uleb(pos); access,pos=uleb(pos); code,pos=uleb(pos); index+=diff
                    m={'id':index,'flags':access}
                    if code:
                        regs,ins,outs,tries,debug,units=struct.unpack_from('<4H2I',data,code)
                        m.update({'registers':regs,'ins':ins,'code':base64.b64encode(data[code+16:code+16+units*2]).decode()})
                        if tries:
                            start=code+16+units*2+(2 if units&1 else 0)
                            handler_base=start+8*tries
                            regions=[]
                            for k in range(tries):
                                region,length,handler=struct.unpack_from('<IHH',data,start+8*k)
                                count,hpos=sleb(handler_base+handler); catches=[]
                                for _ in range(abs(count)):
                                    typ,hpos=uleb(hpos); address,hpos=uleb(hpos)
                                    catches.append([types[typ],address])
                                if count<=0:
                                    address,hpos=uleb(hpos); catches.append([None,address])
                                regions.append([region,length,catches])
                            m['tries']=regions
                    item['methods'].append(m)
        values=[]
        if static:
            count,off=uleb(static)
            for j in range(count):
                val,off=encoded(off); values.append([static_fields[j],val])
        item['values']=values
        classes.append(item)
    return {'strings':strings,'types':types,'protos':protos,'fields':fields,'methods':methods,'classes':classes,
            'dex_sha256':hashlib.sha256(data).hexdigest()}


if __name__ == '__main__':
    OUT.mkdir(parents=True,exist_ok=True)
    manifest=[]; bundle={}
    with zipfile.ZipFile(ROOT/'analysis'/'base.apk') as z:
        for info in z.infolist():
            if not info.filename.startswith('assets/monkey/') or info.is_dir(): continue
            relative=Path(info.filename.removeprefix('assets/monkey/'))
            dest=(OUT/'assets'/relative).resolve()
            dest.relative_to((OUT/'assets').resolve())
            dest.parent.mkdir(parents=True,exist_ok=True)
            content=z.read(info)
            dest.write_bytes(content)
            entry={'path':relative.as_posix(),'size':len(content),'sha256':hashlib.sha256(content).hexdigest()}
            if relative.suffix=='.png' and content.startswith(b'\x89PNG\r\n\x1a\n'):
                entry['width'],entry['height']=struct.unpack_from('>II',content,16)
            elif relative.suffix in ('.jpg','.png'):
                from PIL import Image
                import io
                entry['width'],entry['height']=Image.open(io.BytesIO(content)).size
            elif relative.suffix not in ('.ogg','.ttf'):
                bundle[relative.as_posix()]=base64.b64encode(content).decode()
            manifest.append(entry)
        runtime=export_dex(z.read('classes3.dex'))
    (OUT/'game-dex.json').write_text(json.dumps(runtime,separators=(',',':'),ensure_ascii=True),encoding='utf8')
    (OUT/'asset-manifest.json').write_text(json.dumps(manifest,separators=(',',':')),encoding='utf8')
    (OUT/'runtime-data.json').write_text(json.dumps(bundle,separators=(',',':')),encoding='utf8')
    print('Exported',len(manifest),'assets and',len(runtime['classes']),'original classes')
