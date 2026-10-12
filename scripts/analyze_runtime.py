import importlib.util,json,pathlib,re,zipfile,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
NSS=ROOT.parent/'NSS Reverse Engineering'
spec=importlib.util.spec_from_file_location('dex_exporter',ROOT/'scripts/dex_exporter.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);mod.PREFIX='Luk/fiveaces/nsfc/'
with zipfile.ZipFile(ROOT/'new-star-manager.apk') as z:
 assert z.testzip() is None
 dex=mod.export_dex(z.read('classes4.dex'))
(ROOT/'analysis/game-dex.json').write_text(json.dumps(dex,separators=(',',':')),encoding='utf8')
def summary(d):
 methods=[m for c in d['classes'] for m in c['methods']]
 return {'classes':len(d['classes']),'declaredMethods':len(methods),'methodsWithBytecode':sum('code' in m for m in methods),'declaredNativeMethods':sum(bool(m['flags']&256) for m in methods),'dexSha256':d['dex_sha256']}
nss=json.loads((NSS/'web/dist/game-dex.json').read_text(encoding='utf8'))
short=lambda c:c['name'].rsplit('/',1)[-1]
shared=sorted({short(c) for c in dex['classes']} & {short(c) for c in nss['classes']})
sources=ROOT/'analysis/decompiled/sources/uk/fiveaces/nsfc'
gles=set();java_calls=set()
for p in sources.glob('*.java'):
 text=p.read_text(encoding='utf8')
 gles.update(re.findall(r'GLES20\.(gl\w+)\(',text))
 java_calls.update(re.findall(r'(?:LoadState2|SaveState2)\([^;]+',text))
glhost=(NSS/'web/dist/gl-host.js').read_text(encoding='utf8')
report={'artifact':{'filename':'new-star-manager.apk','bytes':(ROOT/'new-star-manager.apk').stat().st_size,'sha256':hashlib.sha256((ROOT/'new-star-manager.apk').read_bytes()).hexdigest(),'downloadUrl':'https://d.apkpure.net/b/APK/uk.fiveaces.nsfc?version=latest','observedGameVersion':'1.7.7','downloadDate':'2026-10-11','signatureVerification':'Not independently verified; ZIP integrity checked'},'nsm':summary(dex),'nss':summary(nss),'sharedSimpleClassNames':len(shared),'sharedClassSamples':shared[:30],'gles20MethodsObserved':sorted(gles),'gles20MethodNamesAbsentFromNssGlHost':[x for x in sorted(gles) if x not in glhost],'limitations':['Static class-name overlap does not establish behavioral compatibility.','GLES method-name absence is a bounded text comparison, not a runtime dispatch test.','JADX reported 77 decompilation errors; raw DEX bytecode is retained.','No Android or browser game execution was performed.']}
(ROOT/'analysis/runtime-comparison.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report,indent=2))
