/* MindFlow settings pane for Zotero 7/10. The workspace and this pane share one
 * AppSettings JSON preference; legacy native preferences remain mirrored for
 * host-side actions such as opening a tab and archiving a note.
 *
 * Typography, spacing hierarchy, and design tokens strictly match Zotero's
 * native preferences and MetaFlow design specifications. */
// Zotero 10 loads preference scripts in a pane sandbox. Inline fragment
// handlers resolve names on the preferences window, not sandbox globals.
window.MindFlow_Preferences = (() => {
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
    aiMaxPdfPages: 120,
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
      {
        path: 'zoteroWindowMode',
        title: '打开方式',
        desc: '从文献条目或 PDF 阅读器打开导图时的窗口呈现模式',
        type: 'select',
        options: [['tab', 'Zotero 选项卡 (推荐)'], ['window', '独立窗口']],
      },
      {
        path: 'showWelcomeOnStartup',
        title: '打开空白工作台时显示欢迎页',
        desc: '展示模板库、知识图谱向导与快速开始帮助',
        type: 'check',
      },
      {
        path: 'zoteroIncludeAbstract',
        title: '从文献条目导入摘要',
        desc: '一键生成导图时将文献 Abstract 作为专属子分支导入',
        type: 'check',
      },
      {
        path: 'zoteroIncludeAnnotations',
        title: '导入 PDF 划线高亮与批注笔记',
        desc: '自动提取关联 PDF 的批注、划线和文本备注并结构化建树',
        type: 'check',
      },
      {
        path: 'zoteroIncludeTags',
        title: '导入文献标签 (Tags)',
        desc: '将文献已有标签呈现为思维导图分支标签',
        type: 'check',
      },
      {
        path: 'autoArchiveToItem',
        title: '归档导图附件时自动更新大纲子笔记',
        desc: '在文献条目下同步维护一份纯文本结构化 Markdown/大纲笔记',
        type: 'check',
        native: true,
      },
      {
        path: 'autoOpenAfterExport',
        title: '保存为 Zotero 笔记后在文献库中聚焦定位',
        desc: '导出笔记后自动返回文献库列表并高亮新生成的笔记条目',
        type: 'check',
        native: true,
      },
    ],
    ai: [
      {
        path: 'aiMaxPdfPages',
        title: '最多读取 PDF 页数',
        desc: '长篇文献分析时的页数截断保护，防止模型上下文溢出或请求超时',
        type: 'number-select',
        options: [['50', '前 50 页'], ['120', '前 120 页 (推荐)'], ['200', '前 200 页']],
        native: true,
      },
    ],
    interface: [
      {
        path: 'toolbarPosition',
        title: '主工具栏位置',
        desc: '工作台画布顶层控制栏的停靠方向',
        type: 'select',
        options: [['top', '画布顶部 (推荐)'], ['bottom', '画布底部']],
      },
      {
        path: 'workbenchDockPosition',
        title: '工作台侧栏位置',
        desc: '大纲与辅助面板停靠在工作台的左侧或右侧',
        type: 'select',
        options: [['left', '居左 (默认)'], ['right', '居右']],
      },
      {
        path: 'canvasBackground',
        title: '画布背景网格',
        desc: '思维导图画布的背景图案与视觉底纹风格',
        type: 'select',
        options: [['dots', '点阵 (Dots)'], ['grid', '网格 (Grid)'], ['blank', '纯白空白 (Blank)']],
      },
      {
        path: 'zoomStep',
        title: '鼠标滚轮缩放步进',
        desc: '每次转动滚轮时画布缩放比例的变化幅度',
        type: 'number-select',
        options: [['0.1', '10% (细腻)'], ['0.15', '15% (标准)'], ['0.2', '20% (快速)'], ['0.3', '30% (大幅)']],
      },
      {
        subhead: '工作台顶栏常用按钮显示',
      },
      {
        path: 'toolbarButtons.history',
        title: '撤销与重做',
        type: 'check',
        inGrid: true,
      },
      {
        path: 'toolbarButtons.insert',
        title: '插入节点',
        type: 'check',
        inGrid: true,
      },
      {
        path: 'toolbarButtons.layout',
        title: '结构布局',
        type: 'check',
        inGrid: true,
      },
      {
        path: 'toolbarButtons.theme',
        title: '主题配色',
        type: 'check',
        inGrid: true,
      },
      {
        path: 'toolbarButtons.outline',
        title: '大纲视图',
        type: 'check',
        inGrid: true,
      },
      {
        path: 'toolbarButtons.inbox',
        title: '灵感收集箱',
        type: 'check',
        inGrid: true,
      },
      {
        path: 'toolbarButtons.templates',
        title: '预设模板',
        type: 'check',
        inGrid: true,
      },
      {
        path: 'toolbarButtons.zen',
        title: '全屏专注',
        type: 'check',
        inGrid: true,
      },
      {
        path: 'toolbarButtons.export',
        title: '导出与归档',
        type: 'check',
        inGrid: true,
      },
      {
        path: 'toolbarButtons.zoom',
        title: '画布缩放',
        type: 'check',
        inGrid: true,
      },
    ],
    editing: [
      {
        path: 'defaultThemeId',
        title: '新建导图默认主题',
        desc: '新建空白思维导图时应用的默认调色盘',
        type: 'select',
        options: THEMES,
      },
      {
        path: 'defaultLayout',
        title: '新建导图默认布局',
        desc: '新建思维导图时节点生长的默认分支排布规则',
        type: 'select',
        options: [['mindmap', '经典左右平衡 (Mindmap)'], ['logic-right', '向右逻辑图 (Logic Right)'], ['org-down', '向下组织架构图 (Org Down)']],
      },
      {
        path: 'curveStyle',
        title: '分支连线风格',
        desc: '父子节点之间连接线条的几何渲染形式',
        type: 'select',
        options: [['bezier', '平滑贝塞尔曲线'], ['straight', '直线'], ['rounded', '圆角折线']],
      },
      {
        path: 'rainbowBranches',
        title: '为主分支自动分配彩虹色彩',
        desc: '根节点下的每个一级子分支自动轮换不同色彩，清晰辨识知识分支',
        type: 'check',
      },
      {
        path: 'soundEffects',
        title: '播放节点操作微交互音效',
        desc: '在插入、删除节点或拖拽重排时播放轻微的声音反馈',
        type: 'check',
      },
      {
        path: 'autoExpandOnAddChild',
        title: '添加子节点时自动展开父节点',
        desc: '向折叠节点添加新子节点时，自动展开该父分支',
        type: 'check',
      },
    ],
    backup: [
      {
        path: 'customSavePath',
        title: '额外镜像备份目录',
        desc: '除文献附件库外，每次保存可额外备份一份 .mindflow 副本至指定本地文件夹（留空则不开启）',
        type: 'text',
        native: true,
      },
      {
        path: 'autoSnapshotEnabled',
        title: '编辑时自动创建历史快照',
        desc: '防止误操作或内容丢失，工作台在后台静默保存带有时间戳的历史版本',
        type: 'check',
      },
      {
        path: 'autoSnapshotIntervalMinutes',
        title: '快照保存频率',
        desc: '后台自动记录编辑快照的最小时间间隔',
        type: 'number-select',
        options: [['5', '每 5 分钟'], ['10', '每 10 分钟 (推荐)'], ['15', '每 15 分钟'], ['30', '每 30 分钟']],
      },
      {
        path: 'maxSnapshotsPerDoc',
        title: '每份导图最多保留快照数',
        desc: '超出限制后将自动丢弃最早的快照以释放本地存储空间',
        type: 'number-select',
        options: [['10', '10 个快照'], ['20', '20 个快照 (推荐)'], ['50', '50 个快照']],
      },
    ],
    webdav: [
      {
        path: 'webdav.enabled',
        title: '启用 WebDAV 云端备份',
        desc: '使用坚果云、Nextcloud 等标准 WebDAV 服务端同步导图工作区备份',
        type: 'check',
      },
      {
        path: 'webdav.serverUrl',
        title: '服务器 URL 地址',
        desc: '必须使用 HTTPS，如 https://dav.jianguoyun.com/dav/',
        type: 'url',
      },
      {
        path: 'webdav.basePath',
        title: '云端同步目录',
        desc: '存储备份的根目录，默认为 /MindFlow/',
        type: 'text',
      },
      {
        path: 'webdav.username',
        title: '账户用户名 / 邮箱',
        desc: 'WebDAV 登录用户名',
        type: 'text',
      },
      {
        path: 'webdav.password',
        title: '应用授权密码 / Token',
        desc: '强烈建议使用云盘提供的应用独立密码或安全令牌',
        type: 'password',
      },
      {
        path: 'webdav.autoSyncOnSave',
        title: '本地保存时自动推送云端备份',
        desc: '每次在工作台保存导图时，静默上传工作区增量备份',
        type: 'check',
      },
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

  function appendNotice(doc, container, text) {
    container.appendChild(element(doc, 'div', 'mindflow-notice', text));
  }

  function attachInputListener(doc, input, field) {
    const { path, type, native } = field;
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
  }

  function renderField(doc, container, field, settings) {
    const { path, title, type, options, native, desc, inGrid } = field;
    const inputId = 'mindflow-pref-' + path.replace(/\./g, '-');
    const value = native ? prefGet(PREFIX + path, NATIVE_DEFAULTS[path]) : getPath(settings, path);

    if (inGrid) {
      const label = element(doc, 'label', 'mindflow-check-row');
      const input = element(doc, 'input', 'mindflow-control');
      input.type = 'checkbox';
      input.id = inputId;
      input.dataset.setting = path;
      input.checked = Boolean(value);
      const span = element(doc, 'span', 'mindflow-check-label', title);
      label.appendChild(input);
      label.appendChild(span);
      container.appendChild(label);
      attachInputListener(doc, input, field);
      return;
    }

    if (type === 'check') {
      const optionWrap = element(doc, 'div', 'mindflow-check-option');
      const label = element(doc, 'label', 'mindflow-check-row');
      const input = element(doc, 'input', 'mindflow-control');
      input.type = 'checkbox';
      input.id = inputId;
      input.dataset.setting = path;
      input.checked = Boolean(value);
      const span = element(doc, 'span', 'mindflow-check-label', title);
      label.appendChild(input);
      label.appendChild(span);
      optionWrap.appendChild(label);
      if (desc) {
        optionWrap.appendChild(element(doc, 'div', 'mindflow-check-desc', desc));
      }
      container.appendChild(optionWrap);
      attachInputListener(doc, input, field);
      return;
    }

    const row = element(doc, 'div', 'mindflow-form-row');
    const labelWrap = element(doc, 'div', 'mindflow-form-label-wrap');
    const label = element(doc, 'label', 'mindflow-form-label', title);
    label.htmlFor = inputId;
    labelWrap.appendChild(label);
    if (desc) {
      labelWrap.appendChild(element(doc, 'span', 'mindflow-form-desc', desc));
    }
    row.appendChild(labelWrap);

    const isSelect = type === 'select' || type === 'number-select';
    const input = element(doc, isSelect ? 'select' : 'input', 'mindflow-control');
    input.id = inputId;
    input.dataset.setting = path;
    if (!isSelect) input.type = type;

    if (options) {
      for (const [val, name] of options) {
        const option = element(doc, 'option', '', name);
        option.value = val;
        input.appendChild(option);
      }
    }
    input.value = String(value ?? '');

    if (type === 'password') {
      const group = element(doc, 'div', 'mindflow-control-group');
      group.appendChild(input);
      const eyeBtn = element(doc, 'button', 'mindflow-icon-btn', '👁');
      eyeBtn.type = 'button';
      eyeBtn.title = '显示 / 隐藏密钥';
      eyeBtn.addEventListener('click', () => {
        input.type = input.type === 'password' ? 'text' : 'password';
      });
      group.appendChild(eyeBtn);
      row.appendChild(group);
    } else if (path === 'customSavePath') {
      const group = element(doc, 'div', 'mindflow-control-group');
      group.appendChild(input);
      const folderBtn = element(doc, 'button', 'mindflow-btn-secondary', '选择文件夹');
      folderBtn.type = 'button';
      folderBtn.addEventListener('click', () => {
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
      group.appendChild(folderBtn);
      row.appendChild(group);
    } else {
      row.appendChild(input);
    }

    container.appendChild(row);
    attachInputListener(doc, input, field);
  }

  function renderGroupFields(doc, container, fields, settings) {
    let gridContainer = null;
    for (const field of fields) {
      if (field.subhead) {
        gridContainer = null;
        container.appendChild(element(doc, 'h3', 'mindflow-subhead', field.subhead));
        continue;
      }
      if (field.inGrid) {
        if (!gridContainer) {
          gridContainer = element(doc, 'div', 'mindflow-choice-grid');
          container.appendChild(gridContainer);
        }
        renderField(doc, gridContainer, field, settings);
      } else {
        gridContainer = null;
        renderField(doc, container, field, settings);
      }
    }
  }

  const paneObservers = new WeakMap();

  function refreshControls(doc) {
    const settings = readSettings();
    for (const fields of Object.values(FIELDS)) {
      for (const field of fields) {
        if (!field.path) continue;
        const input = doc.getElementById('mindflow-pref-' + field.path.replace(/\./g, '-'));
        if (!input) continue;
        const value = field.native ? prefGet(PREFIX + field.path, NATIVE_DEFAULTS[field.path]) : getPath(settings, field.path);
        if (field.type === 'check') input.checked = Boolean(value);
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
        renderGroupFields(doc, container, fields, settings);

        if (group === 'literature') {
          appendNotice(doc, container,
            '提示：导图源文件 (.mindflow) 自动作为附件归档在对应文献条目下；跨设备同步遵从 Zotero 文件同步策略。');
        }
        if (group === 'ai') {
          const notice = element(doc, 'div', 'mindflow-notice');
          const p1 = element(doc, 'p', '', '');
          p1.style.margin = '0 0 6px';
          const strong1 = element(doc, 'strong', '', 'MindFlow AI 智能分析');
          const code = element(doc, 'code', '', 'llm-for-zotero');
          p1.appendChild(strong1);
          p1.appendChild(doc.createTextNode(' 深度集成 '));
          p1.appendChild(code);
          p1.appendChild(doc.createTextNode(' 插件。模型选择、API 密钥配置及网络连通性由其统一管理，MindFlow 负责文献结构化解析与思维导图编排。'));
          notice.appendChild(p1);

          const p2 = element(doc, 'p', '', '');
          p2.style.margin = '0';
          const strong2 = element(doc, 'strong', '', '隐私安全：');
          p2.appendChild(strong2);
          p2.appendChild(doc.createTextNode('仅在您主动点击「AI 生成导图」并确认范围后，才将选中内容提交至大模型；生成的内容保留证据引用链，供您审阅修改后归档。'));
          notice.appendChild(p2);
          container.appendChild(notice);

          const button = element(doc, 'button', 'mindflow-btn-open-llm', '打开 llm-for-zotero 设置');
          button.type = 'button';
          button.addEventListener('click', () => {
            try { Zotero.MindFlow.openLLMPreferences(); }
            catch (error) { status(doc, String(error?.message || error), true); }
          });
          container.appendChild(button);
        }
        if (group === 'backup') {
          appendNotice(doc, container,
            '提示：额外保存文件夹不代替文献条目下的 .mindflow 附件。历史快照与完整版本回溯可在导图工作台顶栏的「历史」面板中直接浏览与一键恢复。');
        }
        if (group === 'webdav') {
          appendNotice(doc, container,
            '提示：WebDAV 作为独立于 Zotero 原生同步的工作区级二次容灾备份。连接测试、手动上传和版本恢复请在工作台操作。');
        }
      }

      const openButton = doc.getElementById('mindflow-btn-open-workspace');
      if (openButton) {
        openButton.onclick = () => Zotero.MindFlow?.openMindFlow?.({ mode: 'open' });
      }

      const resetButton = doc.getElementById('mindflow-btn-reset-defaults');
      if (resetButton) {
        resetButton.onclick = () => {
          if (!win.confirm('恢复 MindFlow 默认偏好设置？已保存的思维导图、文献附件和历史快照不会被删除。')) return;
          try {
            const fresh = JSON.parse(JSON.stringify(DEFAULTS));
            writeSettings(fresh, 'workbenchDockPosition');
            for (const [path, pref] of Object.entries(LEGACY)) {
              Zotero.Prefs.set(PREFIX + pref, getPath(fresh, path), true);
            }
            Zotero.Prefs.set(PREFIX + 'theme', fresh.defaultThemeId, true);
            for (const [key, value] of Object.entries(NATIVE_DEFAULTS)) {
              Zotero.Prefs.set(PREFIX + key, value, true);
            }
            init(win);
            status(doc, 'MindFlow 偏好设置已恢复默认值。');
          } catch (error) {
            status(doc, '重置失败：' + error, true);
          }
        };
      }

      if (!paneObservers.has(doc) && Zotero.Prefs.registerObserver) {
        const observer = Zotero.Prefs.registerObserver(ROOT, () => refreshControls(doc), true);
        paneObservers.set(doc, observer);
        win.addEventListener('unload', () => {
          Zotero.Prefs.unregisterObserver?.(observer);
          paneObservers.delete(doc);
        }, { once: true });
      }

      status(doc, '更改会立即保存；已打开的导图工作台在重新获得焦点后更新。');
    } catch (error) {
      Zotero.logError?.('[MindFlow] Preference pane error: ' + error);
      status(win.document, '设置面板加载失败：' + error, true);
    }
  }

  return { init };
})();
