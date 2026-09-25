/* MindFlow settings pane for Zotero 10. The workspace and this pane share one
 * AppSettings JSON preference; legacy native preferences remain mirrored for
 * host-side actions such as opening a tab and archiving a note. */
var MindFlow_Preferences = (() => {
  const ROOT = 'mindflow.mindflow_app_settings';
  const PREFIX = 'extensions.mindflow.';
  const HTML = 'http://www.w3.org/1999/xhtml';
  const DEFAULTS = {
    toolbarPosition: 'top',
    workbenchDockPosition: 'left',
    toolbarButtons: {
      history: true, insert: true, layout: true, theme: true, outline: true,
      inbox: true, templates: true, zen: true, export: true, zoom: true,
    },
    canvasBackground: 'dots', zoomStep: 0.15, rainbowBranches: true,
    curveStyle: 'bezier', soundEffects: true, defaultThemeId: 'classic-blue',
    defaultLayout: 'mindmap', defaultTaskPriority: 2, autoExpandOnAddChild: true,
    autoSnapshotEnabled: true, autoSnapshotIntervalMinutes: 10,
    maxSnapshotsPerDoc: 20,
    webdav: {
      enabled: false, serverUrl: '', basePath: '/MindFlow/',
      username: '', password: '', autoSyncOnSave: false,
    },
    zoteroWindowMode: 'tab', zoteroIncludeAbstract: true,
    zoteroIncludeAnnotations: true, zoteroIncludeTags: true,
    showWelcomeOnStartup: true,
  };
  const LEGACY = {
    zoteroWindowMode: 'windowMode', showWelcomeOnStartup: 'showWelcomeOnStartup',
    zoteroIncludeAbstract: 'includeAbstract',
    zoteroIncludeAnnotations: 'includeAnnotations', zoteroIncludeTags: 'includeTags',
    defaultLayout: 'defaultLayout', canvasBackground: 'canvasBackground',
    curveStyle: 'curveStyle', rainbowBranches: 'rainbowBranches',
    soundEffects: 'soundEffects', autoSnapshotEnabled: 'autoSnapshotEnabled',
    autoSnapshotIntervalMinutes: 'autoSnapshotIntervalMinutes',
    'webdav.enabled': 'webdavEnabled', 'webdav.serverUrl': 'webdavServerUrl',
    'webdav.basePath': 'webdavBasePath', 'webdav.username': 'webdavUsername',
    'webdav.password': 'webdavPassword', 'webdav.autoSyncOnSave': 'webdavAutoSync',
  };
  const NATIVE_DEFAULTS = {
    autoArchiveToItem: true, autoOpenAfterExport: true, customSavePath: '',
  };
  const THEMES = [
    ['classic-blue', '经典商务蓝'], ['dark-nebula', '极夜星云'],
    ['macaron', '马卡龙缤纷'], ['forest-green', '松柏青绿'],
    ['minimal-ink', '极简水墨'], ['warm-amber', '暖阳琥珀'],
    ['cyberpunk-neon', '赛博霓虹'], ['nordic-frost', '北欧冷灰'],
    ['academic-paper', '学术报刊'], ['lavender-dream', '薰衣草梦境'],
  ];
  const FIELDS = {
    literature: [
      ['zoteroWindowMode', '打开方式', 'select', [['tab', 'Zotero 选项卡'], ['window', '独立窗口']]],
      ['showWelcomeOnStartup', '打开空白工作台时显示欢迎页', 'check'],
      ['zoteroIncludeAbstract', '从文献条目导入摘要', 'check'],
      ['zoteroIncludeAnnotations', '导入 PDF 批注与文献笔记', 'check'],
      ['zoteroIncludeTags', '导入文献标签', 'check'],
      ['autoArchiveToItem', '归档导图附件时更新结构化大纲子笔记', 'check', null, true],
      ['autoOpenAfterExport', '保存为 Zotero 笔记后在文献库中定位', 'check', null, true],
    ],
    interface: [
      ['toolbarPosition', '工具栏位置', 'select', [['top', '顶部'], ['bottom', '底部']]],
      ['workbenchDockPosition', '工作台侧栏位置', 'select', [['left', '左侧'], ['right', '右侧']]],
      ['canvasBackground', '画布背景', 'select', [['dots', '点阵'], ['grid', '网格'], ['blank', '空白']]],
      ['zoomStep', '缩放步进', 'number-select', [['0.1', '10%'], ['0.15', '15%'], ['0.2', '20%'], ['0.3', '30%']]],
      ['toolbarButtons.history', '撤销与重做', 'check'],
      ['toolbarButtons.insert', '插入节点', 'check'],
      ['toolbarButtons.layout', '布局', 'check'],
      ['toolbarButtons.theme', '主题', 'check'],
      ['toolbarButtons.outline', '大纲', 'check'],
      ['toolbarButtons.inbox', '收集箱', 'check'],
      ['toolbarButtons.templates', '模板', 'check'],
      ['toolbarButtons.zen', '专注模式', 'check'],
      ['toolbarButtons.export', '导出', 'check'],
      ['toolbarButtons.zoom', '缩放', 'check'],
    ],
    editing: [
      ['defaultThemeId', '新建导图主题', 'select', THEMES],
      ['defaultLayout', '新建导图布局', 'select', [['mindmap', '左右平衡'], ['logic-right', '向右逻辑图'], ['org-down', '向下组织图']]],
      ['curveStyle', '分支连线', 'select', [['bezier', '平滑曲线'], ['straight', '直线'], ['rounded', '圆角折线']]],
      ['defaultTaskPriority', '新任务优先级', 'number-select', [['1', 'P1 高'], ['2', 'P2 中'], ['3', 'P3 普通']]],
      ['rainbowBranches', '为主分支使用不同颜色', 'check'],
      ['soundEffects', '播放节点操作音效', 'check'],
      ['autoExpandOnAddChild', '添加子节点时展开父节点', 'check'],
    ],
    backup: [
      ['customSavePath', '额外保存文件夹', 'text', null, true],
      ['autoSnapshotEnabled', '编辑时自动创建历史快照', 'check'],
      ['autoSnapshotIntervalMinutes', '快照间隔', 'number-select', [['5', '5 分钟'], ['10', '10 分钟'], ['15', '15 分钟'], ['30', '30 分钟']]],
      ['maxSnapshotsPerDoc', '每份导图最多保留', 'number-select', [['10', '10 个快照'], ['20', '20 个快照'], ['50', '50 个快照']]],
    ],
    webdav: [
      ['webdav.enabled', '启用 WebDAV 备份', 'check'],
      ['webdav.serverUrl', '服务器 URL', 'url'],
      ['webdav.basePath', '备份目录', 'text'],
      ['webdav.username', '用户名', 'text'],
      ['webdav.password', '应用密码或令牌', 'password'],
      ['webdav.autoSyncOnSave', '保存导图时自动上传工作区备份', 'check'],
    ],
  };

  function prefGet(key, fallback) {
    const value = Zotero.Prefs.get(key, true);
    return value === undefined || value === null ? fallback : value;
  }
  function getPath(object, path) {
    return path.split('.').reduce((value, part) => value?.[part], object);
  }
  function setPath(object, path, value) {
    const parts = path.split('.');
    let target = object;
    for (const part of parts.slice(0, -1)) target = target[part];
    target[parts.at(-1)] = value;
  }
  function merge(target, source) {
    const result = { ...target };
    if (!source || typeof source !== 'object' || Array.isArray(source)) return result;
    for (const [key, value] of Object.entries(source)) {
      if (!(key in target)) continue;
      result[key] = value && typeof value === 'object' && !Array.isArray(value)
        ? merge(target[key], value) : value;
    }
    return result;
  }
  function readSettings() {
    const raw = prefGet(ROOT, '');
    if (raw) {
      try { return merge(JSON.parse(JSON.stringify(DEFAULTS)), JSON.parse(raw)); }
      catch (error) { Zotero.logError?.('[MindFlow] Invalid settings JSON: ' + error); }
    }
    const settings = JSON.parse(JSON.stringify(DEFAULTS));
    for (const [path, pref] of Object.entries(LEGACY)) {
      setPath(settings, path, prefGet(PREFIX + pref, getPath(settings, path)));
    }
    // The old theme preference used names which were not real theme IDs.
    const oldTheme = prefGet(PREFIX + 'theme', '');
    if (THEMES.some(([id]) => id === oldTheme)) settings.defaultThemeId = oldTheme;
    return settings;
  }
  function writeSettings(settings, path) {
    const json = JSON.stringify(settings);
    Zotero.Prefs.set(ROOT, json, true);
    if (prefGet(ROOT, '') !== json) throw new Error('Zotero 未保存工作台设置');
    if (path === 'workbenchDockPosition') {
      Zotero.Prefs.set('mindflow.mindflow_dock_pos', settings.workbenchDockPosition, true);
    }
    const legacyKey = LEGACY[path];
    if (legacyKey) Zotero.Prefs.set(PREFIX + legacyKey, getPath(settings, path), true);
    if (path === 'defaultThemeId') Zotero.Prefs.set(PREFIX + 'theme', settings.defaultThemeId, true);
  }
  function element(doc, tag, className, text) {
    const node = doc.createElementNS(HTML, tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function status(doc, message, error = false) {
    const node = doc.getElementById('mindflow-pref-status');
    if (node) {
      node.textContent = message;
      node.classList.toggle('mindflow-pref-error', error);
    }
  }
  function appendDescription(doc, container, text) {
    container.appendChild(element(doc, 'p', 'mindflow-pref-desc', text));
  }
  function renderField(doc, container, field, settings) {
    const [path, title, type, options, native] = field;
    const row = element(doc, 'div', type === 'check' ? 'mindflow-check-row' : 'mindflow-control-row');
    if (path === 'customSavePath') row.classList.add('mindflow-folder-row');
    const label = element(doc, 'label', 'mindflow-control-label');
    const input = element(doc, type === 'check' || type === 'text' || type === 'url' || type === 'password' ? 'input' : 'select', 'mindflow-control');
    input.id = 'mindflow-pref-' + path.replace(/\./g, '-');
    input.dataset.setting = path;
    if (type === 'check') input.type = 'checkbox';
    else if (type === 'text' || type === 'url' || type === 'password') input.type = type;
    if (options) {
      for (const [value, name] of options) {
        const option = element(doc, 'option', '', name);
        option.value = value;
        input.appendChild(option);
      }
    }
    const value = native ? prefGet(PREFIX + path, NATIVE_DEFAULTS[path]) : getPath(settings, path);
    if (type === 'check') input.checked = Boolean(value);
    else input.value = String(value ?? '');
    label.appendChild(element(doc, 'span', '', title));
    label.appendChild(input);
    row.appendChild(label);
    container.appendChild(row);
    input.addEventListener('change', () => {
      const next = type === 'check' ? input.checked
        : type === 'number-select' ? Number(input.value) : input.value.trim();
      try {
        if (native) {
          Zotero.Prefs.set(PREFIX + path, next, true);
          if (prefGet(PREFIX + path, null) !== next) throw new Error('Zotero 未保存此设置');
        } else {
          const latest = readSettings();
          if (path === 'webdav.autoSyncOnSave' && next) {
            if (!latest.webdav.enabled) throw new Error('请先启用 WebDAV 备份');
            const server = new URL(/^https?:\/\//i.test(latest.webdav.serverUrl)
              ? latest.webdav.serverUrl : 'https://' + latest.webdav.serverUrl);
            if (server.protocol !== 'https:' || server.username || server.password || server.search || server.hash) {
              throw new Error('WebDAV 服务器需使用 HTTPS，且地址中不能包含账号、查询或片段');
            }
          }
          setPath(latest, path, next);
          writeSettings(latest, path);
        }
        status(doc, '已保存。已打开的导图工作台在重新获得焦点后更新。');
      } catch (error) {
        const previous = native ? prefGet(PREFIX + path, NATIVE_DEFAULTS[path]) : getPath(readSettings(), path);
        if (type === 'check') input.checked = Boolean(previous);
        else input.value = String(previous ?? '');
        status(doc, '保存失败：' + error, true);
      }
    });
    if (path === 'customSavePath') {
      const button = element(doc, 'button', 'mindflow-btn-secondary', '选择文件夹');
      button.type = 'button';
      button.addEventListener('click', () => {
        try {
          const picker = Components.classes['@mozilla.org/filepicker;1']
            .createInstance(Components.interfaces.nsIFilePicker);
          picker.init(doc.defaultView, '选择 MindFlow 额外保存文件夹', Components.interfaces.nsIFilePicker.modeGetFolder);
          picker.open((result) => {
            if (result !== Components.interfaces.nsIFilePicker.returnOK || !picker.file?.path) return;
            input.value = picker.file.path;
            input.dispatchEvent(new doc.defaultView.Event('change', { bubbles: true }));
          });
        } catch (error) {
          status(doc, '选择文件夹失败：' + error, true);
        }
      });
      row.appendChild(button);
    }
  }
  const paneObservers = new WeakMap();
  function refreshControls(doc) {
    const settings = readSettings();
    for (const fields of Object.values(FIELDS)) {
      for (const [path, , type, , native] of fields) {
        const input = doc.getElementById('mindflow-pref-' + path.replace(/\./g, '-'));
        if (!input) continue;
        const value = native ? prefGet(PREFIX + path, NATIVE_DEFAULTS[path]) : getPath(settings, path);
        if (type === 'check') input.checked = Boolean(value);
        else if (input !== doc.activeElement) input.value = String(value ?? '');
      }
    }
  }
  function init(win) {
    try {
      const doc = win.document;
      const settings = readSettings();
      for (const [group, fields] of Object.entries(FIELDS)) {
        const container = doc.getElementById('mindflow-pref-' + group);
        if (!container) continue;
        container.replaceChildren();
        for (const field of fields) renderField(doc, container, field, settings);
        if (group === 'literature') appendDescription(doc, container,
          '附件和笔记保存在文献所属库；群组库写入取决于权限，跨设备附件同步取决于 Zotero 文件同步设置。');
        if (group === 'backup') appendDescription(doc, container,
          '额外保存文件夹不代替文献下的 .mindflow 附件。导出、导入与恢复工作区请在导图工作台操作。');
        if (group === 'webdav') appendDescription(doc, container,
          'WebDAV 是额外的工作区备份，与 Zotero 自身同步分别配置。连接测试、手动上传和版本恢复请在工作台操作。');
      }
      const openButton = doc.getElementById('mindflow-btn-open-workspace');
      openButton.onclick = () => Zotero.MindFlow?.openMindFlow?.({ mode: 'open' });
      const resetButton = doc.getElementById('mindflow-btn-reset-defaults');
      resetButton.onclick = () => {
        if (!win.confirm('恢复 MindFlow 默认设置？导图和快照不会被删除。')) return;
        try {
          const fresh = JSON.parse(JSON.stringify(DEFAULTS));
          writeSettings(fresh, 'workbenchDockPosition');
          for (const [path, pref] of Object.entries(LEGACY)) {
            Zotero.Prefs.set(PREFIX + pref, getPath(fresh, path), true);
          }
          Zotero.Prefs.set(PREFIX + 'theme', fresh.defaultThemeId, true);
          for (const [key, value] of Object.entries(NATIVE_DEFAULTS)) Zotero.Prefs.set(PREFIX + key, value, true);
          init(win);
          status(doc, 'MindFlow 设置已恢复默认值。');
        } catch (error) {
          status(doc, '重置失败：' + error, true);
        }
      };
      if (!paneObservers.has(doc) && Zotero.Prefs.registerObserver) {
        const observer = Zotero.Prefs.registerObserver(ROOT, () => refreshControls(doc), true);
        paneObservers.set(doc, observer);
        win.addEventListener('unload', () => {
          Zotero.Prefs.unregisterObserver?.(observer);
          paneObservers.delete(doc);
        }, { once: true });
      }
    } catch (error) {
      Zotero.logError?.('[MindFlow] Preference pane error: ' + error);
      status(win.document, '设置面板加载失败：' + error, true);
    }
  }
  return { init };
})();
