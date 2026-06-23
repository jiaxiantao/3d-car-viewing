# GitHub Pages 部署说明

在线预览：**https://jiaxiantao.github.io/3d-car-viewing/**

## 目录约定

| 路径 | 用途 |
|------|------|
| `documentation/` | 项目文档（架构、技术博客、GLB 规范等 Markdown） |
| `docs/` | **仅** GitHub Pages 构建产物（由 CI 自动写入，勿手改） |
| `src/`、`public/` | 应用源码与静态资源 |

构建完成后会执行 `scripts/prepare-gh-pages-export.mjs`，将 `_next` 重命名为 `next-static`（GitHub Pages 的 Jekyll 会忽略以下划线开头的目录，否则 CSS/JS 全部 404）。

## Pages 配置

1. **Settings → Pages → Build and deployment**
2. **Source** → **Deploy from a branch**
3. **Branch** → **`main`**，文件夹 → **`/docs`**
4. 保存

## 验证

1. 等待 **Deploy GitHub Pages** 工作流成功（含约 120MB GLB，首次可能 5–10 分钟）
2. 打开预览链接并强制刷新（`Cmd+Shift+R`）

## 本地验证

```bash
pnpm build:pages
npx serve out -l 4173
# http://localhost:4173/3d-car-viewing/
```
