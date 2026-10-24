from pathlib import Path
from release_package import main

main(Path(__file__).resolve().parents[1], 'Zotero-MindFlow',
     ('update.json', 'zotero/update.json'), ('mindflow@groele.org',),
     'docs/package-verification.json')
