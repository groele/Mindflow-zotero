# 📊 MindFlow 数据模型规范 (DATA_MODEL.md)

## 1. 核心实体模型

### 1.1 MapDocument (导图文档实体)
```typescript
interface MindMapDocument {
  id: string;             // 唯一文档 ID ('doc_xxx')
  title: string;          // 文档标题
  root: MindMapNode;      // 根节点
  themeId: string;        // 主题配色 ID
  layoutType: LayoutType; // 'mindmap' | 'logic-right' | 'org-down'
  createdAt: number;      // 创建时间戳
  updatedAt: number;      // 最后修改时间戳
  metadata?: Record<string, any>;
}
```

### 1.2 MindMapNode (思维导图节点)
```typescript
type NodeType = 'topic' | 'text' | 'task' | 'link' | 'image' | 'note';

interface TaskInfo {
  status: 'todo' | 'doing' | 'done'; // 任务状态流转
  priority?: 1 | 2 | 3;             // 优先级
  dueDate?: string;                 // 截止日期 YYYY-MM-DD
  progress?: number;                // 完成进度 0 - 100
}

interface MindMapNode {
  id: string;               // 唯一节点 ID ('node_xxx')
  text: string;             // 主题文字
  type?: NodeType;          // 节点类型（默认 'topic'）
  note?: string;            // 长文本备注/详细注释
  link?: string;            // 网页超链接
  tags?: string[];          // 标签数组 (e.g. ['待办', '重点'])
  icons?: string[];         // 标牌徽章 (e.g. ['star', 'flag'])
  task?: TaskInfo;          // 结构化任务信息
  color?: string;           // 自定义主题分支/边框高亮色
  textColor?: string;       // 文字自定义色
  shape?: NodeShape;        // 'rounded' | 'pill' | 'rectangle' | 'underline'
  isExpanded?: boolean;     // 子树展开折叠状态
  children: MindMapNode[];  // 子节点列表
}
```

### 1.3 InboxItem (浏览器快速收集箱实体)
```typescript
interface InboxItem {
  id: string;               // 'inbox_xxx'
  text: string;             // 捕获的文本内容/灵感
  title?: string;           // 网页标题
  url?: string;             // 来源网页网址
  favIconUrl?: string;      // 网站图标
  createdAt: number;        // 捕获时间戳
  isProcessed: boolean;     // 是否已整理入导图
}
```
