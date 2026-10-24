"""Exercise release failures using an isolated synthetic plugin."""
import json
import os
from pathlib import Path
import tempfile
import unittest
import zipfile
from release_package import build, verify, metadata

class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.repo = "Zotero-Sample"
        self.identities = ("sample@example.org", "legacy@example.org")
        self.feeds = ("update.json", "zotero/update.json")
        self.manifest = {"version": "1.2.3", "applications": {"zotero": {
            "id": self.identities[0], "strict_min_version": "10", "strict_max_version": "10.*"}}}
        self.write_json("manifest.json", self.manifest)
        for name in ("bootstrap.js", "prefs.js", "chrome.manifest", "chrome/content/preferences.xhtml"):
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(">v1.2.3<", encoding="utf-8")
        entry = {"version": "1.2.3", "update_hash": "sha256:old",
                 "update_link": "https://github.com/groele/Zotero-Sample/releases/download/v1.2.3/zotero-sample-1.2.3.xpi",
                 "applications": {"zotero": {"strict_min_version": "10", "strict_max_version": "10.*"}}}
        for feed in self.feeds:
            self.write_json(feed, {"addons": {i: {"updates": [entry]} for i in self.identities}})
        self.output = self.root / "candidate.xpi"

    def write_json(self, name, value):
        file = self.root / name
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(json.dumps(value), encoding="utf-8")

    def check(self, update=False):
        return verify(self.root, self.output, self.repo, self.feeds, self.identities, update)

    def test_stale_hash_is_rejected_then_all_aliases_are_synchronized(self):
        build(self.root, self.output)
        with self.assertRaisesRegex(ValueError, "SHA-256 mismatch"):
            self.check()
        report = self.check(update=True)
        self.assertEqual(self.check(), report)
        for feed in self.feeds:
            data = json.loads((self.root / feed).read_text())
            for identity in self.identities:
                self.assertEqual(data["addons"][identity]["updates"][0]["update_hash"],
                                 "sha256:" + report["sha256"])

    def test_rebuild_is_byte_identical_after_mtime_changes(self):
        build(self.root, self.output)
        before = self.output.read_bytes()
        os.utime(self.root / "bootstrap.js", (1700000000, 1700000000))
        build(self.root, self.output)
        self.assertEqual(self.output.read_bytes(), before)

    def test_modified_runtime_payload_is_rejected(self):
        build(self.root, self.output)
        self.check(update=True)
        (self.root / "bootstrap.js").write_text("changed")
        with self.assertRaisesRegex(ValueError, "Stale XPI resource"):
            self.check()

    def test_crlf_and_lf_checkouts_produce_the_same_installer(self):
        script = self.root / 'bootstrap.js'
        script.write_bytes(b'// unicode-safe runtime\r\nconst value = 1;\r\n')
        build(self.root, self.output)
        before = self.output.read_bytes()
        script.write_bytes(script.read_bytes().replace(b'\r\n', b'\n'))
        build(self.root, self.output)
        self.assertEqual(self.output.read_bytes(), before)

    def test_missing_or_duplicate_runtime_resources_are_rejected(self):
        build(self.root, self.output)
        with zipfile.ZipFile(self.output, "a") as archive:
            archive.writestr("unexpected.txt", "injected")
        with self.assertRaisesRegex(ValueError, "file set mismatch"):
            self.check()

    def test_mirror_version_and_settings_mismatch_are_rejected(self):
        self.write_json("zotero/manifest.json", {**self.manifest, "version": "1.2.2"})
        with self.assertRaisesRegex(ValueError, "version mismatch"):
            metadata(self.root)
        self.write_json("zotero/manifest.json", self.manifest)
        (self.root / "chrome/content/preferences.xhtml").write_text(">v1.2.2<")
        with self.assertRaisesRegex(ValueError, "badge mismatch"):
            metadata(self.root)

    def test_invalid_later_feed_never_partially_updates_earlier_feed(self):
        build(self.root, self.output)
        before = (self.root / self.feeds[0]).read_bytes()
        bad = json.loads((self.root / self.feeds[1]).read_text())
        del bad["addons"][self.identities[1]]
        self.write_json(self.feeds[1], bad)
        with self.assertRaisesRegex(ValueError, "identities mismatch"):
            self.check(update=True)
        self.assertEqual((self.root / self.feeds[0]).read_bytes(), before)

if __name__ == "__main__":
    unittest.main()
