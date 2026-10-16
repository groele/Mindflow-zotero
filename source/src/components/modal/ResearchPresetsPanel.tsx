import React, { useLayoutEffect, useState } from 'react';
import { THEMES } from '../../core/theme/themes';
import { ResearchPresetService, builtinResearchPrompts, builtinResearchPresentations,
  MAX_RESEARCH_PROMPT_LENGTH, type ResearchPresetConfig } from '../../services/zotero/researchPresets';
import type { LayoutType } from '../../core/model/types';

interface Props { isOpen: boolean; value: ResearchPresetConfig; onChange: (value: ResearchPresetConfig) => void }
export const ResearchPresetsPanel: React.FC<Props> = ({ isOpen, value, onChange }) => {
  const [store, setStore] = useState<ReturnType<typeof ResearchPresetService.read>>({ version: 1, defaultId: '', presets: [] });
  const [selectedId, setSelectedId] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const run = (action: () => void) => {
    try { action(); setFailed(false); } catch (error) { setFailed(true); setMessage(String((error as Error).message)); }
  };
  useLayoutEffect(() => {
    if (!isOpen) return;
    run(() => {
      const next = ResearchPresetService.read(); setStore(next);
      const preset = next.presets.find(p => p.id === next.defaultId);
      setSelectedId(preset?.id || ''); setName(preset?.name || ''); setMessage('');
      if (preset) onChange(preset);
    });
  }, [isOpen]);
  const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-800';
  const buttonClass = 'rounded-lg border border-slate-300 px-3 py-1.5 text-xs disabled:opacity-40 dark:border-slate-600';
  const presentationId = builtinResearchPresentations.find(p => JSON.stringify(p.value) === JSON.stringify(value.presentation))?.id || 'custom';
  return <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
    <legend className="px-1 font-semibold text-slate-900 dark:text-white">提示词与呈现预设</legend>
    <p className="text-xs leading-5 text-slate-500">保存“内容模板＋补充提示词＋主题与布局”，下次可直接复用。默认沿用当前导图外观。</p>
    <label className="block text-xs">我的预设
      <select aria-label="我的导图预设" className={inputClass} value={selectedId} onChange={e => run(() => {
        const next = ResearchPresetService.read(); setStore(next);
        const preset = next.presets.find(p => p.id === e.target.value);
        setSelectedId(preset?.id || ''); setName(preset?.name || ''); setMessage('');
        if (preset) onChange(preset);
      })}>
        <option value="">本次自定义</option>
        {store.presets.map(p => <option key={p.id} value={p.id}>{p.name}{store.defaultId === p.id ? '（默认）' : ''}</option>)}
      </select>
    </label>
    <label className="block text-xs">提示词范例
      <select aria-label="提示词范例" className={inputClass} value={builtinResearchPrompts.find(p => p.text === value.customPrompt)?.id || 'custom'}
        onChange={e => { const prompt = builtinResearchPrompts.find(p => p.id === e.target.value); if (prompt) onChange({ ...value, customPrompt: prompt.text }); }}>
        {builtinResearchPrompts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}<option value="custom" disabled>自定义提示词</option>
      </select>
    </label>
    <label className="block text-xs">补充提示词
      <textarea aria-label="补充提示词" rows={4} maxLength={MAX_RESEARCH_PROMPT_LENGTH} value={value.customPrompt}
        onChange={e => onChange({ ...value, customPrompt: e.target.value })} className={inputClass}
        placeholder="例如：重点分析材料体系、温度依赖和对照实验，保留数值、单位与原文线索。" />
    </label>
    <p className="text-xs text-slate-500">{value.customPrompt.length}/{MAX_RESEARCH_PROMPT_LENGTH} 字符。补充提示词随所选资料发送给模型；不改变读取范围、证据规则和 JSON 格式。</p>
    <label className="block text-xs">呈现模板
      <select aria-label="呈现模板" className={inputClass} value={presentationId} onChange={e => {
        const chosen = builtinResearchPresentations.find(p => p.id === e.target.value);
        onChange({ ...value, presentation: chosen ? chosen.value : { themeId: 'classic-blue', layoutType: 'mindmap' } });
      }}>
        {builtinResearchPresentations.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}<option value="custom">自选主题与布局</option>
      </select>
    </label>
    {value.presentation && <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs">主题<select aria-label="预设主题" className={inputClass} value={value.presentation.themeId}
        onChange={e => onChange({ ...value, presentation: { ...value.presentation!, themeId: e.target.value } })}>
        {Object.values(THEMES).map(theme => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
      </select></label>
      <label className="text-xs">布局<select aria-label="预设布局" className={inputClass} value={value.presentation.layoutType}
        onChange={e => onChange({ ...value, presentation: { ...value.presentation!, layoutType: e.target.value as LayoutType } })}>
        <option value="mindmap">双侧思维导图</option><option value="logic-right">向右逻辑图</option><option value="org-down">向下层级图</option>
      </select></label>
    </div>}
    <label className="block text-xs">预设名称<input aria-label="预设名称" maxLength={60} value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="例如：我的论文精读" /></label>
    <div className="flex flex-wrap gap-2">
      <button type="button" className={buttonClass} disabled={!name.trim()} onClick={() => run(() => {
        const next = ResearchPresetService.save(name, value); setStore(next); setSelectedId(next.presets[next.presets.length - 1].id); setMessage('已另存为新预设。');
      })}>另存为新预设</button>
      <button type="button" className={buttonClass} disabled={!selectedId || !name.trim()} onClick={() => run(() => {
        setStore(ResearchPresetService.save(name, value, selectedId)); setMessage('已更新预设。');
      })}>更新所选预设</button>
      <button type="button" className={buttonClass} disabled={!selectedId} onClick={() => run(() => {
        setStore(ResearchPresetService.setDefault(selectedId)); setMessage('下次打开分析窗口时自动载入已保存的默认预设；未保存的修改不会设为默认。');
      })}>设为默认</button>
      <button type="button" className={buttonClass} disabled={!store.defaultId} onClick={() => run(() => {
        setStore(ResearchPresetService.setDefault('')); setMessage('已取消默认预设。');
      })}>取消默认</button>
      <button type="button" className={buttonClass} disabled={!selectedId} onClick={() => run(() => {
        setStore(ResearchPresetService.remove(selectedId)); setSelectedId(''); setMessage('已删除预设；本次填写内容仍保留。');
      })}>删除预设</button>
    </div>
    {message && <p role={failed ? 'alert' : 'status'} className={failed ? 'text-xs text-red-600' : 'text-xs text-emerald-700 dark:text-emerald-400'}>{message}</p>}
  </fieldset>;
};
