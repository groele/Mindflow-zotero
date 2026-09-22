import { ThemeColors } from '../model/types';

export const THEMES: Record<string, ThemeColors> = {
  'classic-blue': {
    id: 'classic-blue',
    name: '经典商务蓝',
    background: '#f8fafc',
    surface: '#ffffff',
    text: '#1e293b',
    nodeBg: '#ffffff',
    nodeBorder: '#cbd5e1',
    nodeText: '#1e293b',
    rootBg: '#2563eb',
    rootText: '#ffffff',
    branchColors: [
      '#2563eb', // Blue
      '#0891b2', // Cyan
      '#059669', // Emerald
      '#d97706', // Amber
      '#7c3aed', // Violet
      '#db2777', // Pink
      '#ea580c', // Orange
      '#4f46e5', // Indigo
    ],
    lineColor: '#94a3b8',
    isDark: false,
  },
  'dark-nebula': {
    id: 'dark-nebula',
    name: '极夜星云 (深色)',
    background: '#0f172a',
    surface: '#1e293b',
    text: '#f1f5f9',
    nodeBg: '#1e293b',
    nodeBorder: '#334155',
    nodeText: '#f8fafc',
    rootBg: '#6366f1',
    rootText: '#ffffff',
    branchColors: [
      '#38bdf8', // Light Blue
      '#a855f7', // Purple
      '#34d399', // Mint
      '#f472b6', // Pink
      '#fbbf24', // Yellow
      '#818cf8', // Indigo
      '#2dd4bf', // Teal
      '#fb923c', // Orange
    ],
    lineColor: '#475569',
    isDark: true,
  },
  'macaron': {
    id: 'macaron',
    name: '马卡龙缤纷',
    background: '#faf7f5',
    surface: '#ffffff',
    text: '#334155',
    nodeBg: '#ffffff',
    nodeBorder: '#e2e8f0',
    nodeText: '#334155',
    rootBg: '#f43f5e',
    rootText: '#ffffff',
    branchColors: [
      '#f43f5e', // Rose
      '#8b5cf6', // Purple
      '#06b6d4', // Cyan
      '#10b981', // Emerald
      '#f59e0b', // Amber
      '#ec4899', // Pink
      '#6366f1', // Indigo
      '#14b8a6', // Teal
    ],
    lineColor: '#cbd5e1',
    isDark: false,
  },
  'forest-green': {
    id: 'forest-green',
    name: '松柏青绿 (护眼)',
    background: '#f4f7f4',
    surface: '#ffffff',
    text: '#1b382b',
    nodeBg: '#ffffff',
    nodeBorder: '#c2d6cb',
    nodeText: '#1b382b',
    rootBg: '#15803d',
    rootText: '#ffffff',
    branchColors: [
      '#15803d',
      '#0d9488',
      '#0284c7',
      '#ca8a04',
      '#65a30d',
      '#b45309',
    ],
    lineColor: '#9bb6a6',
    isDark: false,
  },
  'minimal-ink': {
    id: 'minimal-ink',
    name: '极简水墨',
    background: '#fbfbfb',
    surface: '#ffffff',
    text: '#171717',
    nodeBg: '#ffffff',
    nodeBorder: '#737373',
    nodeText: '#171717',
    rootBg: '#171717',
    rootText: '#ffffff',
    branchColors: [
      '#262626',
      '#404040',
      '#525252',
      '#737373',
      '#a3a3a3',
    ],
    lineColor: '#a3a3a3',
    isDark: false,
  },
  'warm-amber': {
    id: 'warm-amber',
    name: '暖阳琥珀',
    background: '#fdfbf7',
    surface: '#ffffff',
    text: '#451a03',
    nodeBg: '#ffffff',
    nodeBorder: '#fed7aa',
    nodeText: '#451a03',
    rootBg: '#c2410c',
    rootText: '#ffffff',
    branchColors: [
      '#ea580c',
      '#d97706',
      '#e11d48',
      '#9333ea',
      '#0284c7',
    ],
    lineColor: '#fdba74',
    isDark: false,
  },
  'cyberpunk-neon': {
    id: 'cyberpunk-neon',
    name: '赛博霓虹 (极客)',
    background: '#09090b',
    surface: '#18181b',
    text: '#fafafa',
    nodeBg: '#18181b',
    nodeBorder: '#27272a',
    nodeText: '#f4f4f5',
    rootBg: '#06b6d4',
    rootText: '#000000',
    branchColors: [
      '#22c55e', // Neon green
      '#ec4899', // Neon pink
      '#a855f7', // Electric purple
      '#eab308', // Cyber yellow
      '#06b6d4', // Cyan
      '#f97316', // Orange
    ],
    lineColor: '#3f3f46',
    isDark: true,
  },
  'nordic-frost': {
    id: 'nordic-frost',
    name: '北欧极简冷灰',
    background: '#f1f5f9',
    surface: '#ffffff',
    text: '#334155',
    nodeBg: '#ffffff',
    nodeBorder: '#94a3b8',
    nodeText: '#334155',
    rootBg: '#475569',
    rootText: '#ffffff',
    branchColors: [
      '#475569',
      '#64748b',
      '#0f766e',
      '#0369a1',
      '#6d28d9',
      '#be185d',
    ],
    lineColor: '#94a3b8',
    isDark: false,
  },
  'academic-paper': {
    id: 'academic-paper',
    name: '学术报刊 (复古)',
    background: '#fefcf6',
    surface: '#ffffff',
    text: '#292524',
    nodeBg: '#ffffff',
    nodeBorder: '#d6d3d1',
    nodeText: '#292524',
    rootBg: '#44403c',
    rootText: '#ffffff',
    branchColors: [
      '#78350f',
      '#1e3a8a',
      '#065f46',
      '#831843',
      '#374151',
    ],
    lineColor: '#a8a29e',
    isDark: false,
  },
  'lavender-dream': {
    id: 'lavender-dream',
    name: '薰衣草梦境',
    background: '#faf5ff',
    surface: '#ffffff',
    text: '#3b0764',
    nodeBg: '#ffffff',
    nodeBorder: '#e9d5ff',
    nodeText: '#3b0764',
    rootBg: '#9333ea',
    rootText: '#ffffff',
    branchColors: [
      '#9333ea',
      '#c026d3',
      '#ec4899',
      '#6366f1',
      '#0284c7',
      '#0d9488',
    ],
    lineColor: '#d8b4fe',
    isDark: false,
  }
};

export const DEFAULT_THEME_ID = 'classic-blue';

export function getTheme(id?: string): ThemeColors {
  if (id && THEMES[id]) return THEMES[id];
  return THEMES[DEFAULT_THEME_ID];
}
