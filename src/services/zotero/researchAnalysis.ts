import { MindMapDocument, MindMapNode } from '../../core/model/types';
import { generateId } from '../../core/model/treeOps';
import { getZoteroInstance } from './zoteroBridge';

type SectionKey = 'background' | 'gap' | 'question' | 'system' | 'method' |
  'findings' | 'resolution' | 'significance' | 'limitations' | 'nextSteps';

interface ResearchClaim {
  text: string;
  detail: string;
  basis: 'paper' | 'inference' | 'unresolved';
  source: 'abstract' | 'pdf' | 'note' | 'annotation' | 'none';
  quote: string;
  link?: string;
  pageLabel?: string;
}

export interface ResearchInputPreview {
  preparedId: string;
  title: string;
  zoteroUri: string;
  model: string;
  endpointHost: string;
  localModel: boolean;
  archiveState: string;
  quickCalls: number;
  deepCalls: number;
  estimatedCharacters: number;
  sourceScope: ResearchAnalysis['sourceScope'] & {
    omittedNotes: number;
    omittedAnnotations: number;
    pdfCharacters: number;
    maxPages: number;
  };
}

export interface ResearchProgress {
  phase: string;
  completed: number;
  total: number;
}

export interface ResearchRequestOptions {
  preparedId?: string;
  mode?: 'quick' | 'deep';
  signal?: AbortSignal;
  onProgress?: (progress: ResearchProgress) => void;
}

export interface ResearchAnalysis {
  title: string;
  zoteroUri: string;
  libraryID?: number;
  sourceScope: {
    pdfState: string;
    pdfTruncated: boolean;
    hasAbstract: boolean;
    noteCount: number;
    annotationCount: number;
    analysisMode?: 'quick' | 'deep';
    quickSampled?: boolean;
    model?: string;
    endpointHost?: string;
  };
  sections: Record<SectionKey, ResearchClaim[]>;
}

const SECTION_LABELS: Array<[SectionKey, string]> = [
  ['background', '研究背景与领域现状'],
  ['gap', '已有问题与知识缺口'],
  ['question', '研究目标与核心问题'],
  ['system', '研究体系与对象'],
  ['method', '研究方法与实验设计'],
  ['findings', '关键结果与证据'],
  ['resolution', '解决了什么问题'],
  ['significance', '创新与研究意义'],
  ['limitations', '局限与未解决问题'],
  ['nextSteps', '后续验证与研究方向'],
];

function requestFromHost<T>(type: 'MINDFLOW_PREPARE_PAPER' | 'MINDFLOW_ANALYZE_PAPER',
  reference: string, options: ResearchRequestOptions = {}): Promise<T> {
  if (typeof window === 'undefined' || window.parent === window) {
    throw new Error('未检测到 Zotero AI 分析通道。');
  }
  return new Promise<T>((resolve, reject) => {
    const requestId = `mindflow-ai-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const resultType = `${type}_RESULT`;
    let settled = false;
    const cancelHost = () => {
      if (type === 'MINDFLOW_ANALYZE_PAPER') {
        window.parent.postMessage({ type: 'MINDFLOW_CANCEL_PAPER', requestId }, '*');
      }
    };
    const finish = (error?: Error, result?: T) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onMessage);
      options.signal?.removeEventListener('abort', onAbort);
      window.clearTimeout(timeout);
      if (error) reject(error);
      else if (result) resolve(result);
      else reject(new Error('Zotero 未返回分析结果。'));
    };
    const onAbort = () => { cancelHost(); finish(new Error('AI 分析已取消；未创建或归档导图。')); };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      const data = event.data;
      if (data?.requestId !== requestId) return;
      if (data.type === 'MINDFLOW_ANALYZE_PAPER_PROGRESS') {
        options.onProgress?.({ phase: String(data.phase || ''),
          completed: Number(data.completed) || 0, total: Number(data.total) || 1 });
        return;
      }
      if (data.type !== resultType) return;
      finish(data.error ? new Error(String(data.error)) : undefined, data.result);
    };
    const timeout = window.setTimeout(() => {
      cancelHost();
      finish(new Error('等待论文分析超时，请检查模型服务后重试。'));
    }, type === 'MINDFLOW_ANALYZE_PAPER' ? 900000 : 180000);
    window.addEventListener('message', onMessage);
    options.signal?.addEventListener('abort', onAbort, { once: true });
    if (options.signal?.aborted) { onAbort(); return; }
    try { window.parent.postMessage({ type, requestId, reference,
      preparedId: options.preparedId, mode: options.mode }, '*'); }
    catch { finish(new Error('无法向 Zotero 主窗口发送 AI 分析请求。')); }
  });
}

export async function prepareResearchAnalysis(reference: string,
  signal?: AbortSignal): Promise<ResearchInputPreview> {
  if (typeof window !== 'undefined' && window.parent !== window) {
    return requestFromHost<ResearchInputPreview>('MINDFLOW_PREPARE_PAPER', reference, { signal });
  }
  const zotero = getZoteroInstance();
  if (zotero?.MindFlow?.preparePaperAnalysis) {
    if (signal?.aborted) throw new Error('AI 分析已取消。');
    return zotero.MindFlow.preparePaperAnalysis(reference) as Promise<ResearchInputPreview>;
  }
  return requestFromHost<ResearchInputPreview>('MINDFLOW_PREPARE_PAPER', reference, { signal });
}

export async function requestResearchAnalysis(reference: string,
  options: ResearchRequestOptions = {}): Promise<ResearchAnalysis> {
  if (typeof window !== 'undefined' && window.parent !== window) {
    return requestFromHost<ResearchAnalysis>('MINDFLOW_ANALYZE_PAPER', reference, options);
  }
  const zotero = getZoteroInstance();
  if (zotero?.MindFlow?.analyzePaperWithAI) {
    return zotero.MindFlow.analyzePaperWithAI(reference, {
      ...options,
      onProgress: (phase: string, completed: number, total: number) =>
        options.onProgress?.({ phase, completed, total }),
    }) as Promise<ResearchAnalysis>;
  }
  return requestFromHost<ResearchAnalysis>('MINDFLOW_ANALYZE_PAPER', reference, options);
}

export function createResearchDocument(analysis: ResearchAnalysis, themeId: string): MindMapDocument {
  if (!analysis || typeof analysis.title !== 'string' || typeof analysis.zoteroUri !== 'string' ||
      !analysis.sections || typeof analysis.sections !== 'object') {
    throw new Error('AI 研究分析结果格式无效。');
  }
  const scope = analysis.sourceScope;
  const headline = (key: SectionKey, label: string) => {
    const claim = Array.isArray(analysis.sections[key]) ? analysis.sections[key][0] : null;
    if (!claim?.text) return `${label}：资料不足，待补充`;
    return `${label}（${claim.basis === 'paper' ? '有原文片段' : '待核验'}）：${claim.text}`;
  };
  const rootNote = [
    'AI 辅助论文分析；请依据原文复核。',
    '速读提要：',
    headline('question', '研究目的'),
    headline('system', '研究体系'),
    headline('resolution', '解决的问题'),
    headline('significance', '研究意义'),
    '',
    `资料范围：${scope?.pdfState || 'PDF 状态未知'}；摘要${scope?.hasAbstract ? '可用' : '不可用'}；` +
      `笔记 ${scope?.noteCount || 0} 条；批注 ${scope?.annotationCount || 0} 条。`,
    scope?.pdfTruncated ? 'PDF 文字超出本次读取范围或经过跨区间采样，部分内容仍可能未纳入分析。' : '',
    scope?.quickSampled ? '本次为快速模式，PDF 文字仅取跨区间节选。' : '',
    '【原文支持】仅表示短引文与摘要、PDF 文字或批注划线原文匹配，不等于结论已被独立验证。',
    '【推断/待核验】是分析线索，不能当成论文已证明的事实。',
  ].filter(Boolean).join('\n');
  let claimCount = 0;
  const branches: MindMapNode[] = SECTION_LABELS.map(([key, label]) => {
    const claims = Array.isArray(analysis.sections[key]) ? analysis.sections[key].slice(0, 5) : [];
    const children: MindMapNode[] = claims
      .filter((claim) => claim && typeof claim.text === 'string' && claim.text.trim())
      .map((claim) => {
        claimCount += 1;
        const paper = claim.basis === 'paper' && Boolean(claim.quote);
        const prefix = paper ? '【原文支持】' : claim.basis === 'unresolved' ? '【待解决】' : '【推断/待核验】';
        const sourceLabel: Record<string, string> = {
          abstract: '摘要', pdf: 'PDF 文字节选', note: 'Zotero 笔记', annotation: 'Zotero 批注', none: '无直接引文',
        };
        return {
          id: generateId(),
          text: `${prefix}${claim.text.trim().slice(0, 230)}`,
          note: [claim.detail?.trim(), `来源：${sourceLabel[claim.source] || '无直接引文'}`,
            claim.pageLabel && claim.source === 'annotation' ? `Zotero 批注页码：${claim.pageLabel}` : '',
            claim.quote ? `${paper ? '原文片段' : '参考片段（不足以直接证明分析判断）'}：${claim.quote}`
              : '此条尚无可匹配的直接引文，请核对原文。']
            .filter(Boolean).join('\n\n'),
          link: typeof claim.link === 'string' && claim.link.startsWith('zotero://')
            ? claim.link : analysis.zoteroUri,
          isExpanded: false,
          children: [],
        };
      });
    if (!children.length) {
      children.push({ id: generateId(), text: '资料不足，待阅读原文补充',
        note: '模型未能从本次提供的资料中可靠提取该项。', children: [] });
    }
    return { id: generateId(), text: label,
      isExpanded: ['gap', 'question', 'system', 'resolution', 'significance'].includes(key), children };
  });
  if (claimCount === 0) throw new Error('模型未提取出可用分析条目；未创建空导图。');
  const now = Date.now();
  return {
    id: 'doc_' + generateId(),
    title: `${analysis.title} · AI 研究解析`,
    root: { id: generateId(), text: analysis.title, note: rootNote,
      link: analysis.zoteroUri, isExpanded: true, children: branches },
    themeId, layoutType: 'mindmap', createdAt: now, updatedAt: now,
    metadata: {
      zoteroItemKey: analysis.zoteroUri,
      zoteroLibraryID: analysis.libraryID,
      zoteroItemTitle: analysis.title,
      autoSyncToZotero: false,
      aiGenerated: true,
      aiDraft: true,
      aiSourceScope: scope,
    },
  };
}
