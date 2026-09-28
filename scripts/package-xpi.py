from pathlib import Path
import hashlib, json, zipfile

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
output = root / f"mindflow-zotero-{manifest['version']}.xpi"
files = [root / name for name in ['manifest.json', 'bootstrap.js', 'prefs.js', 'chrome.manifest', 'update.json']]
for directory in ['chrome', 'locale']:
    files.extend(p for p in (root / directory).rglob('*') if p.is_file())
with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for file in sorted(files):
        archive.write(file, file.relative_to(root).as_posix())
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
    assert json.loads(archive.read('manifest.json'))['version'] == manifest['version']
    assert not any('native-regression' in name or 'node_modules' in name or 'backups/' in name for name in archive.namelist())
    for file in files:
        assert archive.read(file.relative_to(root).as_posix()) == file.read_bytes()
report = {'version': manifest['version'], 'file': output.name, 'size': output.stat().st_size,
          'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'entries': len(files),
          'payloadVerifiedAgainstWorkspace': True, 'testHarnessIncluded': False}
(root / 'docs/package-verification.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
