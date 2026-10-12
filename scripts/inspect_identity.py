import json,struct,zipfile,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
with zipfile.ZipFile(ROOT/'new-star-manager.apk') as z:
 data=z.read('AndroidManifest.xml')
u16=lambda o:struct.unpack_from('<H',data,o)[0]
u32=lambda o:struct.unpack_from('<I',data,o)[0]
strings=[];elements=[];pos=8
while pos<len(data):
 kind,header,size=struct.unpack_from('<HHI',data,pos)
 if kind==1:
  count=u32(pos+8);flags=u32(pos+16);base=pos+u32(pos+20)
  for i in range(count):
   off=base+u32(pos+header+4*i)
   if flags&256:
    length=data[off];off+=1
    if length&128:off+=1
    length=data[off];off+=1
    if length&128:length=((length&127)<<8)|data[off];off+=1
    strings.append(data[off:off+length].decode('utf8','replace'))
   else:
    length=u16(off);off+=2
    if length&32768:length=((length&32767)<<16)|u16(off);off+=2
    strings.append(data[off:off+length*2].decode('utf-16-le','replace'))
 elif kind==258:
  name=strings[u32(pos+20)];attrs={};start=pos+16+u16(pos+24);step=u16(pos+26)
  for i in range(u16(pos+28)):
   off=start+i*step;k=strings[u32(off+4)];raw=u32(off+8);tag=data[off+15];value=u32(off+16)
   attrs[k]=strings[raw] if raw!=4294967295 else strings[value] if tag==3 else bool(value) if tag==18 else value
  elements.append({'tag':name,'attributes':attrs})
 pos+=size
root=next(x['attributes'] for x in elements if x['tag']=='manifest')
report={'manifest':root,'permissions':[x['attributes'].get('name') for x in elements if x['tag']=='uses-permission'],'activities':[x['attributes'] for x in elements if x['tag']=='activity']}
(ROOT/'analysis/apk-identity.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report,indent=2))
