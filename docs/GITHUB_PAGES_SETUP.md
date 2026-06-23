# GitHub Pages 部署说明

在线预览地址：**https://jiaxiantao.github.io/3d-car-viewing/**

## 为什么不能从 `main` 的 `/docs` 发布？

| 路径 | 内容 | 能否作为 3D 看车站点 |
|------|------|----------------------|
| `docs/`（main 分支） | Markdown 文档 + 本说明页 | 否 — 没有 Next.js 构建产物 |
| `gh-pages` 分支（root） | CI 构建的静态站点（`index.html`、`_next/`、`models/` 等） | 是 |

GLB 车模合计约 120MB，不适合提交到 `main` 的 `docs/`。推送 `main` 后，[Deploy GitHub Pages](../.github/workflows/deploy-pages.yml) 工作流会执行 `pnpm build:pages`，并将 `out/` 发布到 **`gh-pages` 分支**。

## 一次性配置（必做）

1. 打开仓库 **Settings → Pages**
2. **Build and deployment → Source**：选择 **Deploy from a branch**
3. **Branch**：选择 **`gh-pages`**，文件夹选择 **`/ (root)`**
4. 点击 **Save**

> 若当前为 `main` + `/docs`，站点只会读到 Markdown，访问预览链接会 404 或只看到配置说明页。

## 验证部署

1. 推送代码到 `main`，或到 **Actions** 手动运行 **Deploy GitHub Pages**
2. 工作流显示绿色成功后，等待 1–2 分钟
3. 打开 https://jiaxiantao.github.io/3d-car-viewing/ 并强制刷新（`Cmd+Shift+R`）

SUV 模型约 53MB，首次加载可能需要数秒。

## 本地验证静态导出

```bash
pnpm build:pages
# 产物在 out/，可用任意静态服务器预览，需带 basePath：
npx serve out -l 4173
# 浏览器打开 http://localhost:4173/3d-car-viewing/
```
