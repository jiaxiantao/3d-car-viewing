# 3D Car Viewing · 3D 看车

[![CI](https://github.com/jiaxiantao/3d-car-viewing/actions/workflows/ci.yml/badge.svg)](https://github.com/jiaxiantao/3d-car-viewing/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**English:** Browser-based 3D car showroom built with **Next.js**, **React Three Fiber**, and **Three.js**. Switch GLB vehicles, interact with doors/lights/paint, orbit the camera, and fall back to a procedural car when assets fail to load.

**中文：** 在浏览器中体验 3D 看车：车型切换、部件交互、车漆与环车巡检；支持主流 GLB 车模与几何体回退。

## 功能特性

- **车型切换**：SUV / 小轿车 / 越野车（`public/models/market/*.glb`）
- **部件交互**：车门、后备箱、天窗、车灯、双闪、启动、制动（依 GLB 网格命名自动识别）
- **视觉**：车漆配色、多机位预设、自动环车巡检、本地 IBL 光照（无外部 HDR CDN 依赖）
- **健壮性**：GLB 加载失败时回退内置几何体车模；切换车型时保留上一模型直至新资源就绪

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+

### 安装与开发

```bash
git clone https://github.com/jiaxiantao/3d-car-viewing.git
cd 3d-car-viewing
pnpm install
cp .env.example .env   # 可选，见下方环境变量
pnpm dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

> **仓库体积说明：** `public/models/market/` 内含约 **120MB** 的 GLB 资源，首次 clone 会较慢。若你只需改前端逻辑，可暂时删除 GLB，应用会自动使用几何体回退车模。

### 环境变量

| 变量 | 说明 | 默认 |
|------|------|------|
| `NEXT_PUBLIC_SITE_URL` | 站点 URL（元数据 / 部署） | `http://localhost:3000` |

复制 `.env.example` 为 `.env` 即可本地覆盖。

### 构建与生产

```bash
pnpm build          # Next.js standalone 输出
pnpm start          # node .next/standalone/server.js
pnpm lint           # ESLint
pnpm typecheck      # tsc --noEmit
```

### Docker

```bash
docker compose up --build
```

服务监听 `http://localhost:3000`。

## 项目结构

```
├── src/
│   ├── app/                    # Next.js App Router（page、layout）
│   ├── components/
│   │   ├── car-showroom-scene.tsx   # R3F 展厅主场景
│   │   └── showroom-environment.tsx # 地面、灯光、本地 IBL
│   └── lib/
│       ├── asset-car-rig.ts         # GLB 部件自动发现
│       ├── market-rig-profiles.ts   # 按车型 URL 的识别规则
│       └── showroom-camera.ts       # 相机与轨道限制
├── public/models/market/       # GLB 车模（见 ATTRIBUTION）
├── docs/
│   ├── market-glb-rig.md       # 交互映射与建模要求
│   ├── ARCHITECTURE.md         # 架构说明
│   └── ATTRIBUTION.md          # 第三方资源与许可
└── .github/workflows/ci.yml    # lint + typecheck + build
```

更细的模块关系见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 车型资源

将 GLB 放到 `public/models/market/`（文件名需与 `src/app/page.tsx` 中配置一致）：

| 文件 | 用途 |
|------|------|
| `suv-mainstream.glb` | SUV |
| `sedan-mainstream.glb` | 小轿车 |
| `offroad-mainstream.glb` | 越野车 |

- 加载失败 → 自动使用内置几何体 `CarModel`
- 自定义车型 → 阅读 [docs/market-glb-rig.md](docs/market-glb-rig.md)，在 `market-rig-profiles.ts` 增加 `MarketRigProfile`

**许可与商标：** 仓库内示例 GLB 来自第三方作者，**本仓库 MIT 许可证仅覆盖源代码**，不包含车模知识产权。商用或再分发前请阅读 [docs/ATTRIBUTION.md](docs/ATTRIBUTION.md) 并自行确认授权。

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 · React 19 |
| 3D | three · @react-three/fiber · @react-three/drei |
| 样式 | Tailwind CSS 4 · TypeScript 5 |

## 参与贡献

欢迎 Issue 与 Pull Request。请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 与 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。

安全相关问题请见 [SECURITY.md](SECURITY.md)，勿在公开 Issue 中披露漏洞细节。

## 更新日志

见 [CHANGELOG.md](CHANGELOG.md)。

## 许可证

本项目**源代码**采用 [MIT License](LICENSE)。

Bundled 3D models in `public/models/market/` are subject to their respective authors' licenses — see [docs/ATTRIBUTION.md](docs/ATTRIBUTION.md).
