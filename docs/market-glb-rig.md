# 主流 GLB 车模交互映射指南

展厅底部按钮（开门、后备箱、车灯等）通过 `discoverAssetCarRig()` 自动扫描 GLB 里的 **mesh 名称**、**材质名** 和 **空间位置** 来绑定。Sketchfab 等导出模型若没有单独车门网格、也没有 glTF 动画，只能做「近似动画」（旋转门饰板、发光尾灯材质等），无法像真车 CAD 那样完美开合。

## ⚠️ 关键前提：部件必须是「可分离的独立网格」

开门 / 开后备箱 / 转车轮这类动作，本质是**旋转或平移某一组 mesh**。能否实现，**完全取决于模型本身怎么拆分**：

| 模型 | mesh 数 | 拆分方式 | 能做什么 |
|------|---------|----------|----------|
| `suv-mainstream.glb`（奥迪 Q3） | 253 | 按**部件**拆 | 门 / 后备箱 / 车灯 / 车轮 / 天窗均可 |
| `2023_bmw_m2_coupe.glb`（宝马 M2） | 1200 | 节点名 `Object_*`，按**材质**识别灯/漆 | 前照灯 / 尾灯发光、改色、启动振动；门与轮为合并网格 |
| `offroad-mainstream.glb`（Brabus G900） | 109 | 按**材质**分组；**路面四轮焊在车身**，仅尾门备胎为独立节点 | 车灯 / 启动振动；**备胎不会旋转**；路面轮不转 |

**判断规则**：如果一个含 `door` 的网格在几何上横跨了大半个车身（材质合并的整体），代码会自动跳过它，不会把整块车身当成门来转——所以这些模型对应的按钮会被**禁用并提示原因**，而不是「点了没反应」。

要实现真正的开门动画，模型必须在建模软件里把每扇门、后备箱盖导成**独立 Object**。

## 按钮与代码对应关系

| 按钮 | 状态字段 | 自动识别规则（摘要） |
|------|----------|----------------------|
| 打开左前门 | `leftDoorOpen` | 名称含 `Door_Black_Plastic` / `Door_Soft` 等，且位于车身前部、左侧（+Z） |
| 打开右前门 | `rightDoorOpen` | 同上，右侧（-Z） |
| 打开后备箱 | `trunkOpen` | 名称含 `Boot_ext`（排除风挡 `Windshild`） |
| 开启车灯 | `lightsOn` | 名称含 `HL`、`Hl_Projection`、`Lamp` 等前部灯件 + 场景点光源 |
| 启动车辆 | `engineOn` | 车身轻微振动 + 车轮旋转 + 前灯更亮 |
| 开启双闪 | `hazardOn` | 尾灯 / `Emiss` 材质闪烁 |
| 打开天窗 | `sunroofOpen` | 名称含 `Roof_glass` 等，向上平移 |

实现文件：

- 自动发现：`src/lib/asset-car-rig.ts`
- 车型覆盖：`src/lib/market-rig-profiles.ts`
- 场景驱动：`src/components/car-showroom-scene.tsx` 中的 `AssetModel`

## 如何查看模型里的 mesh 名称

1. 用 [gltf.report](https://gltf.report/) 或 Blender 导入 `public/models/market/suv-mainstream.glb`。
2. 在场景树里选中车门、大灯、后备箱盖对应的 **Mesh / Object 名称**（例如 `_q3:polySurface5638_Mesh_165_Door_Black_Plastic_...`）。
3. 确认该名称是否被错误归到别的部件（例如 `Door_Tail_lamp` 是尾灯，不是车门）。

## 手动为某一车型添加映射（推荐）

编辑 `src/lib/market-rig-profiles.ts`，增加或修改 `MarketRigProfile`：

```ts
const myCarProfile: MarketRigProfile = {
  id: "my-suv",
  urlPattern: /suv-mainstream/i, // 匹配 modelUrl
  leftDoor: [/polySurface5638/i, /Door_Soft_Black_Plastic_Q3/i],
  rightDoor: [/polySurface5634/i, /polySurface5632/i],
  trunk: [/Boot_ext2_Mesh_049_Carpaint/i],
  headLight: [/^[^/]*HL\d/i, /Hl_Projection_lamp/i],
  tailLight: [/Tail_upper_Red/i, /Tail_inner_Red/i],
  hazardLight: [/Emiss/i, /Tail_inner_Red/i],
  sunroof: [/Roof_glass/i],
  wheel: [/Q3_Tyre/i],
};

export const MARKET_RIG_PROFILES: MarketRigProfile[] = [
  suvQ3Profile,
  myCarProfile,
];
```

保存后刷新展厅页；模型行下方会显示「GLB 部件识别」各项是否为 ✓。

### 填写技巧

- 正则尽量写 **稳定片段**（如 `Boot_ext2`、`HL1_Mesh`），不要写完整 UUID 式长串。
- 左/右门各写 2～6 个门饰板 mesh，不要写 `Door_INT`（内饰）或 `Door_Tail_lamp`（尾灯）。
- 车灯优先写带 `Emiss`、`Lamp`、`HL` 的 mesh，发光效果更明显。
- 若模型是 **单一车身 mesh**、没有独立车门，车门一行会显示「—」，需要在建模软件里拆分车门后再导出。

## limitations（当前技术限制）

- **无 glTF 动画** 时，车门/后备箱是绕铰链旋转一组 mesh，不是厂家级动画。
- **车身喷漆** 与 **车灯玻璃** 是不同材质；改色逻辑不会改灯罩。
- 不同车型（轿车 / 越野）命名差异大，需各自加一条 `MarketRigProfile`。

如需把某车型的完整 mesh 列表导出给开发者，可在浏览器控制台对加载后的场景执行（开发调试用）：

```js
// 在含 Canvas 的页面、模型加载完成后
const names = [];
document.querySelector('canvas')?.__r3f?.roots?.[0]?.store?.getState?.()?.scene?.traverse?.(o => {
  if (o.isMesh) names.push(o.name);
});
console.log(names.filter(n => /door|boot|hl|tail|tyre|roof/i.test(n)));
```

（若控制台结构因版本不同无效，请直接用 gltf.report 查看。）
