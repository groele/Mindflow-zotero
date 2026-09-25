/**
 * MindFlow for Zotero - Preference Pane Script
 * Handles reading and writing settings in Zotero's Native Preferences Window
 */

var MindFlow_Preferences = {
  init(window) {
    try {
      const doc = window.document;
      if (!doc) return;

      // 1. Window Mode (Radio Group)
      const windowModeGroup = doc.getElementById('mindflow-pref-windowMode');
      if (windowModeGroup) {
        const currentMode = Zotero.Prefs.get('extensions.mindflow.windowMode', true) || 'tab';
        windowModeGroup.value = currentMode;
        windowModeGroup.addEventListener('command', (e) => {
          const val = windowModeGroup.value;
          Zotero.Prefs.set('extensions.mindflow.windowMode', val, true);
        });
      }

      // 2. Checkboxes
      const checkboxes = [
        { id: 'mindflow-pref-includeAbstract', pref: 'extensions.mindflow.includeAbstract', def: true },
        { id: 'mindflow-pref-includeAnnotations', pref: 'extensions.mindflow.includeAnnotations', def: true },
        { id: 'mindflow-pref-includeTags', pref: 'extensions.mindflow.includeTags', def: true },
        { id: 'mindflow-pref-autoOpenAfterExport', pref: 'extensions.mindflow.autoOpenAfterExport', def: true },
      ];

      for (const item of checkboxes) {
        const el = doc.getElementById(item.id);
        if (el) {
          const checked = Zotero.Prefs.get(item.pref, true);
          el.checked = checked !== undefined ? Boolean(checked) : item.def;
          el.addEventListener('command', () => {
            Zotero.Prefs.set(item.pref, Boolean(el.checked), true);
          });
        }
      }

      // 3. Dropdowns
      const selects = [
        { id: 'mindflow-pref-defaultLayout', pref: 'extensions.mindflow.defaultLayout', def: 'mindmap' },
        { id: 'mindflow-pref-theme', pref: 'extensions.mindflow.theme', def: 'academic' },
      ];

      for (const item of selects) {
        const el = doc.getElementById(item.id);
        if (el) {
          const val = Zotero.Prefs.get(item.pref, true) || item.def;
          el.value = val;
          el.addEventListener('change', () => {
            Zotero.Prefs.set(item.pref, el.value, true);
          });
        }
      }
    } catch (e) {
      Zotero.logError?.('[MindFlow] Error initializing preferences pane: ' + e);
    }
  },
};
