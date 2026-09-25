/**
 * MindFlow for Zotero - Runtime Script
 * Injects UI elements into Zotero 10 (Tools menu, context menus, toolbar)
 * and bridges communication with the MindFlow Mind Map workspace.
 */

(function () {
  if (typeof Zotero === 'undefined') {
    return;
  }

  const ADDON_ID = 'mindflow@groele.org';
  const CHROME_ROOT = 'chrome://mindflow/content/';
  const ALLOWED_PREF_MESSAGES = {
    windowMode: (value) => value === 'tab' || value === 'window',
    includeAbstract: (value) => typeof value === 'boolean',
    includeAnnotations: (value) => typeof value === 'boolean',
    includeTags: (value) => typeof value === 'boolean',
  };

  const isMindFlowAttachment = (item) => {
    if (!item || typeof item.isAttachment !== 'function' || !item.isAttachment()) return false;
    const filename = String(item.attachmentFilename || '');
    const title = String((item.getField ? item.getField('title') : item.title) || '');
    return /\.mindflow$/i.test(filename) || /\.mindflow(?:\s|$)/i.test(title);
  };
  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const itemSelectUri = (item) => {
    const key = item.key || item.id;
    const groupID = Zotero.Libraries?.get?.(item.libraryID)?.groupID;
    return groupID
      ? `zotero://select/groups/${groupID}/items/${key}`
      : `zotero://select/library/items/${key}`;
  };
  const noteHtmlToText = (html) => {
    try {
      const parsed = new DOMParser().parseFromString(html, 'text/html');
      parsed.querySelectorAll('br').forEach((node) => node.replaceWith('\n'));
      parsed.querySelectorAll('p, div, li').forEach((node) => node.append('\n'));
      return (parsed.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
    } catch (_) {
      return String(html).replace(/<[^>]+>/g, ' ').trim();
    }
  };
  const annotationLink = (attachment, annotation) => {
    if (!annotation?.key || !attachment?.key) return null;
    const groupID = Zotero.Libraries?.get?.(attachment.libraryID)?.groupID;
    const base = groupID
      ? `zotero://open-pdf/groups/${groupID}/items/${attachment.key}`
      : `zotero://open-pdf/library/items/${attachment.key}`;
    let page = null;
    try {
      const index = JSON.parse(annotation.annotationPosition || '{}').pageIndex;
      if (Number.isSafeInteger(index) && index >= 0) page = index + 1;
    } catch (_) {}
    return `${base}?${page ? `page=${page}&` : ''}annotation=${encodeURIComponent(annotation.key)}`;
  };
  const regularLiteratureItems = (items) => {
    const result = [];
    const seen = new Set();
    for (const item of Array.isArray(items) ? items : []) {
      const parent = item?.parentItemID ? Zotero.Items.get(item.parentItemID) : item;
      if (!parent?.isRegularItem?.() || seen.has(parent.id)) continue;
      seen.add(parent.id);
      result.push(parent);
    }
    return result;
  };
  const showMindFlowNotice = (headline, description) => {
    try {
      const progress = new Zotero.ProgressWindow({ closeOnClick: true });
      progress.changeHeadline(headline);
      progress.addDescription(description);
      progress.show();
      progress.startCloseTimer(6000);
    } catch (error) {
      Zotero.log?.(`[MindFlow] ${headline}: ${description} (${error})`);
    }
  };
  const resolveItemReference = (reference, libraryID) => {
    if (reference == null) return null;
    const raw = String(reference).trim();
    const groupMatch = raw.match(/^zotero:\/\/(?:select|open-pdf)\/groups\/(\d+)\/items\/([A-Za-z0-9_]+)/);
    const key = groupMatch?.[2] || raw.match(/\/items\/([A-Za-z0-9_]+)(?:[?#]|$)/)?.[1] || raw;
    if (!/^[A-Za-z0-9_]+$/.test(key)) return null;
    if (!raw.includes('/items/') && /^\d+$/.test(key)) return Zotero.Items.get(Number(key));
    let targetLibraryID = Number.isInteger(Number(libraryID)) && Number(libraryID) > 0
      ? Number(libraryID) : Zotero.Libraries?.userLibraryID || 1;
    if (groupMatch) {
      targetLibraryID = Zotero.Groups?.getLibraryIDFromGroupID?.(Number(groupMatch[1]));
      if (!targetLibraryID) return null;
    }
    return Zotero.Items.getByLibraryAndKey?.(targetLibraryID, key) || null;
  };

  // Track injected DOM nodes for clean shutdown
  const injectedElements = new Map();
  const pendingWindowLoads = new Map();
  let windowListener = null;

  Zotero.MindFlow = {
    rootURI: typeof rootURI !== 'undefined' ? rootURI : '',
    addonId: ADDON_ID,
    localizedDocs: new Set(),

    ensureLocalization(doc) {
      if (!doc || this.localizedDocs.has(doc)) return;
      const existing = doc.querySelector('link[rel="localization"][href="mindflow.ftl"]');
      if (existing) return;
      try {
        doc.defaultView?.MozXULElement?.insertFTLIfNeeded('mindflow.ftl');
        if (doc.querySelector('link[rel="localization"][href="mindflow.ftl"]')) {
          this.localizedDocs.add(doc);
        }
      } catch (error) {
        Zotero.logError?.('[MindFlow] Could not load item-pane translations: ' + error);
      }
    },

    removeLocalization(doc) {
      if (!this.localizedDocs.has(doc)) return;
      try {
        doc.querySelector('link[rel="localization"][href="mindflow.ftl"]')?.remove();
      } catch (_) {}
      this.localizedDocs.delete(doc);
    },

    init() {
      this.initWindowListener();
      // Inject into any existing windows
      const windows = Services.wm.getEnumerator('navigator:browser');
      while (windows.hasMoreElements()) {
        const win = windows.getNext();
        this.addToWindow(win);
      }

      // Register Zotero 10 Preference Pane
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

      // Use Zotero's item-pane extension API so the maps belonging to the
      // selected paper are visible alongside its native notes and attachments.
      this.registerItemPaneSection();

      Zotero.log('[MindFlow] Initialized successfully in Zotero');
    },

    registerItemPaneSection() {
      if (typeof Zotero.ItemPaneManager?.registerSection !== 'function') return;
      try {
        const sectionStates = new WeakMap();
        const icon = `${CHROME_ROOT}icons/mindflow.svg`;
        this.itemPaneSectionID = Zotero.ItemPaneManager.registerSection({
          paneID: 'mindflow-item-pane',
          pluginID: ADDON_ID,
          header: { l10nID: 'mindflow-item-pane-header', icon },
          sidenav: { l10nID: 'mindflow-item-pane-header', icon },
          onInit: ({ doc, body, item, refresh }) => {
            this.ensureLocalization(doc);
            const state = { itemID: regularLiteratureItems([item])[0]?.id || null, refresh, notifierID: null };
            if (Zotero.Notifier?.registerObserver) {
              try {
                state.notifierID = Zotero.Notifier.registerObserver({
                  notify: (event, type, ids) => {
                    if (type !== 'item' || !state.itemID || !Array.isArray(ids)) return;
                    const affectsItem = ids.some((id) => {
                      if (Number(id) === state.itemID) return true;
                      const changed = Zotero.Items.get(Number(id));
                      return changed?.parentItemID === state.itemID;
                    });
                    if (affectsItem || event === 'delete') {
                      Promise.resolve(state.refresh?.()).catch((error) => {
                        Zotero.logError?.('[MindFlow] Item pane refresh failed: ' + error);
                      });
                    }
                  },
                }, ['item'], ADDON_ID);
              } catch (error) {
                Zotero.logError?.('[MindFlow] Item pane observer registration failed: ' + error);
              }
            }
            sectionStates.set(body, state);
          },
          onDestroy: ({ body }) => {
            const state = sectionStates.get(body);
            if (state?.notifierID) {
              try {
                Zotero.Notifier.unregisterObserver(state.notifierID);
              } catch (error) {
                Zotero.logError?.('[MindFlow] Item pane observer cleanup failed: ' + error);
              }
            }
            sectionStates.delete(body);
          },
          onItemChange: ({ body, item, setEnabled }) => {
            const target = regularLiteratureItems([item])[0];
            const state = sectionStates.get(body);
            if (state) state.itemID = target?.id || null;
            setEnabled(Boolean(target));
          },
          onRender: ({ doc, body, item, setSectionSummary }) => {
            if (!body) return;
            body.replaceChildren();
            const target = regularLiteratureItems([item])[0];
            if (!target) return;

            const html = 'http://www.w3.org/1999/xhtml';
            const wrapper = doc.createElementNS(html, 'div');
            wrapper.setAttribute('style', 'display:flex;flex-direction:column;gap:8px;padding:8px 4px;');
            const maps = this.getMindflowAttachments(target);
            setSectionSummary?.(maps.length ? `${maps.length}` : '');
            const summary = doc.createElementNS(html, 'div');
            summary.textContent = maps.length ? `已有 ${maps.length} 份 MindFlow 导图` : '这篇文献还没有 MindFlow 导图';
            doc.l10n?.setAttributes(summary, 'mindflow-item-pane-count', { count: maps.length });
            wrapper.appendChild(summary);

            for (const attachment of maps) {
              const button = doc.createElementNS(html, 'button');
              button.setAttribute('type', 'button');
              button.setAttribute('style', 'width:100%;text-align:left;padding:6px 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;');
              const title = attachment.getField?.('title') || attachment.attachmentFilename || attachment.key || '导图';
              button.textContent = title;
              button.title = `打开导图：${title}`;
              doc.l10n?.setAttributes(button, 'mindflow-item-pane-open', { title });
              button.addEventListener('click', () => {
                void this.openMindflowAttachment(attachment, Zotero.getMainWindow?.());
              });
              wrapper.appendChild(button);
            }

            const create = doc.createElementNS(html, 'button');
            create.setAttribute('type', 'button');
            create.setAttribute('style', 'align-self:flex-start;padding:6px 10px;');
            const library = Zotero.Libraries?.get?.(target.libraryID);
            const readonly = library?.editable === false || library?.filesEditable === false;
            const createLabel = readonly
              ? '创建本地导图（文献库只读）'
              : maps.length ? '新建另一份导图' : '从文献创建导图';
            create.textContent = createLabel;
            doc.l10n?.setAttributes(create, readonly
              ? 'mindflow-item-pane-create-local'
              : maps.length ? 'mindflow-item-pane-create-another' : 'mindflow-item-pane-create');
            create.addEventListener('click', () => {
              this.openMindFlow({ mode: 'create_from_selection', items: [target] }, Zotero.getMainWindow?.());
            });
            wrapper.appendChild(create);
            body.appendChild(wrapper);
          },
        });
      } catch (error) {
        Zotero.logError?.('[MindFlow] Could not register Zotero item pane section: ' + error);
      }
    },

    initWindowListener() {
      windowListener = {
        onOpenWindow: (xulWindow) => {
          let domWindow;
          try {
            domWindow = xulWindow
              .QueryInterface(Ci.nsIInterfaceRequestor)
              .getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
          } catch (_) {
            return;
          }
          const onLoad = () => {
            domWindow.removeEventListener('load', onLoad, false);
            pendingWindowLoads.delete(domWindow);
            if (!domWindow.closed) Zotero.MindFlow?.addToWindow(domWindow);
          };
          pendingWindowLoads.set(domWindow, onLoad);
          domWindow.addEventListener('load', onLoad, { once: true });
          if (domWindow.document?.readyState === 'complete') onLoad();
        },
        onCloseWindow: (xulWindow) => {
          try {
            const domWindow = xulWindow
              .QueryInterface(Ci.nsIInterfaceRequestor)
              .getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
            const onLoad = pendingWindowLoads.get(domWindow);
            if (onLoad) domWindow.removeEventListener('load', onLoad, false);
            pendingWindowLoads.delete(domWindow);
            Zotero.MindFlow?.removeFromWindow(domWindow);
          } catch (_) {}
        },
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
      this.ensureLocalization(doc);

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
          this.triggerMindFlowOpen(window);
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

        const existingMapsMenu = doc.createXULElement ? doc.createXULElement('menu') : doc.createElement('menu');
        const existingMapsPopup = doc.createXULElement ? doc.createXULElement('menupopup') : doc.createElement('menupopup');
        existingMapsMenu.id = 'mindflow-itemmenu-existing';
        existingMapsMenu.setAttribute('label', '打开已有 MindFlow 导图');
        existingMapsMenu.setAttribute('hidden', 'true');
        existingMapsMenu.appendChild(existingMapsPopup);

        // Dynamic popup feedback: show selected items count & auto disable when empty
        const updateItemMenuState = (event) => {
          if (event.target !== itemMenu) return;
          try {
            const pane =
              window.ZoteroPane ||
              (Zotero.getActiveZoteroPane ? Zotero.getActiveZoteroPane() : null) ||
              (Zotero.getMainWindow ? Zotero.getMainWindow().ZoteroPane : null);
            const rawSelection = pane && typeof pane.getSelectedItems === 'function' ? pane.getSelectedItems() : [];
            const selectedItems = regularLiteratureItems(rawSelection);
            existingMapsMenu.setAttribute('hidden', 'true');
            while (existingMapsPopup.firstChild) existingMapsPopup.firstChild.remove();
            if (rawSelection.length === 1 && isMindFlowAttachment(rawSelection[0])) {
              createFromItem.removeAttribute('disabled');
              createFromItem.setAttribute('label', '在 MindFlow 中打开此思维导图');
              return;
            }
            if (!selectedItems || selectedItems.length === 0) {
              createFromItem.setAttribute('disabled', 'true');
              createFromItem.setAttribute('label', '在 MindFlow 中生成文献导图 (未选中文献)');
            } else {
              createFromItem.removeAttribute('disabled');
              const first = selectedItems[0];
              const title = (first.getField ? first.getField('title') : first.title) || '';
              const existingMaps = selectedItems.length === 1 ? this.getMindflowAttachments(first) : [];

              if (existingMaps.length > 1) {
                existingMapsMenu.removeAttribute('hidden');
                for (const attachment of existingMaps) {
                  const entry = doc.createXULElement ? doc.createXULElement('menuitem') : doc.createElement('menuitem');
                  const label = (attachment.getField?.('title') || attachment.attachmentFilename || attachment.key || '导图').slice(0, 90);
                  entry.setAttribute('label', label);
                  entry.addEventListener('command', () => { void this.openMindflowAttachment(attachment, window); });
                  existingMapsPopup.appendChild(entry);
                }
                createFromItem.setAttribute('label', `在 MindFlow 中新建另一份文献导图 (${existingMaps.length} 份已有)`);
              } else if (selectedItems.length === 1) {
                const existingMindflow = existingMaps[0];
                const rawTitle = title || '文献';
                const shortTitle = rawTitle.length > 20 ? rawTitle.slice(0, 20) + '...' : rawTitle;
                if (existingMindflow) {
                  createFromItem.setAttribute('label', `在 MindFlow 中打开导图: "${shortTitle}"`);
                } else {
                  createFromItem.setAttribute('label', `在 MindFlow 中生成导图: "${shortTitle}"`);
                }
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
          const pane =
            window.ZoteroPane ||
            (Zotero.getActiveZoteroPane ? Zotero.getActiveZoteroPane() : null) ||
            (Zotero.getMainWindow ? Zotero.getMainWindow().ZoteroPane : null);
          const rawSelection = pane && typeof pane.getSelectedItems === 'function' ? pane.getSelectedItems() : [];
          const selectedItems = regularLiteratureItems(rawSelection);
          if (rawSelection.length === 1 && isMindFlowAttachment(rawSelection[0])) {
            await this.openMindflowAttachment(rawSelection[0], window);
            return;
          }
          if (!selectedItems || selectedItems.length === 0) return;

          if (selectedItems.length === 1) {
            const attachments = this.getMindflowAttachments(selectedItems[0]);
            const existingAtt = attachments.length === 1 ? attachments[0] : null;
            if (existingAtt) {
              await this.openMindflowAttachment(existingAtt, window);
              return;
            }
          }

          this.openMindFlow({ mode: 'create_from_selection', items: selectedItems }, window);
        });
        itemMenu.appendChild(createFromItem);
        windowElements.push(createFromItem);
        itemMenu.appendChild(existingMapsMenu);
        windowElements.push(existingMapsMenu);
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
          this.triggerMindFlowOpen(window);
        }
      };
      window.addEventListener('keydown', handleGlobalKeyDown, true);
      windowElements.push({
        remove: () => window.removeEventListener('keydown', handleGlobalKeyDown, true),
      });

      // 6. Host-level listener for MindFlow iframe commands (locate item, open PDF, sync tab title)
      const handleHostMessage = (event) => {
        try {
          const iframe = window.document.getElementById('mindflow-tab-iframe');
          if (!iframe?.contentWindow || event.source !== iframe.contentWindow) return;
          const data = event.data;
          if (!data || typeof data !== 'object') return;

          if (data.type === 'MINDFLOW_READY') {
            iframe._mindflowReady = true;
            if (iframe._mindflowPending) {
              iframe.contentWindow.postMessage(iframe._mindflowPending, '*');
              iframe._mindflowPending = null;
            }
            return;
          }

          // A. Locate and highlight item in Library
          if (data.type === 'MINDFLOW_LOCATE_ITEM' && data.key) {
            const tabs = window.Zotero_Tabs;
            if (tabs && Array.isArray(tabs._tabs)) {
              const libTab = tabs._tabs.find((t) => t && (t.type === 'library' || t.id === 'zotero-pane'));
              if (libTab) tabs.select(libTab.id);
            }
            const item = resolveItemReference(data.key, data.libraryID);
            if (item && window.ZoteroPane) {
              window.ZoteroPane.selectItem(item.id);
            }
          }

          // B. Open PDF Reader in Zotero
          if (data.type === 'MINDFLOW_OPEN_PDF' && data.key) {
            const item = resolveItemReference(data.key, data.libraryID);
            if (item) {
              let pdfAtt = null;
              if (item.isAttachment && item.isAttachment() && item.isPDFAttachment && item.isPDFAttachment()) {
                pdfAtt = item;
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
                Promise.resolve(Zotero.Reader.open({ itemID: pdfAtt.id })).catch((error) => {
                  Zotero.logError?.('[MindFlow] PDF reader opening failed: ' + error);
                });
              }
            }
          }

          // C. Synchronize Tab Title with Mind Map document title
          if (data.type === 'MINDFLOW_SET_TAB_TITLE' && typeof data.title === 'string' && data.title.trim()) {
            const tabs = window.Zotero_Tabs;
            if (tabs && Array.isArray(tabs._tabs)) {
              const currentTab = tabs._tabs.find((t) => t && t.type === 'mindflow');
              if (currentTab) {
                if (typeof tabs.rename === 'function') {
                  tabs.rename(currentTab.id, data.title.trim().slice(0, 160));
                } else if (currentTab.tab) {
                  currentTab.tab.setAttribute('label', data.title.trim().slice(0, 160));
                }
              }
            }
          }

          // D. Update Zotero preference from MindFlow UI
          if (data.type === 'MINDFLOW_SET_PREF' && Object.prototype.hasOwnProperty.call(ALLOWED_PREF_MESSAGES, data.key) && ALLOWED_PREF_MESSAGES[data.key](data.value)) {
            if (Zotero.Prefs) {
              Zotero.Prefs.set('extensions.mindflow.' + data.key, data.value, true);
              Zotero.log?.(`[MindFlow] Preference extensions.mindflow.${data.key} updated to: ${data.value}`);
            }
          }

          // E. Request opening in a standalone window or switching mode
          if (data.type === 'MINDFLOW_SET_WINDOW_MODE' && (data.targetMode === 'tab' || data.targetMode === 'window')) {
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
          if (data.type === 'MINDFLOW_SAVE_ATTACHMENT' && data.doc && typeof data.requestId === 'string') {
            const source = event.source;
            const responseOrigin = event.origin && event.origin !== 'null' ? event.origin : '*';
            const sendSaveResult = (result) => {
              try {
                if (source && typeof source.postMessage === 'function') {
                  source.postMessage({ type: 'MINDFLOW_SAVE_ATTACHMENT_RESULT', requestId: data.requestId, result }, responseOrigin);
                }
              } catch (responseError) {
                Zotero.log?.('[MindFlow] Could not return archive result to workspace: ' + responseError);
              }
            };
            this.saveMindMapToItem(data, window)
              .then(sendSaveResult)
              .catch((error) => {
                sendSaveResult({ success: false, message: `归档失败: ${error?.message || error}` });
              });
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
      const toolbarRetryState = { cancelled: false, timers: new Set() };
      windowElements.push({
        remove: () => {
          toolbarRetryState.cancelled = true;
          for (const timer of toolbarRetryState.timers) window.clearTimeout(timer);
          toolbarRetryState.timers.clear();
        },
      });
      this.injectToolbarButton(window, windowElements, 0, toolbarRetryState);

      // 8. Intercept double-click on .mindflow attachments in the library items tree to open directly in MindFlow
      try {
        const handleTreeDblClick = async (e) => {
          try {
            const pane =
              window.ZoteroPane ||
              (Zotero.getActiveZoteroPane ? Zotero.getActiveZoteroPane() : null) ||
              (Zotero.getMainWindow ? Zotero.getMainWindow().ZoteroPane : null);
            const selected = pane && typeof pane.getSelectedItems === 'function' ? pane.getSelectedItems() : [];
            if (selected && selected.length === 1) {
              const item = selected[0];
              if (isMindFlowAttachment(item)) {
                e.preventDefault?.();
                e.stopPropagation?.();
                e.stopImmediatePropagation?.();
                await this.openMindflowAttachment(item, window);
              }
            }
          } catch (_) {}
        };

        const itemsTree =
          doc.getElementById('zotero-items-tree') ||
          doc.querySelector('item-tree');
        // Never attach this shortcut to the whole document: a selected map
        // must not hijack double-clicks in the item pane or other Zotero UI.
        if (itemsTree) {
          itemsTree.addEventListener('dblclick', handleTreeDblClick, true);
          windowElements.push({
            remove: () => itemsTree.removeEventListener('dblclick', handleTreeDblClick, true),
          });
        }
      } catch (treeErr) {
        Zotero.log?.('[MindFlow] Note on items tree dblclick listener: ' + treeErr);
      }

      injectedElements.set(window, windowElements);
    },

    injectToolbarButton(window, windowElements, retryCount = 0, retryState = { cancelled: false, timers: new Set() }) {
      if (retryState.cancelled) return;
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
          const timer = window.setTimeout(() => {
            retryState.timers.delete(timer);
            if (!retryState.cancelled) this.injectToolbarButton(window, windowElements, retryCount + 1, retryState);
          }, 300);
          retryState.timers.add(timer);
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
        this.triggerMindFlowOpen(window);
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
      this.removeLocalization(window.document);
    },

    /**
     * Locate existing .mindflow attachment under an item or its parent
     */
    getExistingMindflowAttachment(item) {
      return this.getMindflowAttachments(item)[0] || null;
    },

    getMindflowAttachments(item) {
      try {
        if (!item) return [];
        let target = item;
        if (typeof target.isAttachment === 'function' && target.isAttachment()) {
          if (isMindFlowAttachment(target)) return [target];
          if (target.parentItemID) {
            target = Zotero.Items.get(target.parentItemID);
          }
        }
        if (target && typeof target.isNote === 'function' && target.isNote() && target.parentItemID) {
          target = Zotero.Items.get(target.parentItemID);
        }
        if (target && typeof target.getAttachments === 'function') {
          const attIds = target.getAttachments();
          const result = [];
          for (const attId of attIds) {
            const att = Zotero.Items.get(attId);
            if (isMindFlowAttachment(att)) result.push(att);
          }
          return result;
        }
      } catch (_) {}
      return [];
    },

    /**
     * Read and load a .mindflow attachment file directly into MindFlow
     */
    async openMindflowAttachment(attItem, targetWindow = null) {
      try {
        if (!attItem) return false;
        const filePath = await attItem.getFilePathAsync?.();
        if (filePath && await IOUtils.exists(filePath)) {
          const content = await IOUtils.readUTF8(filePath);
          const docData = JSON.parse(content);
          if (!docData || typeof docData !== 'object' || !docData.root || typeof docData.root !== 'object') {
            throw new Error('附件不包含有效的 MindFlow 导图结构');
          }
          if (attItem.parentItemID) {
            const p = Zotero.Items.get(attItem.parentItemID);
            if (p) {
              docData.metadata = {
                ...docData.metadata,
                zoteroItemKey: itemSelectUri(p),
                zoteroUri: itemSelectUri(p),
                zoteroLibraryID: p.libraryID,
                zoteroItemTitle: (p.getField ? p.getField('title') : p.title) || docData.title,
                autoSyncToZotero: true,
              };
            }
          }
          this.openMindFlow(
            {
              mode: 'open_document',
              doc: docData,
              openedAttachmentKey: attItem.key,
            },
            targetWindow
          );
          return true;
        }
        showMindFlowNotice('MindFlow 导图文件未在本机', '请先在 Zotero 中下载该附件，再从文献右键菜单打开；插件不会另建一份导图。');
      } catch (err) {
        Zotero.logError?.('[MindFlow] Failed to load .mindflow attachment: ' + err);
        showMindFlowNotice('MindFlow 导图未能打开', '附件可能尚未下载或文件内容已损坏。请检查 Zotero 附件与错误日志。');
      }
      return false;
    },

    /**
     * Smart entry point:
     * - If reading a paper in Reader tab: open its mindmap (or create from this paper)
     * - If items selected in library pane: open existing mindmap (or create from selection)
     * - Otherwise: open MindFlow workspace
     */
    async triggerMindFlowOpen(window = null) {
      try {
        const win =
          window ||
          (typeof window !== 'undefined' ? window : null) ||
          (Zotero.getMainWindow ? Zotero.getMainWindow() : null);

        // 1. Check if user is currently reading a paper in a Zotero Reader tab
        const tabs = win?.Zotero_Tabs || (typeof Zotero_Tabs !== 'undefined' ? Zotero_Tabs : null);
        if (tabs && tabs.selectedTab && tabs.selectedTab.type === 'reader') {
          try {
            const currentTab = tabs.selectedTab;
            let itemID = null;
            if (Zotero.Reader && typeof Zotero.Reader.getByTabID === 'function') {
              const reader = Zotero.Reader.getByTabID(currentTab.id);
              if (reader && reader.itemID) {
                itemID = reader.itemID;
              }
            }
            if (!itemID && currentTab.data?.itemID) {
              itemID = currentTab.data.itemID;
            }

            if (itemID) {
              const item = Zotero.Items.get(itemID);
              let parentItem = item;
              if (item && typeof item.isAttachment === 'function' && item.isAttachment() && item.parentItemID) {
                parentItem = Zotero.Items.get(item.parentItemID) || item;
              }
              if (parentItem?.isRegularItem?.()) {
                const existingMaps = this.getMindflowAttachments(parentItem);
                if (existingMaps.length > 1) {
                  showMindFlowNotice('找到多份 MindFlow 导图', '请在该文献的右键菜单中选择要打开的导图。');
                  return;
                }
                if (existingMaps.length === 1) {
                  await this.openMindflowAttachment(existingMaps[0], win);
                  return;
                }
                this.openMindFlow({ mode: 'create_from_selection', items: [parentItem] }, win);
                return;
              }
            }
          } catch (readerErr) {
            Zotero.log?.('[MindFlow] Note on reader tab detection: ' + readerErr);
          }
        }

        // 2. Check if items are selected in the library pane
        const pane =
          win?.ZoteroPane ||
          (Zotero.getActiveZoteroPane ? Zotero.getActiveZoteroPane() : null) ||
          (Zotero.getMainWindow ? Zotero.getMainWindow().ZoteroPane : null);
        const selectedItems = regularLiteratureItems(pane && typeof pane.getSelectedItems === 'function' ? pane.getSelectedItems() : []);

        if (Array.isArray(selectedItems) && selectedItems.length > 0) {
          if (selectedItems.length === 1) {
            const existingMaps = this.getMindflowAttachments(selectedItems[0]);
            if (existingMaps.length > 1) {
              showMindFlowNotice('找到多份 MindFlow 导图', '请在该文献的右键菜单中选择要打开的导图。');
              return;
            }
            if (existingMaps.length === 1) {
              await this.openMindflowAttachment(existingMaps[0], win);
              return;
            }
          }
          this.openMindFlow({ mode: 'create_from_selection', items: selectedItems }, win);
          return;
        }

        // 3. Fallback: Open MindFlow workspace
        this.openMindFlow({ mode: 'open' }, win);
      } catch (err) {
        Zotero.logError?.('[MindFlow] triggerMindFlowOpen error: ' + err);
        this.openMindFlow({ mode: 'open' }, window);
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
                    const request = {
                        type: 'MINDFLOW_LOAD_DOCUMENT',
                        doc: options.doc,
                        openedAttachmentKey: options.openedAttachmentKey,
                    };
                    if (iframe._mindflowReady) iframe.contentWindow.postMessage(request, '*');
                    else iframe._mindflowPending = request;
                  }
                } catch (e) {
                  // ignore
                }
              } else if (
                (options.mode === 'create_from_selection' || options.mode === 'create_from_collection') &&
                Array.isArray(options.items)
              ) {
                try {
                  const serialized = options.items.map((i) => this.serializeZoteroItem(i)).filter(Boolean);
                  const iframe =
                    win.document.getElementById('mindflow-tab-iframe') ||
                    (existingTab.container && existingTab.container.querySelector('iframe'));
                  if (iframe && iframe.contentWindow) {
                    const request = {
                        type: options.mode === 'create_from_collection'
                          ? 'MINDFLOW_IMPORT_ZOTERO_COLLECTION'
                          : 'MINDFLOW_CREATE_FROM_ITEMS',
                        items: serialized,
                        collectionName: options.collectionName,
                        mode: options.mode,
                    };
                    if (iframe._mindflowReady) iframe.contentWindow.postMessage(request, '*');
                    else iframe._mindflowPending = request;
                  }
                } catch (e) {
                  // ignore
                }
              }
              return;
            }
          }

          const serializedItems = Array.isArray(options.items)
            ? options.items.map((i) => this.serializeZoteroItem(i)).filter(Boolean)
            : [];

          // 2. Open as a new internal Tab in Zotero
          const tabResult = tabs.add({
            type: 'mindflow',
            title: options.collectionName
              ? `MindFlow - ${options.collectionName}`
              : (serializedItems.length === 1 && serializedItems[0]?.title
                  ? `MindFlow - ${serializedItems[0].title.slice(0, 20)}`
                  : 'MindFlow 思维导图'),
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
            iframe._mindflowReady = false;
            iframe._mindflowPending = options.mode === 'open_document' && options.doc
              ? { type: 'MINDFLOW_LOAD_DOCUMENT', doc: options.doc, openedAttachmentKey: options.openedAttachmentKey }
              : options.mode === 'create_from_selection' && serializedItems.length > 0
                ? { type: 'MINDFLOW_CREATE_FROM_ITEMS', items: serializedItems, mode: options.mode }
                : options.mode === 'create_from_collection'
                  ? { type: 'MINDFLOW_IMPORT_ZOTERO_COLLECTION', items: serializedItems, collectionName: options.collectionName, mode: options.mode }
                  : null;

            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.overflow = 'hidden';

            iframe.addEventListener('load', () => {
              try {
                if (iframe.contentWindow) {
                  iframe.contentWindow.Zotero = Zotero;
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

        const serializedItems = Array.isArray(options.items)
          ? options.items.map((i) => this.serializeZoteroItem(i)).filter(Boolean)
          : [];

        const params = {
          Zotero,
          mode: options.mode || 'open',
          doc: options.doc || null,
          openedAttachmentKey: options.openedAttachmentKey || null,
          items: serializedItems,
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

    /**
     * Serialize a live Zotero.Item or attachment into a structured, JSON-safe item descriptor
     */
    serializeZoteroItem(item) {
      try {
        if (!item) return null;
        let target = item;
        const isChildItem =
          (typeof target.isAttachment === 'function' && target.isAttachment()) ||
          (typeof target.isNote === 'function' && target.isNote());
        if (isChildItem && target.parentItemID) {
          const p = Zotero.Items.get(target.parentItemID);
          if (p) target = p;
        }
        // Only bibliographic regular items may seed literature maps. In
        // particular, a standalone note must not be serialized as a paper.
        if (typeof target.isRegularItem !== 'function' || !target.isRegularItem()) return null;

        const title = (typeof target.getField === 'function' ? target.getField('title') : target.title) || '无标题文献';
        const date = typeof target.getField === 'function' ? target.getField('date') : target.date;
        let year = '';
        if (date) {
          const match = String(date).match(/\b(19|20)\d{2}\b/);
          year = match ? match[0] : String(date).slice(0, 4);
        }

        let authors = [];
        try {
          if (typeof target.getCreators === 'function') {
            authors = target.getCreators().map((c) => c.lastName || c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim()).filter(Boolean);
          } else if (Array.isArray(target.creators)) {
            authors = target.creators.map((c) => c.lastName || c.name || '').filter(Boolean);
          }
        } catch (_) {}

        const publication = typeof target.getField === 'function' ? (target.getField('publicationTitle') || target.getField('proceedingsTitle') || target.getField('publisher')) : '';
        const doi = typeof target.getField === 'function' ? target.getField('DOI') : target.doi;
        const url = typeof target.getField === 'function' ? target.getField('url') : target.url;
        const abstract = typeof target.getField === 'function' ? target.getField('abstractNote') : target.abstractNote;

        let tags = [];
        try {
          if (typeof target.getTags === 'function') {
            tags = target.getTags().map((t) => t.tag || String(t)).filter(Boolean);
          } else if (Array.isArray(target.tags)) {
            tags = target.tags.map((t) => t.tag || String(t)).filter(Boolean);
          }
        } catch (_) {}

        const notes = [];
        const annotations = [];

        try {
          if (typeof target.getNotes === 'function') {
            const noteIds = target.getNotes();
            if (Array.isArray(noteIds)) {
              for (const nId of noteIds) {
                const n = Zotero.Items.get(nId);
                if (n) {
                  const t = noteHtmlToText(n.getNote ? n.getNote() : '');
                  if (t && !t.includes('MindFlow 导图大纲')) {
                    notes.push({ text: t, uri: itemSelectUri(n) });
                  }
                }
              }
            }
          }

          if (typeof target.getAttachments === 'function') {
            const attIds = target.getAttachments();
            if (Array.isArray(attIds)) {
              for (const attId of attIds) {
                const att = Zotero.Items.get(attId);
                if (att && att.isPDFAttachment && att.isPDFAttachment()) {
                  if (typeof att.getAnnotations === 'function') {
                    const annos = att.getAnnotations();
                    for (const a of annos) {
                      if (a.annotationText || a.annotationComment) {
                        annotations.push({
                          text: a.annotationText || '',
                          comment: a.annotationComment,
                          pageLabel: a.annotationPageLabel,
                          color: a.annotationColor,
                          uri: annotationLink(att, a),
                        });
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (_) {}

        return {
          key: target.key || String(target.id),
          id: target.id,
          libraryID: target.libraryID,
          title,
          itemType: target.itemType || 'journalArticle',
          authors,
          year,
          publication,
          doi,
          url,
          abstract,
          tags,
          notes,
          annotations,
          zoteroUri: itemSelectUri(target),
        };
      } catch (e) {
        Zotero.logError?.('[MindFlow] serializeZoteroItem error: ' + e);
        return null;
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

        const safeTitle = (String(doc.title || '思维导图')
          .replace(/[\\/:*?"<>|]/g, '_')
          .trim()
          .slice(0, 80)) || '思维导图';
        const safeTitleHtml = escapeHtml(safeTitle);
        const docToken = String(doc.id || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || String(Date.now());
        const tempToken = `${docToken}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        let parentItem = null;

        const mainWin = Zotero.getMainWindow ? Zotero.getMainWindow() : null;
        const zoteroPane =
          (Zotero.getActiveZoteroPane && Zotero.getActiveZoteroPane()) ||
          mainWin?.ZoteroPane ||
          win?.ZoteroPane;

        const explicitReference = data.parentItemKey || doc.metadata?.zoteroUri
          || doc.metadata?.zoteroItemKey || (String(doc.root?.link || '').startsWith('zotero://select/') ? doc.root.link : null);
        if (explicitReference) {
          parentItem = resolveItemReference(explicitReference, doc.metadata?.zoteroLibraryID);
        }

        // Selection is a fallback only for maps without a stored association.
        if (!explicitReference && zoteroPane && typeof zoteroPane.getSelectedItems === 'function') {
          const selected = zoteroPane.getSelectedItems();
          const regular = regularLiteratureItems(selected);
          if (regular.length === 1) parentItem = regular[0];
        }

        // Ensure parentItem is a regular item (if attachment, get parent)
        if (parentItem && typeof parentItem.isAttachment === 'function' && parentItem.isAttachment() && parentItem.parentItemID) {
          const realParent = Zotero.Items.get(parentItem.parentItemID);
          if (realParent) parentItem = realParent;
        }
        if (parentItem && typeof parentItem.isNote === 'function' && parentItem.isNote() && parentItem.parentItemID) {
          const realParent = Zotero.Items.get(parentItem.parentItemID);
          if (realParent) parentItem = realParent;
        }
        if (parentItem && typeof parentItem.isRegularItem === 'function' && !parentItem.isRegularItem()) {
          parentItem = null;
        }

        let savedAttachment = false;
        let savedNote = false;
        let noteError = '';
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
              const localFilePath = PathUtils.join(customSavePath, `${safeTitle}-${docToken}.mindflow`);
              await IOUtils.writeUTF8(localFilePath, JSON.stringify(doc, null, 2));
              savedPath = localFilePath;
              Zotero.log?.(`[MindFlow] Successfully saved copy to custom path: ${localFilePath}`);
            } catch (err) {
              Zotero.logError?.(`[MindFlow] Failed to write to customSavePath: ${err}`);
            }
          }
        }

        if (parentItem) {
          const library = Zotero.Libraries?.get?.(parentItem.libraryID);
          if (library?.editable === false || library?.filesEditable === false) {
            return {
              success: false,
              savedPath,
              message: library.editable === false
                ? '目标 Zotero 群组库为只读；导图仅保存在本地，未写入该文献。'
                : '目标 Zotero 群组库不允许上传附件；导图仅保存在本地，未写入该文献。',
            };
          }
        }

        // If parent item found, attach to it!
        if (parentItem) {
          const tempDir = PathUtils.join(PathUtils.tempDir, `mindflow-${tempToken}`);
          await IOUtils.makeDirectory(tempDir, { createAncestors: true, ignoreExisting: true });
          const attachmentFilename = `${safeTitle}-${docToken}.mindflow`;
          const tempPath = PathUtils.join(tempDir, attachmentFilename);
          await IOUtils.writeUTF8(tempPath, JSON.stringify(doc, null, 2));

          // Check if an existing mindflow attachment already exists under parentItem
          let existingAtt = null;
          if (typeof parentItem.getAttachments === 'function') {
            const attIds = parentItem.getAttachments();
            for (const attId of attIds) {
              const att = Zotero.Items.get(attId);
              if (att && att.isAttachment && att.isAttachment()) {
                if (isMindFlowAttachment(att)) {
                  if (String(att.attachmentFilename || '').endsWith(`-${docToken}.mindflow`)) {
                    existingAtt = att;
                    break;
                  }
                  const attachmentPath = await att.getFilePathAsync?.();
                  if (!attachmentPath) continue;
                  try {
                    const existingData = JSON.parse(await IOUtils.readUTF8(attachmentPath));
                    if (existingData?.id && existingData.id === doc.id) {
                      existingAtt = att;
                      break;
                    }
                  } catch (readError) {
                    Zotero.log?.('[MindFlow] Skipping unreadable existing attachment: ' + readError);
                  }
                }
              }
            }
          }

          if (existingAtt && typeof existingAtt.isStoredFileAttachment === 'function' && existingAtt.isStoredFileAttachment()) {
            try {
              if (typeof existingAtt.relinkAttachmentFile === 'function') {
                const relinked = await existingAtt.relinkAttachmentFile(tempPath);
                if (relinked) {
                  savedAttachment = true;
                }
              }
            } catch (updateErr) {
              Zotero.log?.('[MindFlow] Existing attachment update note, creating new: ' + updateErr);
            }
          }

          if (!savedAttachment) {
            try {
              const attItem = await Zotero.Attachments.importFromFile({
                file: tempPath,
                parentItemID: parentItem.id,
                libraryID: parentItem.libraryID,
                title: `${attachmentFilename} (MindFlow 导图源文件)`,
                contentType: 'application/json',
              });
              if (attItem) savedAttachment = true;
            } catch (importErr) {
              Zotero.logError?.('[MindFlow] Zotero importFromFile failed; refusing an unmanaged storage-file write: ' + importErr);
            }
          }

          // Clean up the unique temporary staging directory
          try {
            await IOUtils.remove(tempPath);
          } catch (_) {}
          try {
            await IOUtils.remove(tempDir, { recursive: true });
          } catch (_) {}

          // Also create/update child outline note if requested or autoArchiveToItem
          let shouldCreateNote = true;
          try {
            if (Zotero.Prefs) {
              shouldCreateNote = Zotero.Prefs.get('extensions.mindflow.autoArchiveToItem', true) !== false;
            }
          } catch (_) {}

          if (shouldCreateNote && savedAttachment) {
            try {
              const noteHtml = `
                <div data-mindflow-document-id="${escapeHtml(doc.id || '')}" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                  <h3 style="color: #0284c7;">🧠 MindFlow 导图大纲: ${safeTitleHtml}</h3>
                  <p style="color: #64748b; font-size: 11px;">最后归档: ${new Date().toLocaleString()}</p>
                  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 8px 0;" />
                  <ul>
                    ${this.renderNodeToHtml(doc.root)}
                  </ul>
                  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 8px 0;" />
                  <p style="font-size: 11px; color: #94a3b8;">已同步挂载 .mindflow 源文件附件，支持 Zotero 云同步与多端漫游</p>
                </div>
              `.trim();

              let existingNote = null;
              if (typeof parentItem.getNotes === 'function') {
                const noteIds = parentItem.getNotes();
                for (const nId of noteIds) {
                    const n = Zotero.Items.get(nId);
                    if (n && n.isNote && n.isNote()) {
                      const text = n.getNote ? n.getNote() : '';
                      const docIdMarker = escapeHtml(doc.id || '');
                      const hasDocumentMarker = docIdMarker && text.includes(`data-mindflow-document-id="${docIdMarker}"`);
                      const matchesLegacyHeading = text.includes(`MindFlow 导图大纲: ${safeTitleHtml}`)
                        && text.includes('已同步挂载 .mindflow 源文件附件')
                        && !text.includes('data-mindflow-document-id=');
                      if (hasDocumentMarker || matchesLegacyHeading) {
                        existingNote = n;
                        break;
                    }
                  }
                }
              }

              if (existingNote) {
                existingNote.setNote(noteHtml);
                await existingNote.saveTx();
              } else {
                const noteItem = new Zotero.Item('note');
                noteItem.libraryID = parentItem.libraryID;
                noteItem.parentItemID = parentItem.id;
                noteItem.setNote(noteHtml);
                await noteItem.saveTx();
              }
              savedNote = true;
            } catch (noteErr) {
              noteError = noteErr?.message || String(noteErr);
              Zotero.logError?.('[MindFlow] Failed to create or update child note: ' + noteErr);
            }
          }

          const itemTitle = (typeof parentItem.getField === 'function' ? parentItem.getField('title') : parentItem.title) || '文献条目';
          const completedTargets = [
            savedAttachment ? `子附件：${safeTitle}-${docToken}.mindflow` : '',
            savedNote ? '子笔记：导图结构化大纲' : '',
            savedPath ? `本地备份：${savedPath}` : '',
          ].filter(Boolean);
          const success = savedAttachment;
          const successMsg = `${success ? '归档完成' : '附件归档失败'}：文献【${itemTitle.length > 25 ? itemTitle.slice(0, 25) + '...' : itemTitle}】${completedTargets.length ? `\n- ${completedTargets.join('\n- ')}` : ''}${noteError ? `\n- 大纲笔记保存失败：${noteError}` : ''}`;

          return { success, message: successMsg, parentItemTitle: itemTitle, savedPath };
        } else {
          // If no parent item found
          let msg = '';
          if (savedPath) {
            msg = `已保存本地备份，但未归档至 Zotero 文献附件：\n${savedPath}\n\n请确认目标文献仍存在，并且所在文献库可编辑。`;
          } else {
            msg = explicitReference
              ? '未找到关联的 Zotero 文献条目；未向当前选中的其他文献归档。请检查原条目是否已删除或当前文献库是否可用。'
              : '未确定唯一的 Zotero 文献归档目标，且未设置本地备份目录。请先仅选中一篇目标文献。';
          }
          return { success: false, message: msg, savedPath };
        }
      } catch (err) {
        Zotero.logError?.('[MindFlow] saveMindMapToItem error: ' + err);
        return { success: false, message: '保存失败: ' + err };
      }
    },

    renderNodeToHtml(node, level = 1) {
      if (!node) return '';
      const indent = '  '.repeat(level);
      let html = `${indent}<li><strong>${escapeHtml(node.text)}</strong>`;
      if (node.note) {
        html += `<br/><small style="color: #64748b;">${escapeHtml(node.note)}</small>`;
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

        // 1. Zotero.openPreferences API
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
      if (this.itemPaneSectionID && typeof Zotero.ItemPaneManager?.unregisterSection === 'function') {
        try {
          Zotero.ItemPaneManager.unregisterSection(this.itemPaneSectionID);
        } catch (error) {
          Zotero.logError?.('[MindFlow] Could not unregister item pane section: ' + error);
        }
        this.itemPaneSectionID = null;
      }
      if (windowListener) {
        Services.wm.removeListener(windowListener);
        windowListener = null;
      }
      for (const [win, handler] of pendingWindowLoads) {
        try {
          win.removeEventListener('load', handler, false);
        } catch (_) {}
      }
      pendingWindowLoads.clear();
      for (const [win] of injectedElements) {
        this.removeFromWindow(win);
      }
      injectedElements.clear();
      for (const doc of this.localizedDocs) this.removeLocalization(doc);
      delete Zotero.MindFlow;
      Zotero.log('[MindFlow] Shutdown and cleaned up successfully');
    },
  };

  // Launch initial registration
  Zotero.MindFlow.init();
})();
