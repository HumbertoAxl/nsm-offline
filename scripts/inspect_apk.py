"""Extract APK assets and inspect ELF exports without executing APK code."""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import struct
import zipfile


def elf_info(data):
    if data[:4] != b'\x7fELF' or data[5] != 1:
        raise ValueError('Expected little-endian ELF')
    bits = 64 if data[4] == 2 else 32
    machine = struct.unpack_from('<H', data, 18)[0]
    if bits == 64:
        offset = struct.unpack_from('<Q', data, 40)[0]
        size, count, names_index = struct.unpack_from('<HHH', data, 58)
        fmt = '<IIQQQQIIQQ'
    else:
        offset = struct.unpack_from('<I', data, 32)[0]
        size, count, names_index = struct.unpack_from('<HHH', data, 46)
        fmt = '<IIIIIIIIII'
    sections = [struct.unpack_from(fmt, data, offset + i * size) for i in range(count)]
    def cstring(blob, start):
        return blob[start:blob.find(b'\0', start)].decode('utf8', 'replace')
    names_section = sections[names_index]
    names = data[names_section[4]:names_section[4] + names_section[5]]
    section_names = [cstring(names, section[0]) for section in sections]
    exports, imports, dependencies = [], [], []
    for section in sections:
        if section[1] not in (2, 11, 6) or not section[9]:
            continue
        strings_section = sections[section[6]]
        strings = data[strings_section[4]:strings_section[4] + strings_section[5]]
        if section[1] == 6:
            for pos in range(section[4], section[4] + section[5], section[9]):
                tag, value = struct.unpack_from('<QQ' if bits == 64 else '<II', data, pos)
                if tag == 1:
                    dependencies.append(cstring(strings, value))
            continue
        for pos in range(section[4], section[4] + section[5], section[9]):
            if bits == 64:
                name, info, other, index, address, length = struct.unpack_from('<IBBHQQ', data, pos)
            else:
                name, address, length, info, other, index = struct.unpack_from('<IIIBBH', data, pos)
            if not name or info >> 4 not in (1, 2):
                continue
            record = {'name': cstring(strings, name), 'address': address, 'size': length, 'kind': info & 15}
            (exports if index else imports).append(record)
    return {'bits': bits, 'machine': {3: 'x86', 40: 'ARM', 183: 'ARM64'}.get(machine, str(machine)),
            'sections': section_names, 'dependencies': sorted(set(dependencies)),
            'exports': list({x['name']: x for x in exports}.values()),
            'imports': sorted(set(x['name'] for x in imports))}


def prepare(root):
    root = root.resolve()
    apks = list(root.glob('*.apk'))
    if len(apks) != 1:
        raise ValueError(f'Expected one APK in {root}')
    apk = apks[0]
    output = root / 'analysis'
    extracted = output / 'extracted'
    output.mkdir(exist_ok=True)
    report = {'apk': apk.name, 'apkSha256': hashlib.sha256(apk.read_bytes()).hexdigest(), 'assets': [], 'libraries': {}, 'dex': []}
    with zipfile.ZipFile(apk) as archive:
        for entry in archive.infolist():
            if entry.is_dir() or not (entry.filename.startswith(('assets/', 'lib/')) or entry.filename.endswith('.dex') or entry.filename == 'AndroidManifest.xml'):
                continue
            target = (extracted / entry.filename).resolve()
            if not target.is_relative_to(extracted.resolve()):
                raise ValueError('Unsafe ZIP path: ' + entry.filename)
            data = archive.read(entry)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            if entry.filename.startswith('assets/'):
                report['assets'].append({'path': entry.filename, 'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
            elif entry.filename.endswith('.so'):
                info = elf_info(data)
                report['libraries'][entry.filename] = info
                (output / (entry.filename.replace('/', '_') + '.symbols.json')).write_text(json.dumps(info, indent=2), encoding='utf8')
            elif entry.filename.endswith('.dex'):
                report['dex'].append(entry.filename)
    report['assetExtensions'] = dict(collections.Counter(Path(x['path']).suffix.lower() for x in report['assets']))
    (output / 'native-apk-inventory.json').write_text(json.dumps(report, indent=2), encoding='utf8')
    lines = [f"# Inspection of {root.name}", '', f"APK: `{apk.name}`", f"SHA-256: `{report['apkSha256']}`", '',
             f"Extracted assets: {len(report['assets'])}.", '', '## Native libraries', '']
    for name, info in report['libraries'].items():
        lines += [f"- `{name}`: {info['machine']} {info['bits']} bits; {len(info['exports'])} defined symbols; {len(info['imports'])} imports.",
                  f"  Dependencies: {', '.join(info['dependencies'])}."]
    lines += ['', '## Status', '', 'Assets and libraries extracted without executing the APK. Java code is decompiled separately by JADX.',
              'The native libraries have not yet been ported. This project is not yet a playable browser game.',
              'The NSS DEX runtime does not execute ARM or x86 instructions from these libraries.',
              'The next technical step is to map initialization, rendering, input, audio, files, and persistent state in the native engine.']
    (output / 'STATUS.md').write_text('\n'.join(lines) + '\n', encoding='utf8')
    print(json.dumps({'project': str(root), 'assets': len(report['assets']), 'extensions': report['assetExtensions'],
                      'libraries': {k: {'machine': v['machine'], 'exports': len(v['exports']), 'imports': len(v['imports'])} for k, v in report['libraries'].items()}}, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('roots', nargs='+', type=Path)
    for root in parser.parse_args().roots:
        prepare(root)
