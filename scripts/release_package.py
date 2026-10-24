"""Reproducible XPI builds with mandatory payload and update-feed verification."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))

def require(condition, message):
    if not condition:
        raise ValueError(message)

def metadata(root):
    manifest = read_json(root / "manifest.json")
    version = manifest["version"]
    for name in ("zotero/manifest.json", "source/package.json", "docs/brand/product.json"):
        file = root / name
        if file.is_file():
            require(read_json(file)["version"] == version, f"{name}: version mismatch")
    lock = root / "source/package-lock.json"
    if lock.is_file():
        data = read_json(lock)
        require(data["version"] == version and data["packages"][""]["version"] == version,
                "source/package-lock.json: version mismatch")
    prefs = (root / "chrome/content/preferences.xhtml").read_text(encoding="utf-8")
    require(f">v{version}<" in prefs, "Settings version badge mismatch")
    for name in ("applications", "browser_specific_settings"):
        if name in manifest:
            require(manifest[name]["zotero"]["id"] == manifest["applications"]["zotero"]["id"],
                    f"{name}: add-on identity mismatch")
    return manifest

def runtime_files(root):
    files = [root / name for name in ("manifest.json", "bootstrap.js", "prefs.js", "chrome.manifest")]
    files += [p for folder in ("chrome", "locale") for p in (root / folder).rglob("*") if p.is_file()]
    require(all(p.is_file() for p in files), "Missing runtime entry file")
    return sorted(files)

def payload(file):
    contents = file.read_bytes()
    # Git checkouts may use CRLF on Windows and LF in CI. Normalize only
    # known UTF-8 runtime text, never binary images or unknown resources.
    if file.suffix.lower() in {'.js', '.json', '.css', '.html', '.xhtml', '.ftl', '.svg', '.manifest', '.properties', '.txt'}:
        contents = contents.decode('utf-8').replace('\r\n', '\n').encode('utf-8')
    return contents

def build(root, output):
    metadata(root)
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for file in runtime_files(root):
            info = zipfile.ZipInfo(file.relative_to(root).as_posix(), date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            archive.writestr(info, payload(file), compresslevel=9)

def verify(root, output, repo, feeds, identities, update=False):
    manifest = metadata(root)
    version = manifest["version"]
    name = f"zotero-{repo.removeprefix('Zotero-').lower()}-{version}.xpi"
    expected = {p.relative_to(root).as_posix(): payload(p) for p in runtime_files(root)}
    with zipfile.ZipFile(output) as archive:
        require(archive.testzip() is None, "Corrupt XPI")
        names = archive.namelist()
        require(len(names) == len(set(names)), "Duplicate archive entries")
        require(set(names) == set(expected), "XPI runtime file set mismatch")
        for path, contents in expected.items():
            require(archive.read(path) == contents, f"Stale XPI resource: {path}")
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    link = f"https://github.com/groele/{repo}/releases/download/v{version}/{name}"
    documents = []
    for feed in feeds:
        path = root / feed
        data = read_json(path)
        require(set(data["addons"]) == set(identities), f"{feed}: add-on identities mismatch")
        for addon_id in identities:
            updates = data["addons"][addon_id]["updates"]
            require(len(updates) == 1, f"{feed}: expected one maintained update")
            entry = updates[0]
            require(entry["version"] == version, f"{feed}: version mismatch")
            require(entry["update_link"] == link, f"{feed}: immutable asset URL mismatch")
            for key in ("strict_min_version", "strict_max_version"):
                require(entry["applications"]["zotero"][key] == manifest["applications"]["zotero"][key],
                        f"{feed}: compatibility mismatch")
            if update:
                entry["update_hash"] = f"sha256:{digest}"
            else:
                require(entry.get("update_hash") == f"sha256:{digest}", f"{feed}: installer SHA-256 mismatch")
        documents.append((path, data))
    # Validate every entry before updating any feed; the feed is not in the XPI.
    if update:
        for path, data in documents:
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    return {"version": version, "file": name, "size": output.stat().st_size,
            "sha256": digest, "entries": len(expected), "payloadVerifiedAgainstWorkspace": True,
            "updateFeedsVerified": list(feeds), "testHarnessIncluded": False,
            "reproducibleZipMetadata": True, "textLineEndings": "LF"}

def main(root, repo, feeds, identities, default_report):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", help="Candidate XPI path")
    parser.add_argument("--report", default=default_report)
    parser.add_argument("--update-feeds", action="store_true", help="Synchronize all update hashes after building")
    parser.add_argument("--verify-only", action="store_true", help="Check existing XPI without rebuilding it")
    args = parser.parse_args()
    require(not (args.verify_only and args.update_feeds), "Verify-only cannot update feeds")
    version = read_json(root / "manifest.json")["version"]
    name = f"zotero-{repo.removeprefix('Zotero-').lower()}-{version}.xpi"
    output = root / (args.output or name)
    if not args.verify_only:
        build(root, output)
    report = verify(root, output, repo, feeds, identities, update=args.update_feeds)
    if not args.verify_only:
        report_path = root / args.report
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8", newline="\n")
        output.with_name("SHA256SUMS.txt").write_text(
            f"{report['sha256']}  {name}\n", encoding="utf-8", newline="\n")
    print(json.dumps(report, indent=2))
