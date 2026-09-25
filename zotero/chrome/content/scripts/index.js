/**
 * MindFlow for Zotero - Runtime Script
 * Injects UI elements into Zotero 7 (Tools menu, context menus, toolbar)
 * and bridges communication with the MindFlow Mind Map workspace.
 */

(function () {
  if (typeof Zotero === 'undefined') {
    return;
  }

  const ADDON_ID = 'mindflow@groele.org';
  const CHROME_ROOT = 'chrome://mindflow/content/';

  // Track injected DOM nodes for clean shutdown
  const injectedElements = new Map();
  let windowListener = null;

  Zotero.MindFlow = {
    rootURI: typeof rootURI !== 'undefined' ? rootURI : '',
    addonId: ADDON_ID,

    init() {
      this.initWindowListener();
      // Inject into any existing windows
      const windows = Services.wm.getEnumerator('navigator:browser');
      while (windows.hasMoreElements()) {
        const win = windows.getNext();
        this.addToWindow(win);
      }

      // Register Zotero 7 Preference Pane
      if (Zotero.PreferencePanes && typeof Zotero.PreferencePanes.register === 'function') {
        try {
          const prefSrc = this.rootURI
            ? `${this.rootURI}chrome/content/preferences.xhtml`
            : `${CHROME_ROOT}preferences.xhtml`;
          const prefScript = this.rootURI
            ? `${this.rootURI}chrome/content/scripts/preferences.js`
            : `${CHROME_ROOT}scripts/preferences.js`;
          const prefCss = this.rootURI
            ? `${this.rootURI}chrome/content/assets/preferences.css`
            : `${CHROME_ROOT}assets/preferences.css`;
          const prefIcon = this.rootURI
            ? `${this.rootURI}chrome/content/icons/mindflow.svg`
            : `${CHROME_ROOT}icons/mindflow.svg`;

          Zotero.PreferencePanes.register({
            pluginID: ADDON_ID,
            src: prefSrc,
            label: 'MindFlow',
            image: prefIcon,
            scripts: [prefScript],
            stylesheets: [prefCss],
          });
        } catch (prefErr) {
          Zotero.log?.('[MindFlow] PreferencePanes registration note: ' + prefErr);
        }
      }

      Zotero.log('[MindFlow] Initialized successfully in Zotero 7');
    },

    initWindowListener() {
      windowListener = {
        onOpenWindow: (xulWindow) => {
          const domWindow = xulWindow
            .QueryInterface(Ci.nsIInterfaceRequestor)
            .getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
          domWindow.addEventListener(
            'load',
            () => {
              Zotero.MindFlow.addToWindow(domWindow);
            },
            { once: true }
          );
        },
        onCloseWindow: () => {},
        onWindowTitleChange: () => {},
      };
      Services.wm.addListener(windowListener);
    },

    addToWindow(window) {
      if (!window || !window.document) return;
      const doc = window.document;

      // Prevent duplicate injection
      if (doc.getElementById('mindflow-tools-menu')) return;

      const windowElements = [];

      // 1. Add to "Tools" (工具) Menu
      const toolsPopup = doc.getElementById('menu_ToolsPopup');
      if (toolsPopup) {
        const toolsItem = doc.createXULElement
          ? doc.createXULElement('menuitem')
          : doc.createElement('menuitem');
        toolsItem.id = 'mindflow-tools-menu';
        toolsItem.setAttribute('label', 'MindFlow 思维导图');
        toolsItem.setAttribute('image', `${CHROME_ROOT}icons/mindflow.svg`);
        toolsItem.setAttribute('class', 'menuitem-iconic');
        toolsItem.addEventListener('command', () => {
          this.openMindFlow({ mode: 'open' }, window);
        });
        toolsPopup.appendChild(toolsItem);
        windowElements.push(toolsItem);
      }

      // 2. Add to Item Context Menu (文献列表右键菜单)
      const itemMenu = doc.getElementById('zotero-itemmenu');
      if (itemMenu) {
        const separator = doc.createXULElement
          ? doc.createXULElement('menuseparator')
          : doc.createElement('menuseparator');
        separator.id = 'mindflow-itemmenu-separator';
        itemMenu.appendChild(separator);
        windowElements.push(separator);

        const createFromItem = doc.createXULElement
          ? doc.createXULElement('menuitem')
          : doc.createElement('menuitem');
        createFromItem.id = 'mindflow-itemmenu-create';
        createFromItem.setAttribute('label', '在 MindFlow 中生成文献导图');
        createFromItem.setAttribute('image', `${CHROME_ROOT}icons/mindflow.svg`);
        createFromItem.setAttribute('class', 'menuitem-iconic');

        // Dynamic popup feedback: show selected items count & auto disable when empty
        const updateItemMenuState = () => {
          try {
            const selectedItems = window.ZoteroPane ? window.ZoteroPane.getSelectedItems() : [];
            if (!selectedItems || selectedItems.length === 0) {
              createFromItem.setAttribute('disabled', 'true');
              createFromItem.setAttribute('label', '在 MindFlow 中生成文献导图 (未选中文献)');
            } else {
              createFromItem.removeAttribute('disabled');
              const first = selectedItems[0];
              const isAttachment = first && typeof first.isAttachment === 'function' && first.isAttachment();
              const fname = (isAttachment && first.attachmentFilename) || '';
              const title = (first.getField ? first.getField('title') : first.title) || '';

              if (selectedItems.length === 1 && isAttachment && (fname.endsWith('.mindflow') || title.includes('.mindflow'))) {
                createFromItem.setAttribute('label', '在 MindFlow 中打开此思维导图');
              } else if (selectedItems.length === 1) {
                const rawTitle = title || '文献';
                const shortTitle = rawTitle.length > 20 ? rawTitle.slice(0, 20) + '...' : rawTitle;
                createFromItem.setAttribute('label', `在 MindFlow 中生成导图: "${shortTitle}"`);
              } else {
                createFromItem.setAttribute('label', `在 MindFlow 中生成文献导图 (${selectedItems.length} 篇)`);
              }
            }
          } catch (e) {
            // fallback
          }
        };

        itemMenu.addEventListener('popupshowing', updateItemMenuState);
        windowElements.push({
          remove: () => itemMenu.removeEventListener('popupshowing', updateItemMenuState),
        });

        createFromItem.addEventListener('command', async () => {
          const selectedItems = window.ZoteroPane ? window.ZoteroPane.getSelectedItems() : [];
          if (!selectedItems || selectedItems.length === 0) return;

          const first = selectedItems[0];
          const isAttachment = first && typeof first.isAttachment === 'function' && first.isAttachment();
          const fname = (isAttachment && first.attachmentFilename) || '';
          const title = (first.getField ? first.getField('title') : first.title) || '';

          // If clicking on a .mindflow attachment, open it directly!
          if (selectedItems.length === 1 && isAttachment && (fname.endsWith('.mindflow') || title.includes('.mindflow'))) {
            try {
              const filePath = await first.getFilePathAsync?.();
              if (filePath) {
                const content = await IOUtils.readUTF8(filePath);
                const docData = JSON.parse(content);
                this.openMindFlow(
                  {
                    mode: 'open_document',
                    doc: docData,
                    openedAttachmentKey: first.key,
                  },
                  window
                );
                return;
              }
            } catch (err) {
              Zotero.logError?.('[MindFlow] Failed to load .mindflow attachment: ' + err);
            }
          }

          this.openMindFlow({ mode: 'create_from_selection', items: selectedItems }, window);
        });
        itemMenu.appendChild(createFromItem);
        windowElements.push(createFromItem);
      }

      // 3. Add to Collection Context Menu (分类列表右键菜单)
      const collectionMenu = doc.getElementById('zotero-collectionmenu');
      if (collectionMenu) {
        const colItem = doc.createXULElement
          ? doc.createXULElement('menuitem')
          : doc.createElement('menuitem');
        colItem.id = 'mindflow-collectionmenu-create';
        colItem.setAttribute('label', '生成分类思维导图');
        colItem.setAttribute('image', `${CHROME_ROOT}icons/mindflow.svg`);
        colItem.setAttribute('class', 'menuitem-iconic');

        const updateCollectionMenuState = () => {
          try {
            const collection = window.ZoteroPane ? window.ZoteroPane.getSelectedCollection() : null;
            if (!collection) {
              colItem.setAttribute('disabled', 'true');
              colItem.setAttribute('label', '生成分类思维导图');
            } else {
              colItem.removeAttribute('disabled');
              colItem.setAttribute('label', `生成【${collection.name}】思维导图`);
            }
          } catch (e) {
            // fallback
          }
        };

        collectionMenu.addEventListener('popupshowing', updateCollectionMenuState);
        windowElements.push({
          remove: () => collectionMenu.removeEventListener('popupshowing', updateCollectionMenuState),
        });

        colItem.addEventListener('command', () => {
          const collection = window.ZoteroPane ? window.ZoteroPane.getSelectedCollection() : null;
          if (collection) {
            const items = typeof collection.getChildItems === 'function' ? collection.getChildItems() : [];
            this.openMindFlow(
              {
                mode: 'create_from_collection',
                collectionName: collection.name,
                items: items,
              },
              window
            );
          }
        });
        collectionMenu.appendChild(colItem);
        windowElements.push(colItem);
      }

      // 4. Inject Tab icon styling for native Zotero Tab Bar
      try {
        if (!doc.getElementById('mindflow-tab-style')) {
          const style = doc.createElement('style');
          style.id = 'mindflow-tab-style';
          style.textContent = `
            tab[type="mindflow"] .tab-icon,
            .tab[type="mindflow"] .tab-icon {
              list-style-image: url("${CHROME_ROOT}icons/mindflow.svg") !important;
              width: 16px !important;
              height: 16px !important;
            }
          `;
          (doc.head || doc.documentElement).appendChild(style);
          windowElements.push(style);
        }
      } catch (e) {
        // ignore
      }

      // 5. Global Keyboard Shortcut (Ctrl+Alt+M or Cmd+Alt+M)
      const handleGlobalKeyDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 'm' || e.key === 'M')) {
          e.preventDefault?.();
          e.stopPropagation?.();
          this.openMindFlow({ mode: 'open' }, window);
        }
      };
      window.addEventListener('keydown', handleGlobalKeyDown, true);
      windowElements.push({
        remove: () => window.removeEventListener('keydown', handleGlobalKeyDown, true),
      });

      // 6. Host-level listener for MindFlow iframe commands (locate item, open PDF, sync tab title)
      const handleHostMessage = (event) => {
        try {
          const data = event.data;
          if (!data || typeof data !== 'object') return;

          // A. Locate and highlight item in Library
          if (data.type === 'MINDFLOW_LOCATE_ITEM' && data.key) {
            const tabs = window.Zotero_Tabs;
            if (tabs && Array.isArray(tabs._tabs)) {
              const libTab = tabs._tabs.find((t) => t && (t.type === 'library' || t.id === 'zotero-pane'));
              if (libTab) tabs.select(libTab.id);
            }
            const userLibId = Zotero.Libraries?.userLibraryID || 1;
            let item = null;
            if (/^\d+$/.test(data.key)) {
              item = Zotero.Items.get(Number(data.key));
            } else if (Zotero.Items.getByLibraryAndKey) {
              item = Zotero.Items.getByLibraryAndKey(userLibId, data.key);
            }
            if (item && window.ZoteroPane) {
              window.ZoteroPane.selectItem(item.id);
            }
          }

          // B. Open PDF Reader in Zotero
          if (data.type === 'MINDFLOW_OPEN_PDF' && data.key) {
            const userLibId = Zotero.Libraries?.userLibraryID || 1;
            let item = null;
            if (/^\d+$/.test(data.key)) {
              item = Zotero.Items.get(Number(data.key));
            } else if (Zotero.Items.getByLibraryAndKey) {
              item = Zotero.Items.getByLibraryAndKey(userLibId, data.key);
            }
            if (item) {
              let pdfAtt = null;
              if (item.isAttachment && item.isAttachment() && item.isPDFAttachment && item.isPDFAttachment()) {
                pdfAtt = item;
              } else if (typeof item.getBestAttachment === 'function') {
                pdfAtt = item.getBestAttachment();
              } else if (typeof item.getAttachments === 'function') {
                const attIds = item.getAttachments();
                for (const attId of attIds) {
                  const att = Zotero.Items.get(attId);
                  if (att && att.isPDFAttachment && att.isPDFAttachment()) {
                    pdfAtt = att;
                    break;
                  }
                }
              }
              if (pdfAtt && Zotero.Reader && typeof Zotero.Reader.open === 'function') {
                Zotero.Reader.open({ itemID: pdfAtt.id });
              }
            }
          }

          // C. Synchronize Tab Title with Mind Map document title
          if (data.type === 'MINDFLOW_SET_TAB_TITLE' && data.title) {
            const tabs = window.Zotero_Tabs;
            if (tabs && Array.isArray(tabs._tabs)) {
              const currentTab = tabs._tabs.find((t) => t && t.type === 'mindflow');
              if (currentTab) {
                if (typeof tabs.rename === 'function') {
                  tabs.rename(currentTab.id, data.title);
                } else if (currentTab.tab) {
                  currentTab.tab.setAttribute('label', data.title);
                }
              }
            }
          }

          // D. Update Zotero preference from MindFlow UI
          if (data.type === 'MINDFLOW_SET_PREF' && data.key) {
            if (Zotero.Prefs) {
              Zotero.Prefs.set('extensions.mindflow.' + data.key, data.value, true);
              Zotero.log?.(`[MindFlow] Preference extensions.mindflow.${data.key} updated to: ${data.value}`);
            }
          }

          // E. Request opening in a standalone window or switching mode
          if (data.type === 'MINDFLOW_SET_WINDOW_MODE' && data.targetMode) {
            if (Zotero.Prefs) {
              Zotero.Prefs.set('extensions.mindflow.windowMode', data.targetMode, true);
            }
            if (data.targetMode === 'window') {
              this.openStandaloneWindow({ mode: 'open' }, window);
            }
          }

          // F. Request opening Zotero Native Preferences Page (Plugin Settings Area)
          if (data.type === 'MINDFLOW_OPEN_PREFERENCES') {
            this.openPreferencesPane(window);
          }

          // G. Request saving MindMapDocument directly to Zotero Item Attachment & Note
          if (data.type === 'MINDFLOW_SAVE_ATTACHMENT' && data.doc) {
            this.saveMindMapToItem(data, window);
          }
        } catch (e) {
          Zotero.log?.('[MindFlow] Message processing note: ' + e);
        }
      };
      window.addEventListener('message', handleHostMessage);
      windowElements.push({
        remove: () => window.removeEventListener('message', handleHostMessage),
      });

      // 7. Add to Main Items Toolbar (功能启动 Icon)
      this.injectToolbarButton(window, windowElements, 0);

      injectedElements.set(window, windowElements);
    },

    injectToolbarButton(window, windowElements, retryCount = 0) {
      if (!window || !window.document) return;
      const doc = window.document;

      if (doc.getElementById('mindflow-toolbar-button')) {
        return;
      }

      // Look for the action buttons in Zotero's main items toolbar
      // Screenshot shows: [New Item] [Lookup] [New Note] [Attachment] -> [MindFlow Icon HERE]
      const anchor =
        doc.getElementById('zotero-tb-attachment') ||
        doc.getElementById('zotero-tb-note') ||
        doc.getElementById('zotero-tb-lookup') ||
        doc.getElementById('zotero-tb-add') ||
        doc.querySelector('#zotero-item-toolbar toolbarbutton:last-of-type') ||
        doc.querySelector('#zotero-items-toolbar toolbarbutton:last-of-type') ||
        doc.querySelector('.zotero-toolbar toolbarbutton:last-of-type');

      const toolbar =
        (anchor && anchor.parentNode) ||
        doc.getElementById('zotero-item-toolbar') ||
        doc.getElementById('zotero-items-toolbar') ||
        doc.getElementById('zotero-tb') ||
        doc.getElementById('zotero-toolbar') ||
        doc.querySelector('.zotero-items-toolbar') ||
        doc.querySelector('#zotero-items-pane toolbar') ||
        doc.querySelector('toolbar');

      if (!toolbar) {
        if (retryCount < 10) {
          window.setTimeout(() => {
            this.injectToolbarButton(window, windowElements, retryCount + 1);
          }, 300);
        }
        return;
      }

      const btn = doc.createXULElement
        ? doc.createXULElement('toolbarbutton')
        : doc.createElement('toolbarbutton');

      btn.id = 'mindflow-toolbar-button';
      btn.setAttribute('label', 'MindFlow');
      btn.setAttribute('tooltiptext', '打开 MindFlow 思维导图与文献研读工作区');
      btn.setAttribute('image', `${CHROME_ROOT}icons/mindflow.svg`);
      btn.setAttribute('class', 'zotero-tb-button toolbarbutton-1 chromeclass-toolbar-additional');
      btn.setAttribute(
        'style',
        'cursor: pointer; margin: 0 3px; display: inline-flex; align-items: center; justify-content: center;'
      );

      const trigger = (e) => {
        if (e) {
          e.preventDefault?.();
          e.stopPropagation?.();
        }
        this.openMindFlow({ mode: 'open' }, window);
      };

      btn.addEventListener('command', trigger);
      btn.addEventListener('click', trigger);

      if (anchor && anchor.parentNode === toolbar) {
        anchor.parentNode.insertBefore(btn, anchor.nextSibling);
      } else {
        const searchBox =
          doc.getElementById('zotero-tb-search-textbox') ||
          toolbar.querySelector('input') ||
          toolbar.querySelector('.zotero-search-box') ||
          toolbar.querySelector('#zotero-search-box');
        if (searchBox && searchBox.parentNode === toolbar) {
          toolbar.insertBefore(btn, searchBox);
        } else {
          toolbar.appendChild(btn);
        }
      }

      windowElements.push(btn);
    },

    removeFromWindow(window) {
      if (!window) return;
      const elements = injectedElements.get(window);
      if (elements) {
        for (const el of elements) {
          try {
            el.remove();
          } catch (e) {
            // ignore
          }
        }
        injectedElements.delete(window);
      }
    },

    openMindFlow(options = {}, targetWindow = null) {
      try {
        const win =
          targetWindow ||
          (typeof window !== 'undefined' ? window : null) ||
          (Zotero.getMainWindow ? Zotero.getMainWindow() : null);

        // Check user preference for window mode: 'tab' (default) vs. 'window'
        let preferredWindowMode = 'tab';
        try {
          if (Zotero.Prefs) {
            preferredWindowMode = Zotero.Prefs.get('extensions.mindflow.windowMode', true) || 'tab';
          }
        } catch (e) {
          preferredWindowMode = 'tab';
        }

        const effectiveMode = options.targetMode || preferredWindowMode;

        if (effectiveMode === 'window') {
          this.openStandaloneWindow(options, win);
          return;
        }

        const tabs =
          win?.Zotero_Tabs ||
          (typeof Zotero_Tabs !== 'undefined' ? Zotero_Tabs : null) ||
          (Zotero.getMainWindow && Zotero.getMainWindow().Zotero_Tabs);

        if (tabs && typeof tabs.add === 'function') {
          // 1. Check if MindFlow tab is already open in this window
          if (Array.isArray(tabs._tabs)) {
            const existingTab = tabs._tabs.find((t) => t && t.type === 'mindflow');
            if (existingTab) {
              tabs.select(existingTab.id);
              if (win && win.focus) win.focus();

              // If items or document were passed, forward them
              if (options.mode === 'open_document' && options.doc) {
                try {
                  const iframe =
                    win.document.getElementById('mindflow-tab-iframe') ||
                    (existingTab.container && existingTab.container.querySelector('iframe'));
                  if (iframe && iframe.contentWindow) {
                    iframe.contentWindow.postMessage(
                      {
                        type: 'MINDFLOW_LOAD_DOCUMENT',
                        doc: options.doc,
                        openedAttachmentKey: options.openedAttachmentKey,
                      },
                      '*'
                    );
                  }
                } catch (e) {
                  // ignore
                }
              } else if (
                (options.mode === 'create_from_selection' || options.mode === 'create_from_collection') &&
                Array.isArray(options.items)
              ) {
                try {
                  const iframe =
                    win.document.getElementById('mindflow-tab-iframe') ||
                    (existingTab.container && existingTab.container.querySelector('iframe'));
                  if (iframe && iframe.contentWindow) {
                    iframe.contentWindow.postMessage(
                      {
                        type: options.mode === 'create_from_collection'
                          ? 'MINDFLOW_IMPORT_ZOTERO_COLLECTION'
                          : 'MINDFLOW_IMPORT_ZOTERO_ITEMS',
                        items: options.items,
                        collectionName: options.collectionName,
                        mode: options.mode,
                      },
                      '*'
                    );
                  }
                } catch (e) {
                  // ignore
                }
              }
              return;
            }
          }

          // 2. Open as a new internal Tab in Zotero
          const tabResult = tabs.add({
            type: 'mindflow',
            title: options.collectionName
              ? `MindFlow - ${options.collectionName}`
              : 'MindFlow 思维导图',
            select: true,
            data: options,
            onClose: () => {
              Zotero.log?.('[MindFlow] Workspace tab closed');
            },
          });

          const container =
            (tabResult && tabResult.container) ||
            (tabResult && tabs.getTabContainer && tabs.getTabContainer(tabResult.id || tabResult)) ||
            (tabs.getTab && tabs.getTab(tabResult?.id)?.container);

          if (container) {
            const doc = container.ownerDocument || win.document;
            const iframe = doc.createElement('iframe');
            iframe.id = 'mindflow-tab-iframe';
            iframe.setAttribute('src', `${CHROME_ROOT}index.html`);
            iframe.setAttribute(
              'style',
              'width: 100%; height: 100%; border: none; flex: 1; display: block;'
            );
            iframe.setAttribute('flex', '1');

            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.overflow = 'hidden';

            iframe.addEventListener('load', () => {
              try {
                if (iframe.contentWindow) {
                  iframe.contentWindow.Zotero = Zotero;
                  iframe.contentWindow.arguments = [
                    {
                      Zotero,
                      mode: options.mode || 'open',
                      doc: options.doc || null,
                      openedAttachmentKey: options.openedAttachmentKey || null,
                      items: options.items || [],
                      collectionName: options.collectionName || null,
                      collection: options.collection || null,
                      windowMode: 'tab',
                    },
                  ];
                }
              } catch (e) {
                Zotero.log?.('[MindFlow] Note on tab iframe load: ' + e);
              }
            });

            container.appendChild(iframe);
          }

          if (win && win.focus) {
            win.focus();
          }
          return;
        }
      } catch (tabErr) {
        Zotero.log?.('[MindFlow] Tab opening note, falling back to window: ' + tabErr);
      }

      // Fallback: If Zotero_Tabs is not accessible, use standalone window
      this.openStandaloneWindow(options, targetWindow);
    },

    openStandaloneWindow(options = {}, targetWindow = null) {
      try {
        const ww = Services.ww;
        // dialog=no,all,resizable=yes,minimizable=yes ensures standard OS window controls (minimize, maximize/restore, close) on Windows
        const features =
          'chrome,dialog=no,all,centerscreen,resizable=yes,minimizable=yes,close=yes,titlebar=yes,width=1440,height=920';
        const url = `${CHROME_ROOT}index.html`;

        const params = {
          Zotero,
          mode: options.mode || 'open',
          doc: options.doc || null,
          openedAttachmentKey: options.openedAttachmentKey || null,
          items: options.items || [],
          collection: options.collection || null,
          collectionName: options.collectionName || null,
          windowMode: 'window',
        };

        const win = ww.openWindow(null, url, 'mindflow-window', features, params);
        if (win) {
          try {
            win.addEventListener('load', () => {
              if (win.document) {
                win.document.title = 'MindFlow 思维导图与学术研读工作区';
              }
            }, { once: true });
          } catch (_) {}
          if (win.focus) {
            win.focus();
          }
        }
      } catch (err) {
        Zotero.logError?.('[MindFlow] Failed to open standalone window: ' + err);
      }
    },

    async saveMindMapToItem(data = {}, targetWindow = null) {
      try {
        const win =
          targetWindow ||
          (typeof window !== 'undefined' ? window : null) ||
          (Zotero.getMainWindow ? Zotero.getMainWindow() : null);

        const doc = data.doc;
        if (!doc) return { success: false, message: '导图数据为空' };

        const safeTitle = (doc.title || '思维导图').replace(/[\\/:*?"<>|]/g, '_').trim();
        const userLibId = Zotero.Libraries?.userLibraryID || 1;
        let parentItem = null;

        // 1. Try to find parent item by key
        if (data.parentItemKey) {
          const key = String(data.parentItemKey).replace(/^.*\/items\//, '').trim();
          if (/^\d+$/.test(key)) {
            parentItem = Zotero.Items.get(Number(key));
          } else if (Zotero.Items.getByLibraryAndKey) {
            parentItem = Zotero.Items.getByLibraryAndKey(userLibId, key);
          }
        }

        // 2. Try to find parent item from currently selected items in Zotero library pane
        if (!parentItem && win?.ZoteroPane) {
          const selected = win.ZoteroPane.getSelectedItems();
          if (Array.isArray(selected) && selected.length > 0) {
            const firstRegular = selected.find((item) => (typeof item.isRegularItem === 'function' ? item.isRegularItem() : true));
            parentItem = firstRegular || selected[0];
          }
        }

        // 3. Try to locate item referenced in the root node link (e.g. zotero://select/items/...)
        if (!parentItem && doc.root?.link) {
          const match = doc.root.link.match(/zotero:\/\/select\/items\/([a-zA-Z0-9_]+)/);
          if (match && match[1]) {
            const key = match[1];
            if (/^\d+$/.test(key)) {
              parentItem = Zotero.Items.get(Number(key));
            } else if (Zotero.Items.getByLibraryAndKey) {
              parentItem = Zotero.Items.getByLibraryAndKey(userLibId, key);
            }
          }
        }

        let savedAttachment = false;
        let savedPath = '';

        // Save to Custom Local Path if configured
        let customSavePath = '';
        try {
          if (Zotero.Prefs) {
            customSavePath = Zotero.Prefs.get('extensions.mindflow.customSavePath', true) || '';
          }
        } catch (_) {}

        if (customSavePath && typeof customSavePath === 'string') {
          customSavePath = customSavePath.trim();
          if (customSavePath) {
            try {
              const localFilePath = PathUtils.join(customSavePath, `${safeTitle}.mindflow`);
              await IOUtils.writeUTF8(localFilePath, JSON.stringify(doc, null, 2));
              savedPath = localFilePath;
              Zotero.log?.(`[MindFlow] Successfully saved copy to custom path: ${localFilePath}`);
            } catch (err) {
              Zotero.logError?.(`[MindFlow] Failed to write to customSavePath: ${err}`);
            }
          }
        }

        // If parent item found, attach to it!
        if (parentItem) {
          const tempPath = PathUtils.join(PathUtils.tempDir, `${safeTitle}.mindflow`);
          await IOUtils.writeUTF8(tempPath, JSON.stringify(doc, null, 2));

          // Check if an existing mindflow attachment already exists under parentItem
          let existingAtt = null;
          if (typeof parentItem.getAttachments === 'function') {
            const attIds = parentItem.getAttachments();
            for (const attId of attIds) {
              const att = Zotero.Items.get(attId);
              if (att && att.isAttachment && att.isAttachment()) {
                const fname = att.attachmentFilename || '';
                const attTitle = (typeof att.getField === 'function' ? att.getField('title') : att.title) || '';
                if (fname.endsWith('.mindflow') || attTitle.includes('.mindflow') || attTitle.includes('MindFlow')) {
                  existingAtt = att;
                  break;
                }
              }
            }
          }

          if (existingAtt) {
            try {
              const currentPath = await existingAtt.getFilePathAsync?.();
              if (currentPath) {
                await IOUtils.writeUTF8(currentPath, JSON.stringify(doc, null, 2));
                savedAttachment = true;
              } else if (typeof existingAtt.relinkAttachmentFile === 'function') {
                await existingAtt.relinkAttachmentFile(tempPath);
                savedAttachment = true;
              }
            } catch (updateErr) {
              Zotero.log?.('[MindFlow] Existing attachment update note, creating new: ' + updateErr);
            }
          }

          if (!savedAttachment) {
            await Zotero.Attachments.importFromFile({
              file: tempPath,
              parentItemID: parentItem.id,
              title: `${safeTitle}.mindflow (MindFlow 导图源文件)`,
              contentType: 'application/json',
            });
            savedAttachment = true;
          }

          // Clean up temp file
          try {
            await IOUtils.remove(tempPath);
          } catch (_) {}

          // Also create/update child outline note if requested or autoArchiveToItem
          let shouldCreateNote = true;
          try {
            if (Zotero.Prefs) {
              shouldCreateNote = Zotero.Prefs.get('extensions.mindflow.autoArchiveToItem', true) !== false;
            }
          } catch (_) {}

          if (shouldCreateNote) {
            try {
              const noteHtml = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                  <h3 style="color: #0284c7;">🧠 MindFlow 导图大纲: ${safeTitle}</h3>
                  <p style="color: #64748b; font-size: 11px;">最后归档: ${new Date().toLocaleString()}</p>
                  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 8px 0;" />
                  <ul>
                    ${this.renderNodeToHtml(doc.root)}
                  </ul>
                  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 8px 0;" />
                  <p style="font-size: 11px; color: #94a3b8;">已同步挂载 .mindflow 源文件附件，支持 Zotero 云同步与多端漫游</p>
                </div>
              `.trim();

              const noteItem = new Zotero.Item('note');
              noteItem.parentItemID = parentItem.id;
              noteItem.setNote(noteHtml);
              await noteItem.saveTx();
            } catch (noteErr) {
              Zotero.logError?.('[MindFlow] Failed to create child note: ' + noteErr);
            }
          }

          const itemTitle = (typeof parentItem.getField === 'function' ? parentItem.getField('title') : parentItem.title) || '文献条目';
          const successMsg = `已成功将思维导图归档至文献【${itemTitle.length > 25 ? itemTitle.slice(0, 25) + '...' : itemTitle}】！\n- 子附件：${safeTitle}.mindflow（支持多端云同步）\n- 子笔记：导图结构化大纲${savedPath ? `\n- 本地备份：${savedPath}` : ''}`;

          if (win?.alert) {
            win.alert(successMsg);
          }
          return { success: true, message: successMsg, parentItemTitle: itemTitle, savedPath };
        } else {
          // If no parent item found
          let msg = '';
          if (savedPath) {
            msg = `已成功将导图源文件保存至您配置的本地物理路径：\n${savedPath}\n\n（提示：在 Zotero 文献库中选中某篇论文后再保存，即可直接将导图作为该文献的子附件挂载！）`;
          } else {
            msg = `未在 Zotero 中选中具体文献条目，且未设置本地备份目录。\n\n请在 Zotero 文献列表中先选中目标文献，或在首选项中设置本地保存文件夹！`;
          }
          if (win?.alert) {
            win.alert(msg);
          }
          return { success: Boolean(savedPath), message: msg, savedPath };
        }
      } catch (err) {
        Zotero.logError?.('[MindFlow] saveMindMapToItem error: ' + err);
        return { success: false, message: '保存失败: ' + err };
      }
    },

    renderNodeToHtml(node, level = 1) {
      if (!node) return '';
      const indent = '  '.repeat(level);
      const escape = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      let html = `${indent}<li><strong>${escape(node.text)}</strong>`;
      if (node.note) {
        html += `<br/><small style="color: #64748b;">${escape(node.note)}</small>`;
      }
      if (Array.isArray(node.children) && node.children.length > 0) {
        html += `\n${indent}<ul>\n`;
        for (const child of node.children) {
          html += this.renderNodeToHtml(child, level + 1);
        }
        html += `${indent}</ul>\n${indent}`;
      }
      html += `</li>\n`;
      return html;
    },

    openPreferencesPane(targetWindow) {
      try {
        const win =
          targetWindow ||
          (typeof window !== 'undefined' ? window : null) ||
          (Zotero.getMainWindow ? Zotero.getMainWindow() : null);

        // 1. Zotero.openPreferences API (Zotero 7+)
        if (typeof Zotero.openPreferences === 'function') {
          Zotero.openPreferences('mindflow@groele.org');
          return;
        }

        // 2. Open preferences.xhtml dialog with pane selection
        if (win && typeof win.openDialog === 'function') {
          win.openDialog(
            'chrome://zotero/content/preferences/preferences.xhtml',
            'preferences',
            'chrome,titlebar,toolbar,centerscreen,resizable=yes',
            { pane: 'mindflow@groele.org' }
          );
          return;
        }

        // 3. Fallback via command dispatcher
        if (win && typeof win.goDoCommand === 'function') {
          win.goDoCommand('cmd_preferences');
        }
      } catch (e) {
        Zotero.logError?.('[MindFlow] Error opening preferences pane: ' + e);
      }
    },

    shutdown() {
      if (windowListener) {
        Services.wm.removeListener(windowListener);
        windowListener = null;
      }
      for (const [win] of injectedElements) {
        this.removeFromWindow(win);
      }
      injectedElements.clear();
      delete Zotero.MindFlow;
      Zotero.log('[MindFlow] Shutdown and cleaned up successfully');
    },
  };

  // Launch initial registration
  Zotero.MindFlow.init();
})();
