"""Prepare bundled NSM assets while preserving the working browser runtime.

The NSS implementation is a one-time bootstrap source for missing shared files.
Refreshing existing runtime snapshots is an explicit maintenance operation.
"""
import argparse
import base64
import json
from pathlib import Path
import re
import shutil
import struct
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
NSS = ROOT.parent / 'NSS Reverse Engineering'
OUT = ROOT / 'web' / 'dist'
SHARED = ('dex-vm.js', 'dex-jit.js', 'java-host.js', 'font-host.js', 'audio-host.js', 'save-store.js')


def bootstrap_shared(name):
    text = (NSS / 'web' / 'dist' / name).read_text(encoding='utf-8-sig')
    text = re.sub(r'\?v=[\w-]+', '', text)
    text = text.replace('Lcom/newstargames/newstarsoccer/', 'Luk/fiveaces/nsfc/')
    text = text.replace('nss-', 'nsm-').replace('NSSVeriox', 'NSMVeriox').replace('NSSTCB', 'NSMTCB')
    if name == 'font-host.js':
        # NSM bundles additional font faces; use the same family mapping as app.js.
        text = re.sub(r"export const fontFamily=path=>[^;]+;", "export const fontFamily=path=>'NSMFont_'+path.split('/').pop().replace(/\\\\.ttf$/,'');", text)
    if name == 'save-store.js':
        # NSM's platform API supports multiple named state slots.
        text = text.replace("const isSaveKey=k=>", "const isSaveKey=k=>k.startsWith('nsm-state:')||")
    return text


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh-shared', action='store_true', help='Explicitly replace shared runtime snapshots with the current NSS bootstrap versions; review local platform fixes afterward.')
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    refreshed, preserved = [], []
    for name in SHARED:
        destination = OUT / name
        if destination.exists() and not args.refresh_shared:
            preserved.append(name)
            continue
        destination.write_text(bootstrap_shared(name), encoding='utf-8')
        refreshed.append(name)
    shutil.copyfile(ROOT / 'analysis' / 'game-dex.json', OUT / 'game-dex.json')
    manifest, bundle = [], {}
    with zipfile.ZipFile(ROOT / 'new-star-manager.apk') as archive:
        for info in archive.infolist():
            if info.is_dir() or not info.filename.startswith('assets/monkey/'):
                continue
            path = info.filename[len('assets/monkey/'):]
            data = archive.read(info)
            destination = OUT / 'assets' / path
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)
            asset = {'path': path, 'size': len(data)}
            if data.startswith(b'\x89PNG\r\n\x1a\n'):
                asset['width'], asset['height'] = struct.unpack_from('>II', data, 16)
            elif Path(path).suffix.lower() not in ('.mp3', '.ttf'):
                bundle[path] = base64.b64encode(data).decode('ascii')
            manifest.append(asset)
    (OUT / 'asset-manifest.json').write_text(json.dumps(manifest, separators=(',', ':')), encoding='utf-8')
    (OUT / 'runtime-data.json').write_text(json.dumps(bundle, separators=(',', ':')), encoding='utf-8')
    subprocess.run(['node', str(ROOT / 'web' / 'tools' / 'pack-assets.mjs')], check=True)
    print(f'Prepared {len(manifest)} bundled assets.')
    print('Preserved runtime snapshots:', ', '.join(preserved) or '(none)')
    print('Bootstrapped runtime snapshots:', ', '.join(refreshed) or '(none)')
    print('Maximum image dimensions:', max(a.get('width', 0) for a in manifest), max(a.get('height', 0) for a in manifest))


if __name__ == '__main__':
    main()
