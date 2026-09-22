import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcutGroups = [
    {
      category: '节点结构与操作',
      items: [
        { keys: ['Tab'], desc: '插入子主题（Child Node）' },
        { keys: ['Enter'], desc: '插入同级主题（Sibling Node）' },
        { keys: ['Shift', 'Enter'], desc: '在上方/前方插入同级主题' },
        { keys: ['Ctrl / Cmd', 'C'], desc: '复制选中主题分支' },
        { keys: ['Ctrl / Cmd', 'V'], desc: '粘贴分支到当前节点下' },
        { keys: ['Ctrl / Cmd', 'D'], desc: '一键创建副本 (Duplicate)' },
        { keys: ['Delete / Backspace'], desc: '删除当前选中主题（支持批量）' },
        { keys: ['Space 空格 / 双击'], desc: '就地进入内联文字编辑模式' },
        { keys: ['Enter (编辑中)'], desc: '提交并保存文字修改' },
        { keys: ['Esc (编辑中)'], desc: '取消编辑并恢复原文字' },
      ],
    },
    {
      category: '画布漫游与多选',
      items: [
        { keys: ['Shift + 鼠标拖拽'], desc: '拉出半透明选框，批量多选节点' },
        { keys: ['↑', '↓', '←', '→'], desc: '在相邻节点间空间穿梭游走' },
        { keys: ['Ctrl', '鼠标滚轮'], desc: '以鼠标指针为中心平滑缩放' },
        { keys: ['双指捏合'], desc: '触控板手势平滑缩放' },
        { keys: ['空格 + 拖拽'], desc: '按住空格键并拖动画布平移' },
        { keys: ['鼠标中键拖拽'], desc: '任意平移无限画布' },
        { keys: ['拖拽节点卡片'], desc: '重新挂载重排节点归属' },
      ],
    },
    {
      category: '历史记录与其它',
      items: [
        { keys: ['Ctrl / Cmd', 'Z'], desc: '撤销上一步操作 (Undo)' },
        { keys: ['Ctrl / Cmd', 'Y'], desc: '重做上一步操作 (Redo)' },
        { keys: ['右键网页划词'], desc: 'Chrome 浏览器专属：快速摘录到导图' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-base">
            <Keyboard className="w-5 h-5 text-blue-600" />
            <span>全键盘操作指南与快捷键</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6 text-xs">
          {shortcutGroups.map((group) => (
            <div key={group.category}>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
                {group.category}
              </h4>
              <div className="space-y-2">
                {group.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">
                      {item.desc}
                    </span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((k) => (
                        <kbd
                          key={k}
                          className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md font-mono text-[11px] text-slate-700 dark:text-slate-200 shadow-sm"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-xs shadow-sm transition-colors"
          >
            知道了
          </button>
        </div>
      </div>
    </div>
  );
};
