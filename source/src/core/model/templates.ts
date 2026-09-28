import { MindMapNode, LayoutType } from './types';
import { generateId } from './treeOps';

export interface TemplateDefinition {
  id: string;
  title: string;
  description: string;
  category: '通用' | '工作与项目' | '学习与科研' | '思维模型';
  layoutType: LayoutType;
  themeId: string;
  createRoot: () => MindMapNode;
}

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'blank',
    title: '空白思维导图',
    description: '自由发散，从一个中心主题开始无限探索。',
    category: '通用',
    layoutType: 'mindmap',
    themeId: 'classic-blue',
    createRoot: () => ({
      id: generateId(),
      text: '中心主题',
      isExpanded: true,
      children: [
        { id: generateId(), text: '分支主题 1', children: [] },
        { id: generateId(), text: '分支主题 2', children: [] },
      ],
    }),
  },
  {
    id: 'swot',
    title: 'SWOT 战略态势分析',
    description: '经典的战略规划工具：全面剖析优势、劣势、机遇与威胁。',
    category: '思维模型',
    layoutType: 'mindmap',
    themeId: 'classic-blue',
    createRoot: () => ({
      id: generateId(),
      text: '🎯 SWOT 战略分析',
      isExpanded: true,
      children: [
        {
          id: generateId(),
          text: '💪 S - 内部优势 (Strengths)',
          children: [
            { id: generateId(), text: '核心竞争力 / 技术专利', children: [] },
            { id: generateId(), text: '品牌影响力与忠实用户', children: [] },
            { id: generateId(), text: '高效敏捷的组织团队', children: [] },
          ],
        },
        {
          id: generateId(),
          text: '⚠️ W - 内部劣势 (Weaknesses)',
          children: [
            { id: generateId(), text: '资金与资源预算受限', children: [] },
            { id: generateId(), text: '渠道与市场覆盖不足', children: [] },
          ],
        },
        {
          id: generateId(),
          text: '🚀 O - 外部机遇 (Opportunities)',
          children: [
            { id: generateId(), text: '行业新兴蓝海市场', children: [] },
            { id: generateId(), text: '政策利好与数字化扶持', children: [] },
          ],
        },
        {
          id: generateId(),
          text: '🛡️ T - 外部威胁 (Threats)',
          children: [
            { id: generateId(), text: '新晋竞品低价冲击', children: [] },
            { id: generateId(), text: '用户喜好与需求快速转移', children: [] },
          ],
        },
      ],
    }),
  },
  {
    id: 'book-notes',
    title: '深度读书与文献笔记',
    description: '将长篇书籍或重要文献浓缩为高浓度结构化知识网。',
    category: '学习与科研',
    layoutType: 'logic-right',
    themeId: 'forest-green',
    createRoot: () => ({
      id: generateId(),
      text: '📚 书籍 / 论文伴读笔记',
      isExpanded: true,
      children: [
        {
          id: generateId(),
          text: '📌 核心主旨与中心思想',
          children: [
            { id: generateId(), text: '一句话总结本书核心议题', children: [] },
            { id: generateId(), text: '作者试图解决的核心痛点', children: [] },
          ],
        },
        {
          id: generateId(),
          text: '💡 关键论据与核心模型',
          children: [
            { id: generateId(), text: '模型一：底层因果逻辑', children: [] },
            { id: generateId(), text: '模型二：关键实验与证据支撑', children: [] },
          ],
        },
        {
          id: generateId(),
          text: '✨ 精彩引言与启发性金句',
          children: [
            { id: generateId(), text: '颠覆认知的金句摘录', children: [] },
          ],
        },
        {
          id: generateId(),
          text: '⚡ 行动转化与实践清单',
          children: [
            {
              id: generateId(),
              text: '明天起尝试应用的一个微习惯',
              task: { status: 'todo', priority: 1 },
              children: [],
            },
          ],
        },
      ],
    }),
  },
  {
    id: 'project-plan',
    title: '敏捷项目规划与里程碑',
    description: '涵盖目标定位、技术架构、版本迭代排期与风险控制。',
    category: '工作与项目',
    layoutType: 'mindmap',
    themeId: 'classic-blue',
    createRoot: () => ({
      id: generateId(),
      text: '🚀 项目实施路线图',
      isExpanded: true,
      children: [
        {
          id: generateId(),
          text: '🎯 项目愿景与成功指标',
          children: [
            { id: generateId(), text: '核心指标: 活跃留存率提升 30%', children: [] },
            { id: generateId(), text: '交付周期: 3 周内发布 MVP', children: [] },
          ],
        },
        {
          id: generateId(),
          text: '📦 MVP 核心需求拆解',
          children: [
            {
              id: generateId(),
              text: '用户鉴权与基础配置',
              task: { status: 'done', progress: 100 },
              children: [],
            },
            {
              id: generateId(),
              text: '核心功能模块开发',
              task: { status: 'doing', progress: 60 },
              children: [],
            },
            {
              id: generateId(),
              text: '端到端测试与发布',
              task: { status: 'todo' },
              children: [],
            },
          ],
        },
        {
          id: generateId(),
          text: '🛡️ 风险预案与后备策略',
          children: [
            { id: generateId(), text: '第三方 API 依赖降级方案', children: [] },
          ],
        },
      ],
    }),
  },
  {
    id: 'research-paper',
    title: '科研文献综述与论文框架',
    description: '适合硕士/博士/学术研究人员提炼论文框架与答辩提纲。',
    category: '学习与科研',
    layoutType: 'logic-right',
    themeId: 'dark-nebula',
    createRoot: () => ({
      id: generateId(),
      text: '🔬 科研学术论文架构',
      isExpanded: true,
      children: [
        {
          id: generateId(),
          text: '1. 研究背景与核心挑战 (Motivation)',
          children: [
            { id: generateId(), text: '行业现实痛点与现有方法瓶颈', children: [] },
          ],
        },
        {
          id: generateId(),
          text: '2. 理论模型与算法创新 (Methodology)',
          children: [
            { id: generateId(), text: '创新点 A: 算法结构改良', children: [] },
            { id: generateId(), text: '创新点 B: 训练收敛优化', children: [] },
          ],
        },
        {
          id: generateId(),
          text: '3. 实验验证与基准对标 (Experiments)',
          children: [
            { id: generateId(), text: '基线对比与 SOTA 指标提升', children: [] },
            { id: generateId(), text: '消融实验 (Ablation Study)', children: [] },
          ],
        },
        {
          id: generateId(),
          text: '4. 结论与未来展望 (Conclusion)',
          children: [
            { id: generateId(), text: '主要贡献凝练与下一阶段工作', children: [] },
          ],
        },
      ],
    }),
  },
];
