# 3D 看车

基于 **Next.js**、**React Three Fiber** 与 **Three.js** 的 3D 看车交互演示。

## 功能

- GLB 车型切换（SUV / 小轿车 / 越野车）与几何体回退车模
- 车门、后备箱、天窗、车灯、双闪、启动与制动模拟
- 车漆配色、多视角预设、自动环车巡检
- 点击 3D 模型部件直接交互（依 GLB 骨骼/命名识别，见 `docs/market-glb-rig.md`）

## 本地开发

```bash
pnpm install
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 构建与生产

```bash
pnpm build
pnpm start
```

## 车型资源

将 GLB 放到 `public/models/market/`：

| 文件 | 用途 |
|------|------|
| `suv-mainstream.glb` | SUV |
| `2023_bmw_m2_coupe.glb` | 小轿车 |
| `offroad-mainstream.glb` | 越野车 |

回退模型位于 `public/models/cars/`。

## Docker

```bash
docker compose up --build
```

## 技术栈

- Next.js 16 · React 19
- @react-three/fiber · @react-three/drei · three
- TypeScript · Tailwind CSS 4
