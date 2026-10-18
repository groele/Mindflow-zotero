# MindFlow for Zotero 11.2.1

MindFlow 11.2.1 updates the visual design and icon system with the new Fluid Origami Wing (流体折纸旋翼) branding and high-DPI Gecko adaptive icons.

## Changes

- **Brand Icon**: Updated plugin icon to the new Fluid Origami Wing (`icon.svg`), with modern gradient styling and high-resolution rendering.
- **Vector Topology & Toolbars**: Replaced old circular network motifs with clean, borderless fluid origami vector icons across toolbar, reader, item pane, and menus.
- **Universal Multi-DPI PNGs**: Generated a complete multi-resolution raster icon package (`icon16.png`, `icon32.png`, `icon48.png`, `icon64.png`, `icon96.png`, `icon128.png`, `icon256.png`) for seamless compatibility across diverse operating systems and display densities.
- **Manifest Integration**: Configured `manifest.json` and `zotero/manifest.json` to mount `icon.svg` directly for crystal-clear vector rendering in Zotero 10 / Gecko 115+.
- **Theme-Adaptive Workflow Icons**: Added full set of 12 workflow action icons with Gecko `-moz-context-properties` dark/light theme awareness via `mindflow-icons.css`.
