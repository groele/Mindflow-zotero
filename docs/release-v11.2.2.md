# MindFlow for Zotero 11.2.2

MindFlow 11.2.2 fixes the toolbar button icon display in Zotero's main library toolbar by standardizing all toolbar references and assets on the high-definition Fluid Origami Wing (`icon.svg`).

## Changes

- **Toolbar Button Icon Display**: Directly mounts `icon.svg` onto the main toolbar button (`#mindflow-toolbar-button`) and `.toolbarbutton-icon`, completely replacing legacy or transparent paint definitions with concrete vibrant gradients (`#06B6D4` -> `#3B82F6`, `#6366F1` -> `#A855F7`, `#EC4899` -> `#F43F5E`).
- **Layout & Sizing Fix**: Removes strict button-container dimensions to ensure proper alignment and native padding alongside sibling toolbar items (like Todolist and MetaFlow), keeping crisp 20×20 scaling on the `.toolbarbutton-icon` element.
- **Universal Asset Parity**: Synchronized `icon.svg`, `mindflow.svg`, `mindflow-toolbar.svg`, and `toolbar-mindflow.svg` in both `chrome/content/icons/` and `chrome/content/assets/icons/` with 100% scalable vector geometry.
