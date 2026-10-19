import { MindMapDocument, MindMapNode } from '../../core/model/types';
import { generateId } from '../../core/model/treeOps';
import { getZoteroInstance } from './zoteroBridge';
import { getResearchTemplate, researchSectionDefinitions, researchTemplateVersion } from './researchTemplates';

type SectionKey = string;

interface ResearchClaim {
  text: string;
  topic?: string;
  subtopic?: string;
  detail: string;
  basis: 'paper' | 'inference' | 'unresolved';
  source: 'abstract' | 'pdf' | 'note' | 'annotation' | 'comment' | 'none';
  sourceId?: string;
  requestedSource?: ResearchClaim['source'];
  requestedSourceId?: string;
  verification?: 'matched' | 'no_quote' | 'no_source' | 'unknown_source' | 'ambiguous' | 'unmatched' | 'not_in_draft';
  quote: string;
  attemptedQuote?: string;
  sourceRecovery?: boolean;
  evidenceContext?: string;
  link?: string;
  pageLabel?: string;
}

export interface ResearchInputPreview {
  abstractText?: string;
  /** Local recovery text; never part of an analysis request. */
  abstractExcerpt?: string;
  readingMode: ResearchReadingMode;
  preparedId: string;
  title: string;
  zoteroUri: string;
  model: string;
  endpointHost: string;
  localModel: boolean;
  defaultModelEntryId: string;
  models: ResearchModelOption[];
  archiveState: string;
  quickCalls: number;
  standardCalls?: number;
  deepCalls: number;
  estimatedCharacters: number;
  sourceCharacters: ResearchSourceCharacters;
  sourceScope: ResearchAnalysis['sourceScope'] & {
    omittedNotes: number;
    omittedAnnotations: number;
    pdfCharacters: number;
    maxPages: number;
    highlightCount: number;
    commentCount: number;
    abstractTruncated: boolean;
    trimmedNotes: number;
    trimmedHighlights: number;
    trimmedComments: number;
    noteReadErrors: number;
    annotationReadErrors: number;
    pdfAttachmentTitle: string;
    paperHasAbstract: boolean;
    pdfAttachmentCount: number;
  };
}

export interface ResearchSourceSelection {
  abstract: boolean;
  pdf: boolean;
  notes: boolean;
  highlights: boolean;
  comments: boolean;
}

export interface ResearchModelOption {
  entryId: string;
  model: string;
  host?: string;
  local?: boolean;
  available: boolean;
  message?: string;
  reasoningSupported: boolean;
  reasoningOptions: Array<{ id: ResearchReasoningLevel; label: string }>;
  reasoningOptionsSource?: 'llm-for-zotero-profile' | 'upstream-mapping' | 'unsupported';
}
export type ResearchReasoningLevel = string;
export type ResearchReadingMode = 'abstract' | 'introduction' | 'conclusion' | 'key-sections' | 'full';
export interface ResearchModelSelection {
  modelEntryId: string;
  reasoningLevel: ResearchReasoningLevel;
  templateId?: string;
  customPrompt?: string;
  presentation?: ResearchAppearance | null;
}

export type ResearchSourceCharacters = Record<keyof ResearchSourceSelection, number>;

export interface ResearchProgress {
  phase: string;
  completed: number;
  total: number;
}

export type ResearchAnalysisIntensity = 'quick' | 'standard' | 'deep';

export interface ResearchRequestOptions {
  abstractSelection?: { preparedId: string; text: string };
  readingMode?: ResearchReadingMode;
  preparedId?: string;
  mode?: ResearchAnalysisIntensity;
  modelEntryId?: string;
  reasoningLevel?: ResearchReasoningLevel;
  templateId?: string;
  customPrompt?: string;
  sources?: ResearchSourceSelection;
  expectedCalls?: number;
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
    analysisMode?: ResearchAnalysisIntensity;
    quickSampled?: boolean;
    standardMode?: boolean;
    deepCondensed?: boolean;
    synthesisCandidateLimit?: number;
    model?: string;
    modelEntryId?: string;
    reasoningLevel?: ResearchReasoningLevel;
    endpointHost?: string;
    llmIntegration?: { service: 'llm-for-zotero'; api: 'agent.runTurn'; completedCalls: number; runIds: string[] };
    templateId?: string;
    templateVersion?: number;
    customPrompt?: string;
    readingMode?: ResearchReadingMode;
    abstractSource?: 'zotero' | 'pdf' | 'pdf-selected' | 'manual' | 'none';
    sectionStatus?: { found: string[]; missing: string[] };
    selectedSources?: ResearchSourceSelection;
    sourceWarnings?: {
      abstractTruncated: boolean;
      trimmedNotes: number;
      trimmedHighlights: number;
      trimmedComments: number;
      noteReadErrors: number;
      annotationReadErrors: number;
      omittedNotes: number;
      omittedAnnotations: number;
    };
  };
  sections: Record<SectionKey, ResearchClaim[]>;
}

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
      try { window.parent.postMessage({ type: 'MINDFLOW_CANCEL_PAPER', requestId }, '*'); }
      catch { /* The workspace may have been closed while cancelling. */ }
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
      finish(new Error(type === 'MINDFLOW_ANALYZE_PAPER'
        ? '等待模型分析超时；当前请求已取消，可在预览中重试并恢复已完成的分段。'
        : '准备论文资料超时；请检查 PDF 附件后重试。'));
    }, type === 'MINDFLOW_ANALYZE_PAPER'
      ? Math.min(30 * 60 * 1000, Math.max(5 * 60 * 1000,
        (Math.max(1, Number(options.expectedCalls) || 1) * 180000) + 60000))
      : 240000);
    window.addEventListener('message', onMessage);
    options.signal?.addEventListener('abort', onAbort, { once: true });
    if (options.signal?.aborted) { onAbort(); return; }
    try { window.parent.postMessage({ type, requestId, reference,
      preparedId: options.preparedId, mode: options.mode, sources: options.sources,
      modelEntryId: options.modelEntryId, reasoningLevel: options.reasoningLevel, templateId: options.templateId, readingMode: options.readingMode,
      customPrompt: options.customPrompt,
      abstractSelection: options.abstractSelection }, '*'); }
    catch { finish(new Error('无法向 Zotero 主窗口发送 AI 分析请求。')); }
  });
}

export async function prepareResearchAnalysis(reference: string,
  signal?: AbortSignal, readingMode: ResearchReadingMode = 'abstract',
  abstractSelection?: ResearchRequestOptions['abstractSelection']): Promise<ResearchInputPreview> {
  // Zotero injects the host API into its chrome workspace. Prefer this channel,
  // as with storage: privileged Gecko postMessage can omit event.source.
  const zotero = getZoteroInstance();
  if (zotero?.MindFlow?.preparePaperAnalysis) {
    if (signal?.aborted) throw new Error('AI 分析已取消。');
    return zotero.MindFlow.preparePaperAnalysis(reference, { signal, readingMode, abstractSelection }) as Promise<ResearchInputPreview>;
  }
  return requestFromHost<ResearchInputPreview>('MINDFLOW_PREPARE_PAPER', reference, { signal, readingMode, abstractSelection });
}

export async function requestResearchAnalysis(reference: string,
  options: ResearchRequestOptions = {}): Promise<ResearchAnalysis> {
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

export type ResearchAppearance = Pick<MindMapDocument, 'themeId' | 'layoutType'>;

export function createResearchDocument(analysis: ResearchAnalysis, appearance: ResearchAppearance): MindMapDocument {
  if (!analysis || typeof analysis.title !== 'string' || typeof analysis.zoteroUri !== 'string' ||
      !analysis.sections || typeof analysis.sections !== 'object') {
    throw new Error('AI 研究分析结果格式无效。');
  }
  const scope = analysis.sourceScope;
  const displayTitle = analysis.title.replace(/<[^>]*>/g, '').trim() || analysis.title;
  const template = getResearchTemplate(scope?.templateId);
  const story = template.style === 'story';
  const visibleClaims = (key: SectionKey): ResearchClaim[] => (Array.isArray(analysis.sections[key])
    ? analysis.sections[key] : []).filter(claim => claim && typeof claim.text === 'string' && claim.text.trim())
    .slice(0, template.maxClaims || 5);
  const hasPaperEvidence = (claim: ResearchClaim) => claim.basis === 'paper' && claim.verification === 'matched' &&
    Boolean(claim.quote?.trim()) && ['abstract', 'pdf', 'annotation'].includes(claim.source);
  const allClaims = template.keys.flatMap(visibleClaims);
  const evidenceCount = allClaims.filter(hasPaperEvidence).length;
  const reviewCount = allClaims.length - evidenceCount;
  const warningDescriptions = scope?.sourceWarnings ? [
    scope.selectedSources?.abstract && scope.sourceWarnings.abstractTruncated ? '长摘要' : '',
    scope.selectedSources?.notes && scope.sourceWarnings.trimmedNotes ? `${scope.sourceWarnings.trimmedNotes} 条长笔记` : '',
    scope.selectedSources?.highlights && scope.sourceWarnings.trimmedHighlights ? `${scope.sourceWarnings.trimmedHighlights} 条长划线` : '',
    scope.selectedSources?.comments && scope.sourceWarnings.trimmedComments ? `${scope.sourceWarnings.trimmedComments} 条长评论` : '',
    scope.selectedSources?.notes && scope.sourceWarnings.omittedNotes ? `${scope.sourceWarnings.omittedNotes} 条其余笔记` : '',
    (scope.selectedSources?.highlights || scope.selectedSources?.comments) && scope.sourceWarnings.omittedAnnotations
      ? `${scope.sourceWarnings.omittedAnnotations} 条其余批注` : '',
    scope.selectedSources?.notes && scope.sourceWarnings.noteReadErrors
      ? `${scope.sourceWarnings.noteReadErrors} 处笔记读取异常` : '',
    (scope.selectedSources?.highlights || scope.selectedSources?.comments) && scope.sourceWarnings.annotationReadErrors
      ? `${scope.sourceWarnings.annotationReadErrors} 处批注读取异常` : '',
  ].filter(Boolean) : [];
  const headline = (key: SectionKey, label: string) => {
    const claim = visibleClaims(key)[0];
    if (!claim?.text) return `${label}：资料不足，待补充`;
    return `${label}（${hasPaperEvidence(claim) ? '有原文片段' : '待核验'}）：${claim.text}`;
  };
  const headlineLabels: Record<string, string> = { question: '研究目的', system: '材料体系', conditions: '关键条件',
    mechanism: '作用机理', findings: '主要发现', resolution: '解决的问题', significance: '研究意义',
    assumptions: '理论模型与假设', predictions: '理论预测', taxonomy: '路线分类', conflicts: '共识与分歧' };
  let rootNote = [
    `分析模板：${template.name}；框架：${template.framework}`,
    'AI 辅助论文分析；请依据原文复核。',
    scope?.model ? `总结服务：llm-for-zotero；模型：${scope.model}；推理强度请求：${scope.reasoningLevel || 'default'}（实际参数由模型能力决定）。` : '',
    scope?.llmIntegration ? `调用记录：${scope.llmIntegration.api}；${scope.llmIntegration.completedCalls} 次已完成的总结调用。` : '',
    scope?.readingMode ? `读取范围：${({ abstract: '仅摘要', introduction: '仅引言', conclusion: '仅结论', 'key-sections': '摘要＋引言＋结论', full: '全文' })[scope.readingMode]}。` : '',
    scope?.abstractSource === 'pdf' ? '摘要来源：本次在关联 PDF 中可靠定位的摘要段落；其他正文依照读取范围选择。' : '',
    scope?.abstractSource === 'pdf-selected' ? '摘要来源：用户从本地 PDF 前页文字中选取并确认的段落；摘要边界需人工核对。' : '',
    scope?.abstractSource === 'manual' ? '摘要来源：用户粘贴的文字，未与本地 PDF 核对；引文匹配只表示与输入一致，分析标为待核验。' : '',
    scope?.sectionStatus?.missing.length ? `未识别部分：${scope.sectionStatus.missing.join('、')}；未自动回退全文。` : '',
    '速读提要：',
    ...template.keys.filter(key => headlineLabels[key]).map(key => headline(key, headlineLabels[key])),
    `证据核对：${evidenceCount} 条有对应原文片段；${reviewCount} 条为推断、待解决或缺少可匹配引文，须人工复核。`,
    '',
    `资料范围：${scope?.pdfState || 'PDF 状态未知'}；摘要${scope?.hasAbstract ? '可用' : '不可用'}；` +
      `笔记 ${scope?.noteCount || 0} 条；批注 ${scope?.annotationCount || 0} 条。`,
    scope?.selectedSources ? `本次资料选择：${([
      ['abstract', '摘要'], ['pdf', 'PDF 文字'], ['notes', '笔记'],
      ['highlights', '批注划线'], ['comments', '读者评论'],
    ] as const).filter(([key]) => scope.selectedSources?.[key]).map(([, label]) => label).join('、')}。` : '',
    scope?.pdfTruncated ? 'PDF 文字超出本次读取范围或经过跨区间采样，部分内容仍可能未纳入分析。' : '',
    scope?.quickSampled ? '本次为简要快速模式，PDF 文字仅取跨区间节选。' : '',
    scope?.analysisMode === 'quick' ? '分析强度：简要快速（提炼 3~4 个核心分支，精炼要点，极速概览）。' : '',
    scope?.analysisMode === 'standard' ? '分析强度：中等复杂度（5~6 个标准学术分支，平衡详略）。' : '',
    scope?.analysisMode === 'deep' ? '分析强度：详细深析（全面深度解构，深挖定量指标、因果机理与局限展望）。' : '',
    scope?.deepCondensed ? `深入模式最终整合接收每栏最多 ${scope.synthesisCandidateLimit || 5} 条分段候选及缩短的摘要、笔记和批注；候选筛选仍可能遗漏内容。` : '',
    warningDescriptions.length ? `准备阶段截取或未纳入：${warningDescriptions.join('、')}。` : '',
    '绿色勾：短引文与本次原文匹配，不等于科学结论已被独立验证。',
    'P 编号是本次分析的 PDF 文字片段序号，不是 PDF 页码。',
    '问号：推断或待核验；红旗：待解决。具体状态和原文见节点备注。',
  ].filter(Boolean).join('\n');
  let claimCount = 0;
  const branches: MindMapNode[] = template.keys.map((key) => {
    const label = researchSectionDefinitions[key].label;
    const claims = visibleClaims(key);
    const children: MindMapNode[] = claims
      .filter((claim) => claim && typeof claim.text === 'string' && claim.text.trim())
      .map((claim) => {
        claimCount += 1;
        const paper = hasPaperEvidence(claim);
        const status = paper ? '原文片段匹配' : claim.basis === 'unresolved' ? '待解决' : '推断／待核验';
        const sourceLabel: Record<string, string> = {
          abstract: '摘要', pdf: 'PDF 文字节选', note: 'Zotero 笔记',
          annotation: 'Zotero 批注划线文字', comment: 'Zotero 批注评论（读者材料）', none: '无直接引文',
        };
        const verificationLabel: Record<string, string> = {
          matched: '引文与指定资料匹配；仍需人工核对上下文',
          no_quote: '未提供足够长度的原文引文',
          no_source: '未指定可核对的资料来源',
          unknown_source: '模型填写的资料编号不在本次输入中',
          not_in_draft: '整合阶段新增或改写了 PDF 引文，未通过分段结果核对',
          ambiguous: '引文在多个资料片段中重复，无法唯一定位',
          unmatched: '引文与指定资料的文字不匹配',
        };
        return {
          id: generateId(),
          text: story && !paper ? `${claim.basis === 'unresolved' ? '待解决' : '待核验'}：${claim.text.trim()}` : claim.text.trim(),
          icons: [paper ? 'check' : claim.basis === 'unresolved' ? 'flag' : 'question'],
          note: [`证据状态：${status}`, claim.detail?.trim(), `来源：${sourceLabel[claim.source] || '无直接引文'}${claim.sourceId ? `（${claim.sourceId}）` : ''}`,
            claim.source === 'none' && claim.requestedSource && claim.requestedSource !== 'none'
              ? `模型声称来源：${sourceLabel[claim.requestedSource] || claim.requestedSource}${claim.requestedSourceId ? `（${claim.requestedSourceId}）` : ''}；未能确认` : '',
            `核对状态：${verificationLabel[claim.verification || ''] || '需人工复核'}`,
            claim.sourceRecovery ? '模型未给出有效来源；本插件依据长引文在本次输入中的唯一逐字匹配定位来源。该匹配不能代替对判断内容的人工核验。' : '',
            claim.source === 'pdf' && claim.sourceId ? 'PDF 片段编号不是页码；链接打开关联 PDF。' : '',
            claim.pageLabel && ['annotation', 'comment'].includes(claim.source) ? `Zotero 批注页码：${claim.pageLabel}` : '',
            claim.quote ? `${paper ? '原文片段' : '参考片段（不足以直接证明分析判断）'}：${claim.quote}`
              : claim.attemptedQuote ? `未匹配的模型引文（不能当作原文）：${claim.attemptedQuote}`
                : '此条尚无可匹配的直接引文，请核对原文。',
            claim.evidenceContext ? `PDF 上下文节选（本次输入）：${claim.evidenceContext}` : '']
            .filter(Boolean).join('\n\n'),
          link: typeof claim.link === 'string' && claim.link.startsWith('zotero://')
            ? claim.link : analysis.zoteroUri,
          isExpanded: false,
          children: [],
        };
      });
    if (!children.length && !story) {
      children.push({ id: generateId(), text: '待补充',
        note: '模型未能从本次提供的资料中可靠提取该项。', children: [] });
    }
    return { id: generateId(), text: label,
      isExpanded: ['question', 'system', 'conditions', 'mechanism', 'findings', 'assumptions', 'predictions'].includes(key), children };
  });
  if (claimCount === 0) throw new Error('模型未提取出可用分析条目；未创建空导图。');
  let displayedBranches = branches;
  if (story) {
    const sectionNodes = new Map(template.keys.map((key, index) => [key, branches[index].children]));
    const makeBranch = (text: string, children: MindMapNode[]): MindMapNode => ({
      id: generateId(), text, isExpanded: true, children,
    });
    // These grouping labels organize already-verified claims. They never create
    // additional claims, quotes, numbers or inferred mechanisms.
    const groupSections = (keys: string[]) => {
      const groups = new Map<string, MindMapNode[]>();
      for (const key of keys) visibleClaims(key).slice(0, template.claimBudgets?.[key] || 3).forEach((_claim, index) => {
        const node = sectionNodes.get(key)?.[index];
        if (!node) return;
        const label = researchSectionDefinitions[key].label;
        const entries = groups.get(label) || [];
        entries.push(node); groups.set(label, entries);
      });
      return [...groups].map(([label, children]) => children.length === 1 ? children[0] : makeBranch(label, children));
    };
    displayedBranches = [];
    const addSection = (label: string, keys: string[]) => {
      const children = groupSections(keys);
      if (children.length) displayedBranches.push(makeBranch(label, children));
    };
    addSection('核心问题与研究目标', ['question', 'gap', 'background']);
    addSection('研究体系与证据路线', ['system', 'conditions', 'method']);
    const discoveries = new Map<string, Map<string, MindMapNode[]>>();
    for (const key of ['findings', 'mechanism']) visibleClaims(key).slice(0, template.claimBudgets?.[key] || 3).forEach((claim, index) => {
      const node = sectionNodes.get(key)?.[index];
      if (!node) return;
      const topic = claim.topic?.trim() || (key === 'findings' ? '观测结果' : '机理解释与证据边界');
      const subtopic = key === 'findings' ? '观测与对照证据' : '作者解释与证据边界';
      const groups = discoveries.get(topic) || new Map<string, MindMapNode[]>();
      const entries = groups.get(subtopic) || [];
      entries.push(node); groups.set(subtopic, entries); discoveries.set(topic, groups);
    });
    const supplementary = discoveries.get('补充证据与对照');
    discoveries.delete('补充证据与对照');
    const findingBranches = [...discoveries].slice(0, template.maxTopics || 3).map(([topic, groups], index) => makeBranch(
      `关键发现 ${index + 1}：${topic}`,
      [...groups].map(([label, children]) => children.length === 1 ? children[0] : makeBranch(label, children)),
    ));
    if (findingBranches.length) displayedBranches.push(makeBranch('关键发现与机制', findingBranches));
    else if (supplementary) displayedBranches.push(makeBranch('关键发现与机制',
      [...supplementary].map(([label, children]) => children.length === 1 ? children[0] : makeBranch(label, children))));
    addSection('问题回应与科学意义', ['resolution', 'significance']);
    addSection('局限与后续验证', ['limitations', 'nextSteps']);
    // Deduplicate visible facts without discarding their evidence. Additional
    // quotes and details remain with the first occurrence; capped facts are
    // retained in the root note, never silently thrown away.
    const seen = new Map<string, MindMapNode>();
    const prune = (node: MindMapNode): boolean => {
      if (node.children.length) {
        node.children = node.children.filter(prune);
        return node.children.length > 0;
      }
      const text = node.text.replace(/\s+/g, ' ').trim();
      const first = seen.get(text);
      if (first) { first.note += `\n\n合并的同文要点：\n${node.note || ''}`; return false; }
      seen.set(text, node); return true;
    };
    displayedBranches = displayedBranches.filter(prune);
  }
  const visibleIds = new Set<string>();
  const collect = (node: MindMapNode) => { visibleIds.add(node.id); node.children.forEach(collect); };
  displayedBranches.forEach(collect);
  const claimNodes = branches.flatMap(branch => branch.children);
  const visibleClaimNodes = claimNodes.filter(node => visibleIds.has(node.id));
  const supplementaryClaims = claimNodes.filter(node => !visibleIds.has(node.id));
  if (supplementaryClaims.length) rootNote += `\n\n补充资料（${supplementaryClaims.length} 条，已从主图凝练；保留原文与核对信息）：\n` +
    supplementaryClaims.map(node => `${node.text}\n${node.note || ''}`).join('\n\n');
  const now = Date.now();
  return {
    id: 'doc_' + generateId(),
    title: `${displayTitle} · AI 研究解析`,
    root: { id: generateId(), text: displayTitle, note: rootNote,
      link: analysis.zoteroUri, isExpanded: true, children: displayedBranches },
    // Appearance is chosen locally by the user, independently of model output.
    themeId: appearance.themeId, layoutType: appearance.layoutType, createdAt: now, updatedAt: now,
    metadata: {
      zoteroItemKey: analysis.zoteroUri,
      zoteroLibraryID: analysis.libraryID,
      zoteroItemTitle: analysis.title,
      autoSyncToZotero: false,
      aiGenerated: true,
      aiDraft: true,
      aiEvidenceCount: story ? visibleClaimNodes.filter(node => node.icons?.includes('check')).length : evidenceCount,
      aiReviewCount: story ? visibleClaimNodes.filter(node => !node.icons?.includes('check')).length : reviewCount,
      aiSupplementaryCount: supplementaryClaims.length,
      aiSourceScope: scope,
      aiTemplateId: template.id,
      aiTemplateVersion: scope?.templateVersion || researchTemplateVersion,
    },
  };
}
