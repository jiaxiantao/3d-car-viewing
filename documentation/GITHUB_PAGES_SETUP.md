# GitHub Pages 部署说明

在线预览：**https://jiaxiantao.github.io/3d-car-viewing/**

## 目录约定

| 路径 | 用途 |
|------|------|
| `documentation/` | 项目文档（架构、技术博客、GLB 规范等 Markdown） |
| `src/`、`public/` | 应用源码与静态资源 |
| `out/`（本地） | `pnpm build:pages` 输出；由 Actions 上传为 Pages artifact，**不**再写入仓库 |

构建完成后会执行 `scripts/prepare-gh-pages-export.mjs`，将 `_next` 重命名为 `next-static` 并写入 `.nojekyll`（兼容本地静态托管与历史分支部署约定）。

## Pages 配置（一次性）

1. **Settings → Pages → Build and deployment**
2. **Source** → **GitHub Actions**（不再使用 Deploy from a branch / `/docs`）
3. 推送 `main` 或手动运行 **Deploy GitHub Pages** 工作流

若仓库仍显示旧的 `docs/` 分支部署，切到 Actions 后以最新 workflow 为准。

## 验证

1. 等待 **Deploy GitHub Pages** 成功（压缩后 GLB 约数十 MB，通常数分钟内完成）
2. 打开预览链接并强制刷新（`Cmd+Shift+R`）

## 本地验证

```bash
pnpm build:pages
npx serve out -l 4173
# http://localhost:4173/3d-car-viewing/
```
