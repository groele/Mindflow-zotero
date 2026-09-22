import { MindMapDocument } from './types';

export function createDefaultDocument(): MindMapDocument {
  return {
    id: 'doc_welcome_default',
    title: 'MindFlow 功能与快捷键指南',
    themeId: 'classic-blue',
    layoutType: 'mindmap',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    root: {
      id: 'root_node',
      text: '🚀 MindFlow 现代思维导图',
      isExpanded: true,
      children: [
        {
          id: 'branch_shortcuts',
          text: '⌨️ 常用快捷键',
          isExpanded: true,
          children: [
            {
              id: 'shortcut_tab',
              text: 'Tab 键：添加子主题',
              tags: ['基础'],
              children: []
            },
            {
              id: 'shortcut_enter',
              text: 'Enter 键：添加同级主题',
              tags: ['基础'],
              children: []
            },
            {
              id: 'shortcut_edit',
              text: 'Space 空格 / 双击：编辑文字',
              children: []
            },
            {
              id: 'shortcut_del',
              text: 'Delete / Backspace：删除主题',
              children: []
            },
            {
              id: 'shortcut_nav',
              text: '↑ ↓ ← → 方向键：自由穿梭漫游',
              children: []
            },
            {
              id: 'shortcut_undo',
              text: 'Ctrl + Z / Ctrl + Y：无限撤销与重做',
              children: []
            }
          ]
        },
        {
          id: 'branch_chrome',
          text: '🌐 Chrome 浏览器专属伴读',
          isExpanded: true,
          children: [
            {
              id: 'feat_sidepanel',
              text: 'Side Panel 侧边栏模式：边看网页边做笔记',
              tags: ['核心特色'],
              children: []
            },
            {
              id: 'feat_capture',
              text: '网页划词右键：快速摘录至导图',
              children: []
            },
            {
              id: 'feat_fullscreen',
              text: '沉浸全屏 Tab：开启大画布深度创作',
              children: []
            },
            {
              id: 'feat_privacy',
              text: '100% 本地存储：数据不离开电脑，隐私安全',
              children: []
            }
          ]
        },
        {
          id: 'branch_design',
          text: '🎨 视觉与主流布局',
          isExpanded: true,
          children: [
            {
              id: 'design_layouts',
              text: '三种布局结构',
              children: [
                { id: 'layout_1', text: '思维导图（左右平衡分布）', children: [] },
                { id: 'layout_2', text: '逻辑图（向右单向展开）', children: [] },
                { id: 'layout_3', text: '组织结构图（自顶向下）', children: [] }
              ]
            },
            {
              id: 'design_themes',
              text: '精美主题预设',
              children: [
                { id: 'theme_1', text: '经典商务蓝', children: [] },
                { id: 'theme_2', text: '马卡龙缤纷', children: [] },
                { id: 'theme_3', text: '极夜星云 (深色模式)', children: [] },
                { id: 'theme_4', text: '松柏青绿 / 水墨', children: [] }
              ]
            }
          ]
        },
        {
          id: 'branch_export',
          text: '📦 多维导入与导出',
          isExpanded: true,
          children: [
            {
              id: 'exp_png',
              text: '高清 PNG 图片导出（可直接分享）',
              children: []
            },
            {
              id: 'exp_svg',
              text: '矢量 SVG 导出（无损放大）',
              children: []
            },
            {
              id: 'exp_md',
              text: 'Markdown 导出 / 导入（兼容 Obsidian）',
              children: []
            },
            {
              id: 'exp_json',
              text: 'JSON 工程文件备份与还原',
              children: []
            }
          ]
        }
      ]
    }
  };
}
