# GitHub Pages 部署说明

在线预览：**https://jiaxiantao.github.io/3d-car-viewing/**

## 目录约定

| 路径 | 用途 |
|------|------|
| `documentation/` | 项目文档（架构、技术博客、GLB 规范等 Markdown） |
| `docs/` | **仅** GitHub Pages 构建产物（由 CI 自动写入，勿手改） |
| `src/`、`public/` | 应用源码与静态资源 |

推送 `main`（且变更不在 `docs/` 内）时，[Deploy GitHub Pages](../.github/workflows/deploy-pages.yml) 会执行 `pnpm build:pages`，并将 `out/` 同步到 **`docs/`**。

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
