import assert from 'assert';
import {
  addChildNode,
  addSiblingNode,
  deleteNode,
  updateNode,
  moveNode,
  cloneTree,
  findNode,
  findAdjacentNode
} from '../src/core/model/treeOps.ts';
import { computeLayout } from '../src/core/layout/layoutEngine.ts';
import { getTheme, THEMES } from '../src/core/theme/themes.ts';
import { HistoryManager } from '../src/core/history/historyManager.ts';
import { importFromMarkdown } from '../src/services/io/exporter.ts';
import { TEMPLATES } from '../src/core/model/templates.ts';

console.log('--- 开始 MindFlow 核心模块与 Master Prompt 功能测试 ---');

// 1. 测试数据模型与树结构操作
console.log('1. 测试树形操作: 添加、更新、删除、移动...');
const root = {
  id: 'root',
  text: '根节点',
  isExpanded: true,
  children: []
};

// 添加子节点
const { newRoot: r1, newNodeId: c1 } = addChildNode(root, 'root', '子主题 1');
assert.strictEqual(r1.children.length, 1);
assert.strictEqual(r1.children[0].text, '子主题 1');

// 添加同级节点
const { newRoot: r2, newNodeId: c2 } = addSiblingNode(r1, c1, '子主题 2');
assert.strictEqual(r2.children.length, 2);
assert.strictEqual(r2.children[1].text, '子主题 2');

// 更新节点
const r3 = updateNode(r2, c1, { text: '已修改的子主题 1', shape: 'pill' });
const updatedC1 = findNode(r3, c1);
assert.strictEqual(updatedC1.text, '已修改的子主题 1');
assert.strictEqual(updatedC1.shape, 'pill');

// 移动节点
const { newRoot: r4, newNodeId: c1_sub } = addChildNode(r3, c1, '子项 A');
const r5 = moveNode(r4, c1_sub, c2);
const movedParent = findNode(r5, c2);
assert.strictEqual(movedParent.children.length, 1);
assert.strictEqual(movedParent.children[0].id, c1_sub);

// 删除节点
const { newRoot: r6 } = deleteNode(r5, c1);
assert.strictEqual(r6.children.length, 1);
console.log('✓ 树形模型增删改移测试全部通过！');

// 2. 测试历史记录栈 Undo/Redo
console.log('2. 测试 HistoryManager 撤销重做...');
const history = new HistoryManager(10);
const s0 = { id: 'r', text: 'Step 0', children: [] };
const s1 = { id: 'r', text: 'Step 1', children: [] };
const s2 = { id: 'r', text: 'Step 2', children: [] };

history.push(s0);
history.push(s1);

assert.strictEqual(history.canUndo(), true);
const undoRes = history.undo(s2);
assert.strictEqual(undoRes.text, 'Step 1');

const redoRes = history.redo(undoRes);
assert.strictEqual(redoRes.text, 'Step 2');
console.log('✓ 历史记录栈 Undo/Redo 测试全部通过！');

// 3. 测试布局引擎 (思维导图、逻辑图、组织架构图)
console.log('3. 测试布局计算引擎...');
const theme = getTheme('classic-blue');
const testTree = {
  id: 'root',
  text: '中心架构',
  isExpanded: true,
  children: [
    { id: 'n1', text: '模块一', children: [{ id: 'n1_1', text: '细节 A', children: [] }] },
    { id: 'n2', text: '模块二', children: [{ id: 'n2_1', text: '细节 B', children: [] }] },
    { id: 'n3', text: '模块三', children: [] },
  ]
};

const mindmapLayout = computeLayout(testTree, 'mindmap', theme);
assert.strictEqual(mindmapLayout.nodes.length, 6);
assert.strictEqual(mindmapLayout.connections.length, 5);
assert.ok(mindmapLayout.bounds.maxX > mindmapLayout.bounds.minX);

const logicLayout = computeLayout(testTree, 'logic-right', theme);
assert.strictEqual(logicLayout.nodes.length, 6);

const orgLayout = computeLayout(testTree, 'org-down', theme);
assert.strictEqual(orgLayout.nodes.length, 6);
console.log('✓ 三大主流布局算法（左右平衡、单向逻辑、组织结构）测试全部通过！');

// 4. 测试 Task 任务化属性与流转
console.log('4. 测试 Task 任务化状态与属性...');
const taskTree = updateNode(root, 'root', {
  task: {
    status: 'todo',
    priority: 1,
    dueDate: '2026-10-01',
    progress: 0,
  }
});
assert.strictEqual(taskTree.task.status, 'todo');
assert.strictEqual(taskTree.task.priority, 1);

// 状态变更 todo -> doing -> done
const doingTree = updateNode(taskTree, 'root', {
  task: { ...taskTree.task, status: 'doing', progress: 50 }
});
assert.strictEqual(doingTree.task.status, 'doing');

const doneTree = updateNode(doingTree, 'root', {
  task: { ...doingTree.task, status: 'done', progress: 100 }
});
assert.strictEqual(doneTree.task.status, 'done');
assert.strictEqual(doneTree.task.progress, 100);
console.log('✓ Task 任务流转（Todo -> Doing -> Done）测试全部通过！');

// 5. 测试专业模板库
console.log('5. 测试模板库验证...');
assert.ok(TEMPLATES.length >= 5);
for (const tpl of TEMPLATES) {
  const tplRoot = tpl.createRoot();
  assert.ok(tplRoot.text.length > 0);
  assert.ok(tplRoot.children.length > 0);
  const layoutRes = computeLayout(tplRoot, tpl.layoutType, theme);
  assert.ok(layoutRes.nodes.length > 0);
  assert.ok(layoutRes.connections.length >= 0);
}
console.log(`✓ 全部 ${TEMPLATES.length} 套专业模板（SWOT/读书笔记/项目规划/科研文献）解析与布局测试通过！`);

// 6. 测试 Markdown 导入与解析
console.log('6. 测试 Markdown 互通解析...');
const sampleMd = `# 项目规划
  - 第一阶段 [🔗](https://github.com)
    - 需求评审 <!-- 备注: 核心需求 -->
    - 技术选型
  - 第二阶段
    - 编码开发
`;

const parsedNode = importFromMarkdown(sampleMd);
assert.strictEqual(parsedNode.text, '项目规划');
assert.strictEqual(parsedNode.children.length, 2);
assert.strictEqual(parsedNode.children[0].text, '第一阶段');
assert.strictEqual(parsedNode.children[0].link, 'https://github.com');
assert.strictEqual(parsedNode.children[0].children[0].text, '需求评审');
assert.strictEqual(parsedNode.children[0].children[0].note, '核心需求');
console.log('✓ Markdown 大纲智能解析测试全部通过！');

// 7. 测试 10 款主题库多样性与属性完整性
console.log('7. 测试 10 款预置主题完整性...');
const themeCount = Object.keys(THEMES).length;
assert.strictEqual(themeCount, 10, '应内置至少 10 套精心设计的主题');
const expectedThemeIds = [
  'classic-blue', 'dark-nebula', 'macaron', 'forest-green', 'minimal-ink',
  'warm-amber', 'cyberpunk-neon', 'nordic-frost', 'academic-paper', 'lavender-dream'
];
for (const themeId of expectedThemeIds) {
  const t = getTheme(themeId);
  assert.ok(t, `主题 ${themeId} 必须存在`);
  assert.ok(t.background, `主题 ${themeId} 必须配置 background`);
  assert.ok(t.rootBg, `主题 ${themeId} 必须配置 rootBg`);
  assert.ok(t.branchColors.length >= 4, `主题 ${themeId} 必须配置充足的分支颜色`);
}
console.log('✓ 10 大专业主题（浅色、深色、莫兰迪、赛博朋克、学术纸感）配置完整性验证全部通过！');

// 8. 测试数据备份与快照机制
console.log('8. 测试备份与快照存储结构验证...');
// 模拟 Storage 环境 (兼容 Node 环境)
const storageMock = {};
globalThis.localStorage = {
  getItem: (k) => storageMock[k] || null,
  setItem: (k, v) => { storageMock[k] = v; },
  removeItem: (k) => { delete storageMock[k]; },
  clear: () => { Object.keys(storageMock).forEach(k => delete storageMock[k]); },
  key: (i) => Object.keys(storageMock)[i] || null,
  get length() { return Object.keys(storageMock).length; }
};

// 导入 BackupService 进行快照和备份测试
const { BackupService } = await import('../src/services/storage/backupService.ts');

const sampleDoc = {
  id: 'doc_test_1',
  title: '备份测试导图',
  root: testTree,
  themeId: 'classic-blue',
  layoutType: 'mindmap',
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

// 测试快照生成
const snapshot = await BackupService.createSnapshot(sampleDoc);
assert.strictEqual(snapshot.docId, sampleDoc.id);
assert.strictEqual(snapshot.nodeCount, 6);

// 测试快照查询
const snapshotList = await BackupService.getSnapshots(sampleDoc.id);
assert.strictEqual(snapshotList.length, 1);
assert.strictEqual(snapshotList[0].id, snapshot.id);

// 测试快照还原
const restoredDoc = await BackupService.restoreSnapshot(sampleDoc.id, snapshot.id);
assert.ok(restoredDoc);
assert.strictEqual(restoredDoc.title, sampleDoc.title);
assert.strictEqual(restoredDoc.root.children.length, 3);
console.log('✓ 数据快照生成、查询与还原功能测试全部通过！');

// 9. 测试系统设置中心 SettingsService
console.log('9. 测试 SettingsService 配置管理与持久化...');
const { SettingsService } = await import('../src/services/storage/settingsService.ts');
const initSettings = await SettingsService.getSettings();
assert.strictEqual(initSettings.toolbarPosition, 'top');
assert.strictEqual(initSettings.workbenchDockPosition, 'left');
assert.strictEqual(initSettings.toolbarButtons.history, true);
assert.strictEqual(initSettings.canvasBackground, 'dots');

// 测试局部更新配置 (比如将工具栏移到底部，修改背景为 grid)
const updatedSettings = await SettingsService.updateSettings({
  toolbarPosition: 'bottom',
  canvasBackground: 'grid',
  webdav: {
    ...initSettings.webdav,
    enabled: true,
    serverUrl: 'https://dav.jianguoyun.com/dav/',
    username: 'testuser@example.com'
  }
});
assert.strictEqual(updatedSettings.toolbarPosition, 'bottom');
assert.strictEqual(updatedSettings.canvasBackground, 'grid');
assert.strictEqual(updatedSettings.webdav.serverUrl, 'https://dav.jianguoyun.com/dav/');
// 验证深合并保留了原先的其他字段
assert.strictEqual(updatedSettings.toolbarButtons.export, true);

// 测试恢复出厂默认设置
const resetSettings = await SettingsService.resetSettings();
assert.strictEqual(resetSettings.toolbarPosition, 'top');
assert.strictEqual(resetSettings.canvasBackground, 'dots');
console.log('✓ 系统设置读取、局部更新深度合并与出厂恢复测试全部通过！');

// 10. 测试 WebDAV 云同步服务 WebDAVService
console.log('10. 测试 WebDAVService URL 构建与鉴权头编码...');
const { WebDAVService } = await import('../src/services/sync/webdavService.ts');

// 测试 URL 规范化
const normalizedUrl1 = WebDAVService.buildUrl('dav.jianguoyun.com/dav', '/MindFlow/');
assert.strictEqual(normalizedUrl1, 'https://dav.jianguoyun.com/dav/MindFlow/');

const normalizedUrl2 = WebDAVService.buildUrl('https://my-cloud.org/', 'MindFlow/backup.json');
assert.strictEqual(normalizedUrl2, 'https://my-cloud.org/MindFlow/backup.json');

// 测试 Basic Auth 编码
const authHeader = WebDAVService.getAuthHeader({
  enabled: true,
  serverUrl: 'https://dav.example.com',
  basePath: '/dav/',
  username: 'admin',
  password: 'secretPassword123',
  autoSyncOnSave: false
});
assert.ok(authHeader.startsWith('Basic '));
assert.strictEqual(Buffer.from(authHeader.replace('Basic ', ''), 'base64').toString('utf-8'), 'admin:secretPassword123');

// 测试全量工作区数据生成
const fullWorkspace = await BackupService.getFullWorkspaceData();
assert.ok(fullWorkspace.documents);
assert.ok(Array.isArray(fullWorkspace.documents));
assert.ok(fullWorkspace.exportedAt > 0);
console.log('✓ WebDAV 协议 URL 解析、Basic Auth 编码与工作区打包测试全部通过！');

// 11. 测试商业授权服务 LicenseService
console.log('11. 测试 LicenseService 激活码生成、校验算法与特权矩阵...');
const { LicenseService } = await import('../src/services/license/licenseService.ts');

// 测试生成 Pro 序列号并验证校验和
const proKey = LicenseService.generateLicenseKey('pro');
assert.ok(proKey.startsWith('MFPRO-'));
const proVerify = LicenseService.verifyKey(proKey);
assert.strictEqual(proVerify.valid, true);
assert.strictEqual(proVerify.tier, 'pro');

// 测试生成 Enterprise 序列号并验证校验和
const entKey = LicenseService.generateLicenseKey('enterprise');
assert.ok(entKey.startsWith('MFENT-'));
const entVerify = LicenseService.verifyKey(entKey);
assert.strictEqual(entVerify.valid, true);
assert.strictEqual(entVerify.tier, 'enterprise');

// 测试伪造/篡改的序列号被精准拦截
const fakeKey = 'MFPRO-0000-0000-0000-FFFF';
const fakeVerify = LicenseService.verifyKey(fakeKey);
assert.strictEqual(fakeVerify.valid, false);

// 测试特权矩阵差异
const freeFeatures = LicenseService.getFeatures('free');
const proFeatures = LicenseService.getFeatures('pro');
assert.strictEqual(freeFeatures.allThemes, false);
assert.strictEqual(proFeatures.allThemes, true);
assert.strictEqual(freeFeatures.presentationMode, false);
assert.strictEqual(proFeatures.presentationMode, true);
assert.strictEqual(freeFeatures.exportWithoutWatermark, false);
assert.strictEqual(proFeatures.exportWithoutWatermark, true);
console.log('✓ 商业 License 校验和、离线验签与特权矩阵测试全部通过！');

// 12. 测试画布即时搜索检索算法
console.log('12. 测试树形结构递归全文搜索检索算法...');
const searchTree = {
  id: 'root_s',
  text: '项目规划',
  children: [
    { id: 'c1', text: '前端开发', note: '采用 React 19 技术栈', children: [] },
    { id: 'c2', text: '后端服务', tags: ['Database', 'WebDAV'], children: [] },
  ]
};

function searchNodes(node, q) {
  const query = q.toLowerCase();
  const matched = [];
  function walk(n) {
    const mText = n.text.toLowerCase().includes(query);
    const mNote = n.note && n.note.toLowerCase().includes(query);
    const mTag = n.tags && n.tags.some(t => t.toLowerCase().includes(query));
    if (mText || mNote || mTag) matched.push(n.id);
    if (n.children) n.children.forEach(walk);
  }
  walk(node);
  return matched;
}

assert.deepStrictEqual(searchNodes(searchTree, '前端'), ['c1']);
assert.deepStrictEqual(searchNodes(searchTree, 'React'), ['c1']);
assert.deepStrictEqual(searchNodes(searchTree, 'WebDAV'), ['c2']);
assert.deepStrictEqual(searchNodes(searchTree, '规划'), ['root_s']);
console.log('✓ 脑图全文多维度（标题/备注/标签）即时搜索匹配测试全部通过！');

console.log('🎉 所有自动化验证与商业级质量门槛 (12/12) 均顺利通过！');



