# MindFlow for Zotero 11.2.3

MindFlow 11.2.3 updates the in-app brand identity mark to the new Fluid Origami Wing (流体折纸旋翼) and adds complete native support for the Zotero Tab Bar workspace icon.

## Changes

- **In-App Header Brand Identity**: Completely replaced the legacy star-graph (`MapGraph`) SVG in `MindFlowMark.tsx` with the new Fluid Origami Wing vector design (`#06B6D4` -> `#3B82F6`, `#6366F1` -> `#A855F7`, `#EC4899` -> `#F43F5E`), updating the top-left logo inside the mind map editor and welcome dialog.
- **Native Zotero Tab Icon**: Added `icon: 'mindflow'` metadata to `tabs.add` and injected dual `background-image` / `list-style-image` CSS rules for `.tab .tab-icon.icon-mindflow`, ensuring MindFlow workspace tabs display the crisp fluid wing icon on Zotero's main tab bar.
