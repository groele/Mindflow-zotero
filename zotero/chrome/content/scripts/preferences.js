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
        windowModeGroup.addEventListener('command', () => {
          const val = windowModeGroup.value;
          Zotero.Prefs.set('extensions.mindflow.windowMode', val, true);
        });
      }

      // 2. All Checkboxes
      const checkboxes = [
        { id: 'mindflow-pref-showWelcomeOnStartup', pref: 'extensions.mindflow.showWelcomeOnStartup', def: true },
        { id: 'mindflow-pref-autoArchiveToItem', pref: 'extensions.mindflow.autoArchiveToItem', def: true },
        { id: 'mindflow-pref-includeAbstract', pref: 'extensions.mindflow.includeAbstract', def: true },
        { id: 'mindflow-pref-includeAnnotations', pref: 'extensions.mindflow.includeAnnotations', def: true },
        { id: 'mindflow-pref-includeTags', pref: 'extensions.mindflow.includeTags', def: true },
        { id: 'mindflow-pref-autoOpenAfterExport', pref: 'extensions.mindflow.autoOpenAfterExport', def: true },
        { id: 'mindflow-pref-rainbowBranches', pref: 'extensions.mindflow.rainbowBranches', def: true },
        { id: 'mindflow-pref-soundEffects', pref: 'extensions.mindflow.soundEffects', def: true },
        { id: 'mindflow-pref-autoSnapshotEnabled', pref: 'extensions.mindflow.autoSnapshotEnabled', def: true },
        { id: 'mindflow-pref-webdavEnabled', pref: 'extensions.mindflow.webdavEnabled', def: false },
        { id: 'mindflow-pref-webdavAutoSync', pref: 'extensions.mindflow.webdavAutoSync', def: false },
      ];

      for (const item of checkboxes) {
        const el = doc.getElementById(item.id);
        if (el) {
          const val = Zotero.Prefs.get(item.pref, true);
          el.checked = val !== undefined ? Boolean(val) : item.def;
          el.addEventListener('command', () => {
            Zotero.Prefs.set(item.pref, Boolean(el.checked), true);
          });
        }
      }

      // 3. Dropdown Selects
      const selects = [
        { id: 'mindflow-pref-defaultLayout', pref: 'extensions.mindflow.defaultLayout', def: 'mindmap' },
        { id: 'mindflow-pref-theme', pref: 'extensions.mindflow.theme', def: 'academic' },
        { id: 'mindflow-pref-canvasBackground', pref: 'extensions.mindflow.canvasBackground', def: 'dots' },
        { id: 'mindflow-pref-curveStyle', pref: 'extensions.mindflow.curveStyle', def: 'bezier' },
        { id: 'mindflow-pref-autoSnapshotIntervalMinutes', pref: 'extensions.mindflow.autoSnapshotIntervalMinutes', def: '10' },
      ];

      for (const item of selects) {
        const el = doc.getElementById(item.id);
        if (el) {
          const val = Zotero.Prefs.get(item.pref, true);
          el.value = val !== undefined ? String(val) : item.def;
          el.addEventListener('change', () => {
            const rawVal = el.value;
            // If it's a number, save as number
            if (/^\d+$/.test(rawVal)) {
              Zotero.Prefs.set(item.pref, Number(rawVal), true);
            } else {
              Zotero.Prefs.set(item.pref, rawVal, true);
            }
          });
        }
      }

      // 4. Text and Password Inputs
      const textInputs = [
        { id: 'mindflow-pref-customSavePath', pref: 'extensions.mindflow.customSavePath', def: '' },
        { id: 'mindflow-pref-webdavServerUrl', pref: 'extensions.mindflow.webdavServerUrl', def: '' },
        { id: 'mindflow-pref-webdavBasePath', pref: 'extensions.mindflow.webdavBasePath', def: '/MindFlow/' },
        { id: 'mindflow-pref-webdavUsername', pref: 'extensions.mindflow.webdavUsername', def: '' },
        { id: 'mindflow-pref-webdavPassword', pref: 'extensions.mindflow.webdavPassword', def: '' },
      ];

      for (const item of textInputs) {
        const el = doc.getElementById(item.id);
        if (el) {
          const val = Zotero.Prefs.get(item.pref, true);
          el.value = val !== undefined ? String(val) : item.def;
          el.addEventListener('input', () => {
            Zotero.Prefs.set(item.pref, el.value.trim(), true);
          });
        }
      }

      // 4b. Folder picker button for custom save path
      const btnChooseSavePath = doc.getElementById('mindflow-btn-choose-save-path');
      if (btnChooseSavePath) {
        btnChooseSavePath.addEventListener('click', () => {
          try {
            const fp = Components.classes['@mozilla.org/filepicker;1'].createInstance(
              Components.interfaces.nsIFilePicker
            );
            fp.init(window, '选择 MindFlow 思维导图本地保存文件夹', Components.interfaces.nsIFilePicker.modeGetFolder);
            const handlePick = () => {
              if (fp.file && fp.file.path) {
                const path = fp.file.path;
                const input = doc.getElementById('mindflow-pref-customSavePath');
                if (input) input.value = path;
                Zotero.Prefs.set('extensions.mindflow.customSavePath', path, true);
              }
            };
            if (typeof fp.open === 'function') {
              fp.open((result) => {
                if (
                  result === Components.interfaces.nsIFilePicker.returnOK ||
                  result === Components.interfaces.nsIFilePicker.returnReplace
                ) {
                  handlePick();
                }
              });
            } else {
              const res = fp.show();
              if (
                res === Components.interfaces.nsIFilePicker.returnOK ||
                res === Components.interfaces.nsIFilePicker.returnReplace
              ) {
                handlePick();
              }
            }
          } catch (e) {
            Zotero.logError?.('[MindFlow] Folder picker note: ' + e);
          }
        });
      }

      // 5. Button: Open Workspace
      const btnOpenWorkspace = doc.getElementById('mindflow-btn-open-workspace');
      if (btnOpenWorkspace) {
        btnOpenWorkspace.addEventListener('click', () => {
          if (Zotero.MindFlow && typeof Zotero.MindFlow.openMindFlow === 'function') {
            Zotero.MindFlow.openMindFlow({ mode: 'open' });
          }
        });
      }

      // 6. Button: Reset Defaults
      const btnResetDefaults = doc.getElementById('mindflow-btn-reset-defaults');
      if (btnResetDefaults) {
        btnResetDefaults.addEventListener('click', () => {
          const confirmed = (window.confirm && window.confirm('确定要将 MindFlow 插件的所有设置恢复为出厂默认值吗？')) || true;
          if (confirmed) {
            // Reset prefs
            const defaults = {
              windowMode: 'tab',
              showWelcomeOnStartup: true,
              autoArchiveToItem: true,
              customSavePath: '',
              theme: 'academic',
              defaultLayout: 'mindmap',
              canvasBackground: 'dots',
              curveStyle: 'bezier',
              rainbowBranches: true,
              soundEffects: true,
              includeAbstract: true,
              includeAnnotations: true,
              includeTags: true,
              autoOpenAfterExport: true,
              autoSnapshotEnabled: true,
              autoSnapshotIntervalMinutes: 10,
              webdavEnabled: false,
              webdavServerUrl: '',
              webdavBasePath: '/MindFlow/',
              webdavUsername: '',
              webdavPassword: '',
              webdavAutoSync: false,
            };

            for (const [key, val] of Object.entries(defaults)) {
              Zotero.Prefs.set('extensions.mindflow.' + key, val, true);
            }

            // Re-initialize values in UI
            MindFlow_Preferences.init(window);
            if (window.alert) window.alert('MindFlow 插件设置已成功恢复为默认值！');
          }
        });
      }
    } catch (e) {
      Zotero.logError?.('[MindFlow] Error initializing preferences pane: ' + e);
    }
  },
};
