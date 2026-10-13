import definitions from '../../../../chrome/content/research-templates.json';

export interface ResearchTemplate {
  id: string;
  name: string;
  description: string;
  framework: string;
  keys: string[];
  family: string;
  style: string;
  maxClaims?: number;
  claimBudgets?: Record<string, number>;
  maxTopics?: number;
}
export const researchTemplates: ResearchTemplate[] = definitions.templates;
export const defaultResearchTemplateId = definitions.defaultId;
export const researchTemplateVersion = definitions.version;
export const researchSectionDefinitions: Record<string, { label: string; instruction: string }> = definitions.sections;
export function getResearchTemplate(id = defaultResearchTemplateId): ResearchTemplate {
  const template = researchTemplates.find(entry => entry.id === id);
  if (!template) throw new Error('研究模板无效，请重新选择。');
  return template;
}
