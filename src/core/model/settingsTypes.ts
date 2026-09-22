import { LayoutType } from './types';

export interface WebDAVConfig {
  enabled: boolean;
  serverUrl: string;          // e.g. https://dav.jianguoyun.com/dav/
  basePath: string;           // e.g. /MindFlow/
  username: string;           // Username or email
  password: string;           // Password or App Token
  autoSyncOnSave: boolean;    // Auto backup to WebDAV on save
  lastSyncTime?: number;      // Last sync timestamp
  lastSyncStatus?: 'success' | 'failed';
  lastSyncMessage?: string;
}

export interface ToolbarButtonsConfig {
  history: boolean;       // 撤销 / 重做
  insert: boolean;        // 插入子级 / 同级
  layout: boolean;        // 布局切换
  theme: boolean;         // 主题切换
  outline: boolean;       // 结构大纲
  inbox: boolean;         // 收集箱
  templates: boolean;     // 模板库
  zen: boolean;           // 专注模式
  export: boolean;        // 导出菜单
  zoom: boolean;          // 缩放比例与缩放控制
}

export interface AppSettings {
  // 1. 界面与工具栏定制
  toolbarPosition: 'top' | 'bottom';          // 工具栏位置 (顶部 vs 底部)
  workbenchDockPosition: 'left' | 'right';    // 工作台停靠位置 (左端 vs 右端)
  toolbarButtons: ToolbarButtonsConfig;
  canvasBackground: 'dots' | 'grid' | 'blank'; // 画布背景网格纹理
  zoomStep: number;                            // 缩放步进灵敏度 (0.1 ~ 0.3)

  // 2. 默认偏好
  defaultThemeId: string;                      // 新建导图默认主题 (例如 classic-blue)
  defaultLayout: LayoutType;                   // 新建导图默认布局 (mindmap/logic-right/org-down)
  defaultTaskPriority: 1 | 2 | 3;              // 任务默认优先级 (1=高, 2=中, 3=低)
  autoExpandOnAddChild: boolean;               // 添加子节点时自动展开父节点

  // 3. 数据安全与备份
  autoSnapshotEnabled: boolean;                // 是否开启编辑时自动生成快照
  autoSnapshotIntervalMinutes: number;         // 自动快照最小间隔时间 (分钟)
  maxSnapshotsPerDoc: number;                  // 每个导图保留快照上限 (10~50)

  // 4. WebDAV 云同步配置
  webdav: WebDAVConfig;
}

export const DEFAULT_SETTINGS: AppSettings = {
  toolbarPosition: 'top',
  workbenchDockPosition: 'left',
  toolbarButtons: {
    history: true,
    insert: true,
    layout: true,
    theme: true,
    outline: true,
    inbox: true,
    templates: true,
    zen: true,
    export: true,
    zoom: true,
  },
  canvasBackground: 'dots',
  zoomStep: 0.15,

  defaultThemeId: 'classic-blue',
  defaultLayout: 'mindmap',
  defaultTaskPriority: 2,
  autoExpandOnAddChild: true,

  autoSnapshotEnabled: true,
  autoSnapshotIntervalMinutes: 10,
  maxSnapshotsPerDoc: 20,

  webdav: {
    enabled: false,
    serverUrl: '',
    basePath: '/MindFlow/',
    username: '',
    password: '',
    autoSyncOnSave: false,
  },
};
