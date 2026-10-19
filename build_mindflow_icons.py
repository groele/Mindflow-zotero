#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Mindflow-zotero v11.2.0 - Fluid Origami Wing (流体折纸旋翼) 全套无边界图标打包脚本
适配平台: Zotero 10 (Gecko context-fill & High-DPI SVG)
运行方式: python3 build_mindflow_icons.py
输出文件: Mindflow-Zotero-v11.2.0-Fluid-Origami-Icons.zip
"""

import zipfile
import os

ZIP_FILENAME = "Mindflow-Zotero-v11.2.0-Fluid-Origami-Icons.zip"

ICONS = {
    # -------------------------------------------------------------------------
    # 01. 插件主图标 (64x64 全彩流体折纸旋翼 - 挂载于 manifest.json 48/96)
    # -------------------------------------------------------------------------
    "addon/content/icons/icon.svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%" fill="none">
  <defs>
    <linearGradient id="wing-1" x1="12" y1="16" x2="52" y2="24" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#06B6D4" />
      <stop offset="100%" stop-color="#3B82F6" />
    </linearGradient>
    <linearGradient id="wing-2" x1="10" y1="30" x2="54" y2="38" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#6366F1" />
      <stop offset="100%" stop-color="#A855F7" />
    </linearGradient>
    <linearGradient id="wing-3" x1="16" y1="44" x2="48" y2="52" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#EC4899" />
      <stop offset="100%" stop-color="#F43F5E" stop-opacity="0.3" />
    </linearGradient>
  </defs>

  <!-- 底层流翼：柔和托底 -->
  <path d="M 14 44 C 24 42, 34 46, 50 42 C 42 50, 30 56, 14 44 Z" 
        fill="url(#wing-3)" />

  <!-- 中层流翼：主视觉承转，优雅的双曲率叶面 -->
  <path d="M 8 30 C 24 24, 38 34, 56 26 C 46 38, 28 44, 8 30 Z" 
        fill="url(#wing-2)" />
  <path d="M 8 30 C 28 44, 46 38, 56 26" 
        stroke="#FFFFFF" stroke-width="1" stroke-linecap="round" opacity="0.5" />

  <!-- 顶层流翼：向右上破界扬起 -->
  <path d="M 14 18 C 28 10, 40 20, 54 10 C 46 24, 30 30, 14 18 Z" 
        fill="url(#wing-1)" />
  <path d="M 14 18 C 30 30, 46 24, 54 10" 
        stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" opacity="0.75" />
</svg>""",

    # -------------------------------------------------------------------------
    # 02. 品牌彩色微标 (24x24 - 挂载于设置页 Header / 弹窗小尺寸彩标)
    # -------------------------------------------------------------------------
    "addon/content/icons/icon-accent.svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none">
  <defs>
    <linearGradient id="w1-sm" x1="4" y1="6" x2="20" y2="9" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#06B6D4" />
      <stop offset="100%" stop-color="#3B82F6" />
    </linearGradient>
    <linearGradient id="w2-sm" x1="3" y1="11" x2="21" y2="14" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#6366F1" />
      <stop offset="100%" stop-color="#A855F7" />
    </linearGradient>
    <linearGradient id="w3-sm" x1="5" y1="16" x2="19" y2="20" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#EC4899" />
      <stop offset="100%" stop-color="#F43F5E" stop-opacity="0.4" />
    </linearGradient>
  </defs>
  <path d="M 5 16.5 C 9 15.8, 13 17.2, 19 15.8 C 16 19, 11 21, 5 16.5 Z" fill="url(#w3-sm)" />
  <path d="M 2.5 11.2 C 8.5 9, 14 12.8, 21.5 9.8 C 17.5 14.5, 10.5 16.8, 2.5 11.2 Z" fill="url(#w2-sm)" />
  <path d="M 5 6.8 C 10.5 3.5, 15 7.5, 20.5 3.5 C 17.5 9, 11 11.5, 5 6.8 Z" fill="url(#w1-sm)" />
</svg>""",

    # -------------------------------------------------------------------------
    # 03. Zotero 10 顶栏与阅读器主按钮 (16x16 单色自适应)
    # -------------------------------------------------------------------------
    "addon/content/icons/toolbar-mindflow.svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%" fill="none">
  <defs>
    <linearGradient id="mf-tb-w1" x1="12" y1="16" x2="52" y2="24" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#06B6D4" />
      <stop offset="100%" stop-color="#3B82F6" />
    </linearGradient>
    <linearGradient id="mf-tb-w2" x1="10" y1="30" x2="54" y2="38" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#6366F1" />
      <stop offset="100%" stop-color="#A855F7" />
    </linearGradient>
    <linearGradient id="mf-tb-w3" x1="16" y1="44" x2="48" y2="52" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#EC4899" />
      <stop offset="100%" stop-color="#F43F5E" stop-opacity="0.3" />
    </linearGradient>
  </defs>
  <path d="M 14 44 C 24 42, 34 46, 50 42 C 42 50, 30 56, 14 44 Z" fill="url(#mf-tb-w3)" />
  <path d="M 8 30 C 24 24, 38 34, 56 26 C 46 38, 28 44, 8 30 Z" fill="url(#mf-tb-w2)" />
  <path d="M 8 30 C 28 44, 46 38, 56 26" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" opacity="0.6" />
  <path d="M 14 18 C 28 10, 40 20, 54 10 C 46 24, 30 30, 14 18 Z" fill="url(#mf-tb-w1)" />
  <path d="M 14 18 C 30 30, 46 24, 54 10" stroke="#FFFFFF" stroke-width="1.4" stroke-linecap="round" opacity="0.85" />
</svg>""",
    "addon/content/icons/mindflow-toolbar.svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%" fill="none">
  <defs>
    <linearGradient id="mf-tb-w1" x1="12" y1="16" x2="52" y2="24" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#06B6D4" />
      <stop offset="100%" stop-color="#3B82F6" />
    </linearGradient>
    <linearGradient id="mf-tb-w2" x1="10" y1="30" x2="54" y2="38" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#6366F1" />
      <stop offset="100%" stop-color="#A855F7" />
    </linearGradient>
    <linearGradient id="mf-tb-w3" x1="16" y1="44" x2="48" y2="52" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#EC4899" />
      <stop offset="100%" stop-color="#F43F5E" stop-opacity="0.3" />
    </linearGradient>
  </defs>
  <path d="M 14 44 C 24 42, 34 46, 50 42 C 42 50, 30 56, 14 44 Z" fill="url(#mf-tb-w3)" />
  <path d="M 8 30 C 24 24, 38 34, 56 26 C 46 38, 28 44, 8 30 Z" fill="url(#mf-tb-w2)" />
  <path d="M 8 30 C 28 44, 46 38, 56 26" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" opacity="0.6" />
  <path d="M 14 18 C 28 10, 40 20, 54 10 C 46 24, 30 30, 14 18 Z" fill="url(#mf-tb-w1)" />
  <path d="M 14 18 C 30 30, 46 24, 54 10" stroke="#FFFFFF" stroke-width="1.4" stroke-linecap="round" opacity="0.85" />
</svg>""",
    "addon/content/icons/mindflow.svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%" fill="none">
  <defs>
    <linearGradient id="wing-1" x1="12" y1="16" x2="52" y2="24" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#06B6D4" />
      <stop offset="100%" stop-color="#3B82F6" />
    </linearGradient>
    <linearGradient id="wing-2" x1="10" y1="30" x2="54" y2="38" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#6366F1" />
      <stop offset="100%" stop-color="#A855F7" />
    </linearGradient>
    <linearGradient id="wing-3" x1="16" y1="44" x2="48" y2="52" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#EC4899" />
      <stop offset="100%" stop-color="#F43F5E" stop-opacity="0.3" />
    </linearGradient>
  </defs>
  <path d="M 14 44 C 24 42, 34 46, 50 42 C 42 50, 30 56, 14 44 Z" fill="url(#wing-3)" />
  <path d="M 8 30 C 24 24, 38 34, 56 26 C 46 38, 28 44, 8 30 Z" fill="url(#wing-2)" />
  <path d="M 8 30 C 28 44, 46 38, 56 26" stroke="#FFFFFF" stroke-width="1" stroke-linecap="round" opacity="0.5" />
  <path d="M 14 18 C 28 10, 40 20, 54 10 C 46 24, 30 30, 14 18 Z" fill="url(#wing-1)" />
  <path d="M 14 18 C 30 30, 46 24, 54 10" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" opacity="0.75" />
</svg>""",

    # -------------------------------------------------------------------------
    # 04. 侧边栏页签图标 (16x16 紧凑高对比版)
    # -------------------------------------------------------------------------
    "addon/content/icons/sidebar-tab-mindflow.svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="none">
  <path fill="context-fill, currentColor" 
        d="M 3 4.8 C 6.8 2.5, 10 5.2, 13.8 2.5 C 11.5 6.2, 7.2 8, 3 4.8 Z" />
  <path fill="context-fill, currentColor" 
        d="M 1.8 8.2 C 6 6.5, 9.8 9, 14.2 6.8 C 11.8 10.2, 7 12, 1.8 8.2 Z" />
  <path fill="context-fill, currentColor" fill-opacity="0.6" opacity="0.6"
        d="M 3.5 11.5 C 6.5 10.8, 9 12, 12.8 10.8 C 10.8 13.2, 7.5 14.5, 3.5 11.5 Z" />
</svg>""",

    # -------------------------------------------------------------------------
    # 05. 思维导图分支拓扑视图 (16x16 流体旋翼分叉演化为导图树)
    # -------------------------------------------------------------------------
    "addon/content/icons/mindmap-branch-flow.svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="none">
  <!-- 左侧根旋翼 -->
  <path fill="context-fill, currentColor" 
        d="M 1 8 C 3.5 6.5, 5.5 8.5, 8 7 C 6.2 9.5, 3.5 10.5, 1 8 Z" />
  <!-- 右上衍生分支流翼 -->
  <path fill="context-fill, currentColor" 
        d="M 6.5 6.2 C 9.2 4, 11.5 5.5, 15 2.5 C 13.2 6, 10 7.2, 6.5 6.2 Z" />
  <!-- 右中衍生分支流翼 -->
  <path fill="context-fill, currentColor" fill-opacity="0.85" opacity="0.85"
        d="M 7.5 8.2 C 10 7.2, 12.2 8.5, 15.2 7.2 C 13.5 9.5, 10.5 10.2, 7.5 8.2 Z" />
  <!-- 右下衍生分支流翼 -->
  <path fill="context-fill, currentColor" fill-opacity="0.65" opacity="0.65"
        d="M 6.5 9.8 C 9.5 10, 11.8 12, 14.8 13 C 12.2 14, 9 12.5, 6.5 9.8 Z" />
</svg>""",

    # -------------------------------------------------------------------------
    # 06. 新建/插入导图节点 (16x16 双流翼托底 + 右上角新建十字)
    # -------------------------------------------------------------------------
    "addon/content/icons/node-add-wing.svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="none">
  <!-- 左下承托双流翼 -->
  <path fill="context-fill, currentColor" 
        d="M 1.2 8.5 C 4.8 7, 8 9.2, 12 7.2 C 10 10.2, 5.8 11.8, 1.2 8.5 Z" />
  <path fill="context-fill, currentColor" fill-opacity="0.55" opacity="0.55"
        d="M 2.5 11.8 C 5.2 11, 7.8 12.2, 11.2 11 C 9.5 13.2, 6.5 14.5, 2.5 11.8 Z" />
  <!-- 右上新建节点十字 -->
  <path d="M 11.5 1.5 V 6.5 M 9 4 H 14" 
        stroke="context-fill, currentColor" stroke-width="1.6" stroke-linecap="round" />
</svg>""",

    # -------------------------------------------------------------------------
    # 07. 从 PDF 批注流式提取导图 (16x16 左侧文献行转化为右侧流体折翼)
    # -------------------------------------------------------------------------
    "addon/content/icons/extract-pdf-wing.svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="none">
  <!-- 左侧静态文献高亮行 -->
  <path d="M 1.2 4 H 5.2 M 1.2 7.8 H 4.2 M 1.2 11.5 H 5.2" 
        stroke="context-fill, currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.55" />
  <!-- 右侧转化升腾的流体折翼 -->
  <path fill="context-fill, currentColor" 
        d="M 6.5 5.2 C 9.5 3.2, 12 5.5, 15 2.8 C 13.2 6.2, 10 7.8, 6.5 5.2 Z" />
  <path fill="context-fill, currentColor" fill-opacity="0.85" opacity="0.85"
        d="M 5.5 8.5 C 9 7, 11.8 9.2, 15.2 7.2 C 13.2 10.2, 9.5 11.8, 5.5 8.5 Z" />
  <path fill="context-fill, currentColor" fill-opacity="0.55" opacity="0.55"
        d="M 6.8 11.8 C 9.2 11, 11.5 12, 14.2 11 C 12.5 13.2, 9.8 14.2, 6.8 11.8 Z" />
</svg>""",

    # -------------------------------------------------------------------------
    # 08. 导图与 PDF 原文双向同步定位 (16x16 双旋翼首尾回环交织)
    # -------------------------------------------------------------------------
    "addon/content/icons/sync-jump-wing.svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="none">
  <!-- 上半环：向右上扬起的流翼 -->
  <path fill="context-fill, currentColor" 
        d="M 2 7 C 4.5 2.5, 9.5 2, 14 4.5 C 10.5 4.2, 6.5 5, 2 7 Z" />
  <path d="M 11.5 2 L 14.2 4.6 L 11.2 6.2" 
        stroke="context-fill, currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
  <!-- 下半环：向左下回旋的流翼 -->
  <path fill="context-fill, currentColor" fill-opacity="0.8" opacity="0.8"
        d="M 14 9 C 11.5 13.5, 6.5 14, 2 11.5 C 5.5 11.8, 9.5 11, 14 9 Z" />
  <path d="M 4.5 14 L 1.8 11.4 L 4.8 9.8" 
        stroke="context-fill, currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
</svg>""",

    # -------------------------------------------------------------------------
    # 09. 思维导图布局切换 (16x16 左右双翼对称舒展)
    # -------------------------------------------------------------------------
    "addon/content/icons/layout-switch-wing.svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="none">
  <!-- 右翼组 -->
  <path fill="context-fill, currentColor" 
        d="M 8.2 6.2 C 10.5 4.2, 12.8 5.5, 15.2 3.2 C 13.8 6.5, 11 7.8, 8.2 6.2 Z" />
  <path fill="context-fill, currentColor" fill-opacity="0.7" opacity="0.7"
        d="M 8.2 9.8 C 10.5 8.5, 12.8 10, 15.2 8.5 C 13.8 11.5, 11 12.5, 8.2 9.8 Z" />
  <!-- 左翼组 (镜像对称) -->
  <path fill="context-fill, currentColor" 
        d="M 7.8 6.2 C 5.5 4.2, 3.2 5.5, 0.8 3.2 C 2.2 6.5, 5 7.8, 7.8 6.2 Z" />
  <path fill="context-fill, currentColor" fill-opacity="0.7" opacity="0.7"
        d="M 7.8 9.8 C 5.5 8.5, 3.2 10, 0.8 8.5 C 2.2 11.5, 5 12.5, 7.8 9.8 Z" />
</svg>""",

    # -------------------------------------------------------------------------
    # 10. 折叠/展开导图子分支 (16x16 旋翼张合控制)
    # -------------------------------------------------------------------------
    "addon/content/icons/collapse-expand-wing.svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="none">
  <!-- 展开态上扬主旋翼 -->
  <path fill="context-fill, currentColor" 
        d="M 2 6.8 C 6 4.5, 9.5 7, 14 4 C 11.8 7.8, 7 9.5, 2 6.8 Z" />
  <path fill="context-fill, currentColor" fill-opacity="0.6" opacity="0.6"
        d="M 3 10.2 C 6.2 8.8, 9.2 10.5, 13 8.8 C 11 11.5, 7.2 12.8, 3 10.2 Z" />
  <!-- 顶部与底部微弧张合指示 -->
  <path d="M 6.5 2.5 L 8 1.2 L 9.5 2.5 M 6.5 13.5 L 8 14.8 L 9.5 13.5" 
        stroke="context-fill, currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" opacity="0.8" />
</svg>""",

    # -------------------------------------------------------------------------
    # 11. 画布居中聚焦 Fit-to-View (16x16 无边界微弧准星 + 中心流翼)
    # -------------------------------------------------------------------------
    "addon/content/icons/focus-center-wing.svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="none">
  <!-- 四角无边界取景弧 -->
  <path d="M 2 5.2 V 2.8 C 2 2.3, 2.3 2, 2.8 2 H 5.2 M 10.8 2 H 13.2 C 13.7 2, 14 2.3, 14 2.8 V 5.2 M 14 10.8 V 13.2 C 14 13.7, 13.7 14, 13.2 14 H 10.8 M 5.2 14 H 2.8 C 2.3 14, 2 13.7, 2 13.2 V 10.8" 
        stroke="context-fill, currentColor" stroke-width="1.3" stroke-linecap="round" opacity="0.6" />
  <!-- 中心双流体折翼 -->
  <path fill="context-fill, currentColor" 
        d="M 4.5 6.8 C 7 5.2, 9.2 7, 11.8 5 C 10.2 7.8, 7.5 9, 4.5 6.8 Z" />
  <path fill="context-fill, currentColor" fill-opacity="0.7" opacity="0.7"
        d="M 4.2 9.5 C 6.8 8.2, 9.2 9.8, 12 8.2 C 10.2 10.8, 7.2 11.8, 4.2 9.5 Z" />
</svg>""",

    # -------------------------------------------------------------------------
    # 12. 导出思维导图 (16x16 底层流翼 + 右上破界导出飞刃)
    # -------------------------------------------------------------------------
    "addon/content/icons/export-wing.svg": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="none">
  <!-- 左下双流翼基座 -->
  <path fill="context-fill, currentColor" 
        d="M 1.5 9 C 5 7.5, 8.2 9.8, 12.2 7.8 C 10.2 10.8, 6 12.2, 1.5 9 Z" />
  <path fill="context-fill, currentColor" fill-opacity="0.55" opacity="0.55"
        d="M 2.8 12.2 C 5.5 11.5, 8 12.5, 11.5 11.5 C 9.8 13.8, 6.8 14.8, 2.8 12.2 Z" />
  <!-- 右上破界导出箭头 -->
  <path d="M 6.5 6.5 L 13.8 2.2 M 9.8 2 H 14 V 6.2" 
        stroke="context-fill, currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
</svg>""",

    # -------------------------------------------------------------------------
    # 附带 Zotero 10 样式表集成文件 (自动处理亮色/暗黑模式与高分屏渲染)
    # -------------------------------------------------------------------------
    "addon/content/icons/mindflow-icons.css": """/* Mindflow-zotero v11.2.0 - Fluid Origami Wing Icon Stylesheet for Zotero 10 */

.mindflow-icon,
.zotero-tb-button[id^="mindflow-"],
.mindflow-sidebar-tab {
  -moz-context-properties: fill, stroke, fill-opacity, stroke-opacity;
  fill: currentColor;
  stroke: currentColor;
  image-rendering: crisp-edges;
}

/* 主工具栏与阅读器按钮挂载 */
#mindflow-toolbar-btn {
  list-style-image: url("chrome://mindflow/content/icons/toolbar-mindflow.svg");
}

/* 侧边栏 Tab 挂载 */
#mindflow-tab-icon {
  list-style-image: url("chrome://mindflow/content/icons/sidebar-tab-mindflow.svg");
}

/* 思维导图内部画布工具条挂载 */
.mindflow-btn-tree     { list-style-image: url("chrome://mindflow/content/icons/mindmap-branch-flow.svg"); }
.mindflow-btn-add      { list-style-image: url("chrome://mindflow/content/icons/node-add-wing.svg"); }
.mindflow-btn-extract  { list-style-image: url("chrome://mindflow/content/icons/extract-pdf-wing.svg"); }
.mindflow-btn-sync     { list-style-image: url("chrome://mindflow/content/icons/sync-jump-wing.svg"); }
.mindflow-btn-layout   { list-style-image: url("chrome://mindflow/content/icons/layout-switch-wing.svg"); }
.mindflow-btn-collapse { list-style-image: url("chrome://mindflow/content/icons/collapse-expand-wing.svg"); }
.mindflow-btn-focus    { list-style-image: url("chrome://mindflow/content/icons/focus-center-wing.svg"); }
.mindflow-btn-export   { list-style-image: url("chrome://mindflow/content/icons/export-wing.svg"); }
""",

    # -------------------------------------------------------------------------
    # 附带 manifest.json 图标配置片段说明
    # -------------------------------------------------------------------------
    "README-ICONS.md": """# Mindflow-zotero v11.2.0 流体折纸旋翼 (Fluid Origami Wing) 图标集

## 1. `manifest.json` 挂载配置
在 `manifest.json` 中指向主图标 `icon.svg`：

```json
{
  "manifest_version": 2,
  "name": "Mindflow for Zotero",
  "version": "11.2.0",
  "icons": {
    "32": "chrome/content/icons/icon.svg",
    "48": "chrome/content/icons/icon.svg",
    "64": "chrome/content/icons/icon.svg",
    "96": "chrome/content/icons/icon.svg"
  }
}
```

## 2. 图标清单与用途说明
1. `icon.svg`: 插件 64x64 全彩流体折纸旋翼主图标 (manifest.json)
2. `icon-accent.svg`: 24x24 品牌彩色微标 (设置页 Header / 弹窗徽标)
3. `toolbar-mindflow.svg`: 16x16 顶栏与阅读器主按钮 (单色自适应)
4. `sidebar-tab-mindflow.svg`: 16x16 侧边栏页签图标 (紧凑高对比度)
5. `mindmap-branch-flow.svg`: 16x16 思维导图分支拓扑视图
6. `node-add-wing.svg`: 16x16 新建/插入导图节点
7. `extract-pdf-wing.svg`: 16x16 从 PDF 批注流式提取导图
8. `sync-jump-wing.svg`: 16x16 导图与 PDF 原文双向同步定位
9. `layout-switch-wing.svg`: 16x16 思维导图布局切换
10. `collapse-expand-wing.svg`: 16x16 折叠/展开导图子分支
11. `focus-center-wing.svg`: 16x16 画布居中聚焦 Fit-to-View
12. `export-wing.svg`: 16x16 导出思维导图
13. `mindflow-icons.css`: Zotero 10 样式表集成文件 (-moz-context-properties 支持与暗色模式自适应)

## 3. 使用说明
解压后直接将 `content/icons/` 或 `addon/content/icons/` 复制到插件对应目录，并在样式表与 JS 中引用。
"""
}

def main():
    print(f"Creating {ZIP_FILENAME}...")
    with zipfile.ZipFile(ZIP_FILENAME, "w", compression=zipfile.ZIP_DEFLATED) as z:
        for file_path, content in ICONS.items():
            z.writestr(file_path, content.strip())
            print(f"  + Added: {file_path}")
        
        # Add generated multi-resolution PNGs if present
        icons_dir = os.path.join("chrome", "content", "icons")
        if os.path.exists(icons_dir):
            for png_name in sorted(os.listdir(icons_dir)):
                if png_name.endswith(".png"):
                    full_p = os.path.join(icons_dir, png_name)
                    arc_p = f"addon/content/icons/{png_name}"
                    z.write(full_p, arc_p)
                    print(f"  + Added PNG: {arc_p}")

    print(f"\n[DONE] Successfully generated {ZIP_FILENAME}")
    print(f"File size: {os.path.getsize(ZIP_FILENAME):,} bytes")

if __name__ == "__main__":
    main()
