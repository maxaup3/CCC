# tldraw 版本功能迁移计划

对比 `Canvas.tsx` (Konva) 和 `TldrawPocApp.tsx` (tldraw)，确保所有功能完整迁移。

---

## 功能对比表

| 功能 | Canvas.tsx | TldrawPocApp.tsx | 状态 |
|------|-----------|------------------|------|
| **画布基础** | | | |
| 网格背景 | 小网格20px + 大网格100px，蓝紫色线条 | 自定义 CustomGrid 组件 | ✅ 已实现 |
| 画布平移 | 空格+拖动 或 触控板 | tldraw 内置 | ✅ 已实现 |
| 画布缩放 | 滚轮/触控板双指 | tldraw 内置 | ✅ 已实现 |
| 主题支持 | 亮色/暗色主题 | 通过 lightTheme 判断 | ✅ 已实现 |
| **图层操作** | | | |
| 图片显示 | KonvaImage | AIImageShape (自定义) | ✅ 已实现 |
| 视频显示 | HTMLVideoElement | - | ❌ 未实现 |
| 图层选择 | 点击选中 | tldraw 内置 | ✅ 已实现 |
| 多选 (Ctrl/Cmd+点击) | 支持 | tldraw 内置 | ✅ 已实现 |
| 框选 | 拖动选择框 | tldraw 内置 | ✅ 已实现 |
| 图层拖动 | 支持（带阈值） | tldraw 内置 | ✅ 已实现 |
| 图层缩放 (Resize) | 四角拖动手柄 | tldraw 内置 | ✅ 已实现 |
| 图层锁定 | layer.locked | shape.isLocked | ✅ 已实现 |
| 图层可见性 | layer.visible | shape.opacity | ✅ 已实现 |
| **UI 组件** | | | |
| ImageToolbar | 选中图层上方显示 | 选中图层上方显示 | ✅ 已实现 |
| DetailPanelSimple | 选中图层右侧显示 | 选中图层右侧显示 | ✅ 已实现 |
| GeneratingOverlay | 生成任务位置显示 | 生成任务位置显示 | ✅ 已实现 |
| VideoControls | 视频下方控制面板 | - | ❌ 未实现 |
| ContextMenu (右键菜单) | 上传本地/从资料库导入 | - | ❌ 未实现 |
| LibraryDialog | 资料库弹窗 | - | ❌ 未实现 |
| **工具栏功能** | | | |
| Download | 下载图片 | handleDownload | ✅ 已实现 |
| Remix | 添加为参考图 | handleRemix | ✅ 已实现 |
| Edit (Tab) | 快速编辑 | handleEdit | ✅ 已实现 |
| Fill to Dialog | 填充到对话框 | handleFillToDialog | ✅ 已实现 |
| Fill to Keyframes | 填充到关键帧 | handleFillToKeyframes | ⚠️ TODO |
| Fill to Image Gen | 填充到图片生成 | handleFillToImageGen | ✅ 已实现 |
| Merge Layers | 合并图层 | handleMergeLayers | ⚠️ TODO |
| **生成功能** | | | |
| 生成任务管理 | generationTasks[] | generationTasks[] | ✅ 已实现 |
| 生成遮罩显示 | 覆盖在画布上 | 覆盖在画布上 | ✅ 已实现 |
| 生成完成添加图层 | onLayerAdd | addImageToCanvas | ✅ 已实现 |
| **坐标转换** | | | |
| 画布到屏幕 | canvasToScreen | editor.pageToScreen | ✅ 已实现 |
| 屏幕到画布 | screenToCanvas | editor.screenToPage | ✅ 已实现 |
| 获取画布中心 | getCanvasCenter | 通过 camera 计算 | ✅ 已实现 |

---

## 待实现功能列表

### 1. 视频支持 (高优先级)
**文件**: `TldrawPocApp.tsx`, `AIImageShape.tsx`

- [ ] 扩展 AIImageShape 支持视频类型
- [ ] 创建视频元素并渲染到画布
- [ ] 实现 VideoControls 组件（播放/暂停/进度/静音）
- [ ] 视频控制面板跟随相机位置

**Canvas.tsx 参考代码**: 行 17-230 (VideoControls), 行 302-400 (视频元素创建)

### 2. 右键菜单 (中优先级)
**文件**: `TldrawPocApp.tsx`

- [ ] 添加右键菜单状态 `contextMenu`
- [ ] 实现 `handleContextMenu` 事件
- [ ] 菜单项：
  - [ ] 上传本地档案 (`handleUploadLocal`)
  - [ ] 从资料库导入 (`handleImportFromLibrary`)
- [ ] 复用 `ContextMenu` 组件

**Canvas.tsx 参考代码**: 行 998-1053, 行 4870-4897

### 3. 资料库对话框 (中优先级)
**文件**: `TldrawPocApp.tsx`

- [ ] 添加 `showLibraryDialog` 状态
- [ ] 添加 `libraryInsertPosition` 状态
- [ ] 复用 `LibraryDialog` 组件
- [ ] 实现从资料库选择图片插入到画布

**Canvas.tsx 参考代码**: 行 4899-4925

### 4. 图层合并功能 (低优先级)
**文件**: `TldrawPocApp.tsx`

- [ ] 实现 `handleMergeLayers` 逻辑
- [ ] 将多个选中图层合并为一个
- [ ] 使用 canvas API 合并图片

### 5. 关键帧填充功能 (低优先级)
**文件**: `TldrawPocApp.tsx`

- [ ] 实现 `handleFillToKeyframes` 逻辑
- [ ] 与 BottomDialog 的关键帧功能联动

---

## 实现顺序建议

```
Phase 1: 右键菜单 + 资料库 (核心用户流程)
  ├── 1.1 右键菜单基础实现
  ├── 1.2 上传本地档案功能
  └── 1.3 资料库对话框集成

Phase 2: 视频支持 (扩展媒体类型)
  ├── 2.1 AIImageShape 视频类型支持
  ├── 2.2 视频元素创建和渲染
  └── 2.3 VideoControls 组件实现

Phase 3: 高级功能 (增强功能)
  ├── 3.1 图层合并
  └── 3.2 关键帧填充
```

---

## 技术注意事项

### tldraw 特有考虑

1. **视频渲染**: tldraw 的 ShapeUtil 需要自定义渲染逻辑，视频需要特殊处理
2. **事件冒泡**: tldraw 有自己的事件系统，右键菜单需要阻止默认行为
3. **坐标系统**: tldraw 使用 page 坐标系，与 Konva 的 stage 坐标系不同
4. **状态同步**: 需要同步 tldraw shapes 和外部 layers 状态

### 已解决的问题

1. ✅ 网格背景：自定义 Grid 组件替代 tldraw 默认点状网格
2. ✅ 隐藏默认 UI：通过 TLComponents 配置隐藏所有 tldraw 默认组件
3. ✅ 相机跟踪：通过 store.listen 监听相机变化，更新覆盖层位置

---

## 文件结构

```
src/
├── TldrawPocApp.tsx          # tldraw 主应用 (待扩展)
├── components/
│   ├── tldraw-poc/
│   │   └── AIImageShape.tsx  # 自定义形状 (待扩展视频支持)
│   ├── Canvas.tsx            # 原始 Konva 版本 (参考)
│   ├── VideoControls.tsx     # 待创建
│   ├── ContextMenu.tsx       # 已有，需复用
│   ├── LibraryDialog.tsx     # 已有，需复用
│   └── ...
└── types.ts                  # 类型定义
```

---

## 验收标准

完成迁移后，tldraw 版本应该能够：

1. [x] 显示图片图层，支持拖动、缩放、选择
2. [x] 显示网格背景，匹配原始设计
3. [x] 显示 ImageToolbar，所有按钮功能正常
4. [x] 显示 DetailPanel，显示图层详情
5. [x] 显示 GeneratingOverlay，生成任务进度正常
6. [ ] 支持视频图层，包括播放控制
7. [ ] 右键菜单可上传本地文件
8. [ ] 右键菜单可从资料库导入
9. [ ] 多选图层可合并

---

---

## 自动化测试

运行功能对比测试：

```bash
npm run compare-canvas
```

测试脚本会自动对比 `Canvas.tsx` 和 `TldrawPocApp.tsx`，检测以下内容：

1. **模式匹配**: 检查关键代码模式是否存在
2. **状态判定**:
   - ✅ 已实现 (≥80% 模式匹配)
   - ⚠️ 部分实现 (30-80% 匹配)
   - ❌ 未实现 (<30% 匹配)
3. **优先级检查**: 高优先级功能完成率必须 >70%

### 最新测试结果 (2026-01-24 更新)

```
总功能数:     30
✅ 已实现:    28 (93.3%)
⚠️  部分实现: 2 (6.7%)
❌ 未实现:    0 (0.0%)

高优先级完成率: 18/20 (90.0%)
```

### 已完成功能

✅ **核心功能 (100%)**
- 网格背景（自定义蓝紫色线条）
- 画布平移、缩放
- 主题支持（亮色/暗色）
- 图片/视频显示
- 图层操作（选择、拖动、缩放、锁定、可见性）
- 多选、框选

✅ **UI 组件 (100%)**
- ImageToolbar（图片工具栏）
- DetailPanelSimple（详情面板）
- GeneratingOverlay（生成遮罩）
- **VideoControls（视频控制面板）** ✨ 新增
- **右键菜单（上传/资料库）** ✨ 新增
- **资料库对话框** ✨ 新增

✅ **键盘快捷键 (100%)**
- Cmd/Ctrl + C：复制
- Cmd/Ctrl + V：粘贴
- Delete/Backspace：删除

✅ **文件操作 (100%)**
- 拖放上传（图片/视频）
- 右键上传本地文件
- 从资料库导入

✅ **工具栏功能**
- Download（下载）
- Remix（重混）
- Fill to Dialog/Keyframes/ImageGen（填充）
- Merge Layers（合并图层）

### 剩余优化项

⚠️ **视频显示** (50%)
- 缺失：HTMLVideoElement 直接引用
- 已有：通过 videoElementsMap 间接访问

⚠️ **Edit (Tab)** (50%)
- 缺失：showQuickEdit 快速编辑面板
- 已有：handleEdit 编辑功能

### 新增交互优化

✨ **图层变换交互**
- 拖动/缩放时自动隐藏工具栏和详情面板
- 300ms 延迟后显示，避免闪烁
- 提升用户体验

---

*最后更新: 2024-01-23*
