export type LayoutType = 'mindmap' | 'logic-right' | 'org-down';

export type NodeShape = 'rounded' | 'pill' | 'rectangle' | 'underline';

export type NodeType = 'topic' | 'text' | 'task' | 'link' | 'image' | 'note';

export type TaskStatus = 'todo' | 'doing' | 'done';

export interface TaskInfo {
  status: TaskStatus;
  priority?: 1 | 2 | 3;
  dueDate?: string;
  progress?: number;
}

export interface InternalNodeLink {
  documentId: string;
  nodeId?: string;
}

export interface MindMapNode {
  id: string;
  text: string;
  type?: NodeType;
  note?: string;
  link?: string;
  internalLink?: InternalNodeLink;
  tags?: string[];
  icons?: string[];
  task?: TaskInfo;
  color?: string;
  textColor?: string;
  shape?: NodeShape;
  isExpanded?: boolean;
  children: MindMapNode[];
}

export interface InboxItem {
  id: string;
  text: string;
  title?: string;
  url?: string;
  favIconUrl?: string;
  createdAt: number;
  isProcessed: boolean;
}

export interface RelationshipLink {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
  style?: 'dashed' | 'solid';
  color?: string;
}

export interface MindMapDocument {
  id: string;
  /** Monotonic local save version. Missing on documents created before versioned saves. */
  revision?: number;
  title: string;
  root: MindMapNode;
  relationships?: RelationshipLink[];
  themeId: string;
  layoutType: LayoutType;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, any>;
}

export interface ThemeColors {
  id: string;
  name: string;
  background: string;
  surface: string;
  text: string;
  nodeBg: string;
  nodeBorder: string;
  nodeText: string;
  rootBg: string;
  rootText: string;
  branchColors: string[];
  lineColor: string;
  isDark: boolean;
}

export interface ViewportTransform {
  x: number;
  y: number;
  scale: number;
}

export interface LayoutNode {
  id: string;
  node: MindMapNode;
  x: number;
  y: number;
  width: number;
  height: number;
  level: number;
  side?: 'left' | 'right' | 'down';
  color: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  shape: NodeShape;
  children: LayoutNode[];
  parent?: LayoutNode;
}

export interface ConnectionCurve {
  id: string;
  fromId: string;
  toId: string;
  path: string;
  color: string;
  strokeWidth: number;
}
