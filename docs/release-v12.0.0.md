# Zotero MindFlow 12.0.0

> **From Papers to Ideas, From Ideas to Knowledge.**  
> **面向科研文献的可视化知识组织与智能思维导图工具。**

Zotero MindFlow 12.0.0 是一个重大的里程碑版本。本版本确立了全新的产品命名规范与完整的 **Fluid Origami Wing (流体折纸旋翼)** 品牌视觉标识体系（VI），并在 Zotero 顶栏、原生标签页、侧栏、应用内工作台、欢迎看板与设置面板实现了全触点高精度适配。

---

## 1. 战略品牌升级与全新定位 (Brand Identity Upgrade)

- **产品官方名称**：`Zotero MindFlow`
- **GitHub 官方仓库**：`groele/Zotero-MindFlow` ([https://github.com/groele/Zotero-MindFlow](https://github.com/groele/Zotero-MindFlow))
- **英文核心标语 (Slogan)**：`From Papers to Ideas, From Ideas to Knowledge.`
- **中文产品定位**：`面向科研文献的可视化知识组织与智能思维导图工具。`
- **兼容性保障**：核心插件 ID 严格保持 `mindflow@groele.org`，无缝覆盖升级，保障用户历史导图、数据库关联、偏好设置和快照资产 100% 平滑继承。

---

## 2. 全新视觉标识系统：Fluid Origami Wing (流体折纸旋翼)

全新的品牌标识摒弃了传统冰冷的星状/拓扑图示，采用现代、富有生机且象征科研灵感流动与蜕变的**流体折纸旋翼**设计：

- **曲率色彩架构**：
  - **顶层流翼 (Wing 1)**：`#06B6D4`（青蓝）→ `#3B82F6`（智蓝），象征文献知识的敏锐洞察与灵感破界。
  - **中层流翼 (Wing 2)**：`#6366F1`（靛青）→ `#A855F7`（紫罗兰），象征知识脉络的结构化重构与逻辑推演。
  - **底层流翼 (Wing 3)**：`#EC4899`（霓粉）→ `#F43F5E`（玫瑰红），柔和托底，象征沉淀扎实的研究结论与成果转化。
- **高分屏与全分辨率光栅资源**：
  - 交付全规格 PNG 栅格资产：`16px`、`32px`、`48px`、`64px`、`96px`、`128px`、`256px` 与超高清 `512px`，保障 Retina 与各类 4K/8K 缩放环境下清晰通透。
  - 核心 SVG 采用 Gecko `-moz-context-properties: fill, stroke` 规范，原生融入明暗主题。

---

## 3. 全触点一体化视觉覆盖 (Omnichannel Touchpoints)

1. **文献库与阅读器主工具栏**：
   - 更新为自适应单色流体折纸矢量图标 (`toolbar-mindflow.svg`)，在明暗主题与焦点状态下自动匹配原生灰度与高亮。
2. **Zotero 原生主标签页 (Native React TabBar)**：
   - 注入高特异性样式 `.tab .tab-icon.icon-mindflow`，注册双通道 `background-image` 与 `list-style-image`，并在 `tabs.add` 中传递 `icon: 'mindflow'`，使打开导图工作区时的标签页完美呈现流体折纸旋翼图标。
3. **文献详情右侧栏 (Item Pane Quick Actions)**：
   - 挂载流体折纸紧凑页签图标 (`sidebar-tab-mindflow.svg`)，在右侧工具栏与快捷操作面板中保持高辨识度。
4. **思维导图工作台 Header (In-App Brand Mark)**：
   - 重构 `MindFlowMark.tsx`，将旧版 MapGraph 升级为全彩流体旋翼向量组件，搭配 `Zotero MindFlow` 品牌标题。
5. **欢迎看板与新手引导 (Welcome & Onboarding)**：
   - 更新 `WelcomeModal.tsx`，展示全新的流体折纸大标与品牌愿景 Slogan。
6. **扩展设置与偏好面板 (Preferences Pane)**：
   - 挂载 24x24 品牌彩色微标 (`icon-accent.svg`) 与现代化配置排版。
7. **画布功能图标族系**：
   - 配套全新设计的旋翼语义化工具条图标集（分支拓扑、节点插入、PDF 流式提取、双向跳转、布局切换、子树折叠、视口聚焦与多格式导出）。

---

## 4. 安装包与兼容性 (Packaging & Compatibility)

- **支持宿主**：Zotero 10.0.x（在 Windows + Zotero 10.0.6 原生环境下完成全量回归）。
- **发布文件交付**：
  - 官方插件安装包：[`zotero-mindflow-12.0.0.xpi`](https://github.com/groele/Zotero-MindFlow/releases/download/v12.0.0/zotero-mindflow-12.0.0.xpi)
