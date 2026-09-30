"use client";

import { ContactShadows } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SHOWROOM_GROUND_Y } from "@/components/showroom-environment";
import { registerSpecularGlossiness } from "@/lib/gltf-specular-glossiness";
import type { ShowroomLightingMode } from "@/lib/showroom-scene-modes";
import { publicAssetPath } from "@/lib/public-asset-path";
import {
  repeatWindow,
  sceneryShiftX,
  wrappedTextureOffset,
  wrapRange,
} from "@/lib/showroom-drive";

/** Road runs along X. Showroom forward is −X, so the driver's right is −Z. */
const ROAD_LENGTH = 84;
const ROAD_WIDTH = 10;
/**
 * Lane marks in canvas space (0 = top of the texture).
 * The ground plane is rotated −90° about X and the texture flips Y, so the
 * top of the canvas lands on world −Z — the right-hand side of the road.
 */
const ROAD_EDGE_T = 0.045;
const ROAD_DASH_T = 0.25;
const ROAD_YELLOW_T = 0.472;

/** World Z of a lane mark on the unshifted road. */
export function roadMarkWorldZ(canvasT: number, roadWidth = ROAD_WIDTH) {
  return (canvasT - 0.5) * roadWidth;
}

/**
 * Shift that puts the first right-hand lane (between the yellow line and the
 * near dashed line) under the car at z = 0.
 */
export function roadRightLaneOffsetZ(roadWidth = ROAD_WIDTH) {
  const laneCenterT = (ROAD_DASH_T + ROAD_YELLOW_T) / 2;
  return -roadMarkWorldZ(laneCenterT, roadWidth);
}

const ROAD_RIGHT_LANE_OFFSET_Z = roadRightLaneOffsetZ();
const GRASS_SIZE = 240;
/** Tiles of asphalt grain and lane paint along the road. +U is world +X. */
const ROAD_TEXTURE_REPEAT_X = 16;
/** Tiles of the verge texture across the ground plane. +U is world +X. */
const GRASS_TEXTURE_REPEAT = 18;
/**
 * Asphalt grain is repeated along the road, so a full 1024×512 / 5-octave
 * texture blocks the click that switches venues (~180ms). Half resolution and
 * fewer octaves stay visually the same once the map is tiled.
 */
export const ROAD_SURFACE_TEXTURE = { width: 512, height: 256 } as const;
const ROAD_TEXTURE_NOISE_OCTAVES = 3;
/**
 * Distant ridges sit behind fog. 220×96 segments with 5 noise octaves blocked
 * the same click for another ~70ms; this grid keeps the silhouette.
 */
export const MOUNTAIN_SEGMENTS = { across: 128, depth: 48 } as const;
const MOUNTAIN_NOISE_OCTAVES = 4;
const GRASS_MODEL_URL = publicAssetPath("/models/scene/realtime_grass.glb");
/** Scattered blades in the file are under one unit tall; the upright source cards are not. */
const GRASS_BLADE_HEIGHT = 0.7;
const GRASS_UPRIGHT_HEIGHT = 2;
const GRASS_BLADE_STRIDE = 4;
/** Extra drop so the visible roots sit just under the shoulder, not on the surface. */
const GRASS_GROUND_SINK = 0.08;
const TREE_MODEL_URL = publicAssetPath("/models/scene/tree_animate.glb");
/** Broad canopy: keep the crown beside the lanes instead of covering the car. */
const TREE_HEIGHT = 5.2;

function hash(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function fade(t: number) {
  return t * t * (3 - 2 * t);
}

function hash2(ix: number, iy: number) {
  const x = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function valueNoise(x: number, y: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = fade(x - ix);
  const fy = fade(y - iy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

function fbm2(x: number, y: number, octaves = 5) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let octave = 0; octave < octaves; octave += 1) {
    value += amplitude * valueNoise(x * frequency, y * frequency);
    frequency *= 2;
    amplitude *= 0.5;
  }
  return value;
}

function ridgedFbm(x: number, y: number, octaves = 5) {
  let value = 0;
  let amplitude = 0.55;
  let frequency = 1;
  for (let octave = 0; octave < octaves; octave += 1) {
    const n = 1 - Math.abs(valueNoise(x * frequency, y * frequency) * 2 - 1);
    value += amplitude * n * n;
    frequency *= 2.03;
    amplitude *= 0.5;
  }
  return value;
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function createRoadTexture() {
  const along = ROAD_SURFACE_TEXTURE.width;
  const across = ROAD_SURFACE_TEXTURE.height;
  const canvas = document.createElement("canvas");
  canvas.width = along;
  canvas.height = across;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  const image = ctx.createImageData(along, across);
  for (let y = 0; y < across; y += 1) {
    for (let x = 0; x < along; x += 1) {
      const grain = fbm2(x * 0.07, y * 0.16, ROAD_TEXTURE_NOISE_OCTAVES);
      const grit = hash(x * 13.1 + y * 7.7);
      const shade = 58 + grain * 22 + (grit > 0.92 ? 18 : 0);
      const index = (y * along + x) * 4;
      image.data[index] = shade;
      image.data[index + 1] = shade + 3;
      image.data[index + 2] = shade + 8;
      image.data[index + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  const row = (t: number, thickness: number) => ({
    y: t * across - thickness / 2,
    h: thickness,
  });
  const mark = (pixelsAt512: number) => Math.max(2, Math.round(pixelsAt512 * (across / 512)));

  ctx.fillStyle = "#f3f5f7";
  const edge = row(ROAD_EDGE_T, mark(10));
  ctx.fillRect(0, edge.y, along, edge.h);
  const edgeFar = row(1 - ROAD_EDGE_T, mark(10));
  ctx.fillRect(0, edgeFar.y, along, edgeFar.h);

  ctx.fillStyle = "#e2b21a";
  const yellowA = row(ROAD_YELLOW_T, mark(7));
  const yellowB = row(1 - ROAD_YELLOW_T, mark(7));
  ctx.fillRect(0, yellowA.y, along, yellowA.h);
  ctx.fillRect(0, yellowB.y, along, yellowB.h);

  ctx.fillStyle = "#f4f5f3";
  // One cycle per tile so RepeatWrapping has no seam. Segment : gap ≈ 1 : 2,
  // about 1.75 and 3.5 world units at repeat 16 (car length is 4).
  const dashLength = Math.round(along / 3);
  const gap = along - dashLength;
  const laneA = row(ROAD_DASH_T, mark(8));
  const laneB = row(1 - ROAD_DASH_T, mark(8));
  for (let x = 0; x < along; x += dashLength + gap) {
    ctx.fillRect(x, laneA.y, dashLength, laneA.h);
    ctx.fillRect(x, laneB.y, dashLength, laneB.h);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
  texture.repeat.set(ROAD_TEXTURE_REPEAT_X, 1);
  texture.needsUpdate = true;
  return texture;
}

const SKY_VERTEX = `
  varying vec3 vDir;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vDir = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const SKY_FRAGMENT = `
  uniform vec3 uHorizon;
  uniform vec3 uMid;
  uniform vec3 uZenith;
  uniform vec3 uCloud;
  uniform float uCloudStrength;
  varying vec3 vDir;
  float skyHash(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
  }
  float skyNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = skyHash(i);
    float b = skyHash(i + vec2(1.0, 0.0));
    float c = skyHash(i + vec2(0.0, 1.0));
    float d = skyHash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float skyFbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      value += amplitude * skyNoise(p);
      p = p * 2.02 + vec2(3.1, 1.7);
      amplitude *= 0.5;
    }
    return value;
  }
  void main() {
    vec3 dir = normalize(vDir);
    float h = clamp(dir.y, 0.0, 1.0);
    vec3 color = mix(uHorizon, uMid, smoothstep(0.0, 0.24, h));
    color = mix(color, uZenith, smoothstep(0.18, 0.75, h));
    vec2 cloudUv = dir.xz / max(dir.y, 0.18);
    float cloud = skyFbm(cloudUv * 0.85);
    float detail = skyFbm(cloudUv * 2.4 + 6.0);
    float cover = smoothstep(0.56, 0.74, cloud) * smoothstep(0.72, 0.4, detail);
    cover *= smoothstep(0.05, 0.2, h);
    color = mix(color, uCloud, clamp(cover, 0.0, uCloudStrength));
    gl_FragColor = vec4(color, 1.0);
  }
`;

const DAY_SKY = {
  horizon: new THREE.Vector3(0.45, 0.67, 0.9),
  mid: new THREE.Vector3(0.12, 0.4, 0.82),
  zenith: new THREE.Vector3(0.03, 0.18, 0.58),
  cloud: new THREE.Vector3(0.93, 0.95, 0.97),
  cloudStrength: 0.82,
};

const NIGHT_SKY = {
  horizon: new THREE.Vector3(0.1, 0.14, 0.24),
  mid: new THREE.Vector3(0.04, 0.07, 0.16),
  zenith: new THREE.Vector3(0.012, 0.02, 0.06),
  cloud: new THREE.Vector3(0.16, 0.18, 0.24),
  cloudStrength: 0.28,
};

function RoadSky({ lighting }: { lighting: ShowroomLightingMode }) {
  const material = useMemo(() => {
    const sky = lighting === "night" ? NIGHT_SKY : DAY_SKY;
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        uHorizon: { value: sky.horizon.clone() },
        uMid: { value: sky.mid.clone() },
        uZenith: { value: sky.zenith.clone() },
        uCloud: { value: sky.cloud.clone() },
        uCloudStrength: { value: sky.cloudStrength },
      },
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
    });
  }, [lighting]);

  useLayoutEffect(() => () => material.dispose(), [material]);

  return (
    <mesh frustumCulled={false} renderOrder={-1} material={material}>
      <sphereGeometry args={[160, 40, 24]} />
    </mesh>
  );
}

type TreeGltf = {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  parser: {
    json: {
      materials?: Array<{
        name?: string;
        extensions?: {
          KHR_materials_pbrSpecularGlossiness?: {
            diffuseTexture?: { index: number };
          };
        };
      }>;
    };
    associations: Map<object, { materials?: number }>;
    getDependency: (type: string, index: number) => Promise<THREE.Texture>;
  };
};

type PlacedTree = {
  position: [number, number, number];
  rotationY: number;
  scale: number;
  timeOffset: number;
  repeatMinX: number;
  repeatSpan: number;
};

function buildTreePlacements(alongReach: number, sideReach: number): PlacedTree[] {
  const placements: PlacedTree[] = [];
  const roadEdge = ROAD_WIDTH / 2;
  const longReach = Math.max(alongReach, sideReach);
  const shortReach = Math.min(alongReach, sideReach);
  /** Crown’s long axis stays along the road, so only the narrow side faces the lanes. */
  const yawBase = sideReach > alongReach ? Math.PI / 2 : 0;
  const outward = shortReach * 0.58 + 0.15;
  const step = Math.max(longReach * 1.15, 9);
  const leftNear = -(roadEdge + outward);
  const leftFar = leftNear - shortReach * 2.1 - 1.8;
  const rightNear = roadEdge + outward;
  let index = 0;
  const placeRow = (z: number, rowStep: number, scaleMul: number, xOffset: number) => {
    const outwardSign = Math.sign(z) || 1;
    const row: PlacedTree[] = [];
    const start = -ROAD_LENGTH / 2 + (xOffset % rowStep);
    for (let x = start; x <= ROAD_LENGTH / 2; x += rowStep) {
      const jitterX = (hash(index * 3.1) - 0.5) * 0.7;
      const jitterZ = (hash(index * 5.7) - 0.35) * 0.6 * outwardSign;
      row.push({
        position: [x + jitterX, SHOWROOM_GROUND_Y, z + jitterZ],
        rotationY: yawBase + (hash(index + 2) - 0.5) * 0.35,
        scale: scaleMul * (0.86 + hash(index * 8.2) * 0.14),
        timeOffset: hash(index + 9),
        repeatMinX: 0,
        repeatSpan: rowStep,
      });
      index += 1;
    }
    if (row.length === 0) {
      return;
    }
    const xs = row.map((tree) => tree.position[0]);
    const repeat = repeatWindow(Math.min(...xs), Math.max(...xs), rowStep);
    for (const tree of row) {
      tree.repeatMinX = repeat.min;
      tree.repeatSpan = repeat.span;
    }
    placements.push(...row);
  };
  placeRow(leftNear, step, 1, 0);
  placeRow(leftFar, step * 1.2, 0.78, step * 0.45);
  placeRow(rightNear, step * 1.05, 0.88, step * 0.25);
  return placements;
}

function prepareTreeLighting(material: THREE.MeshStandardMaterial) {
  const name = material.name.toLowerCase();
  material.metalness = 0;
  material.envMapIntensity = name.includes("leaf") ? 0.62 : 0.34;
  if (name.includes("leaf")) {
    material.roughness = 0.58;
    material.shadowSide = THREE.DoubleSide;
  } else if (name.includes("branch")) {
    material.roughness = 0.74;
  } else {
    material.roughness = 0.86;
  }
  material.needsUpdate = true;
}

async function applySpecularGlossinessColorMaps(
  gltf: TreeGltf,
  prepare: (material: THREE.MeshStandardMaterial) => void,
) {
  const pending: Promise<void>[] = [];
  gltf.scene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) {
      return;
    }
    mesh.receiveShadow = true;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const leaf = materials.some((material) => material.name.toLowerCase().includes("leaf"));
    // Alpha-tested leaves in the shadow map are the expensive part of the road pass.
    mesh.castShadow = !leaf;
    for (const material of materials) {
      const standard = material as THREE.MeshStandardMaterial;
      if (!standard.isMeshStandardMaterial) {
        continue;
      }
      const materialIndex = gltf.parser.associations.get(standard)?.materials;
      const extension =
        materialIndex == null
          ? undefined
          : gltf.parser.json.materials?.[materialIndex]?.extensions
              ?.KHR_materials_pbrSpecularGlossiness;
      pending.push(
        (async () => {
          if (extension?.diffuseTexture && !standard.map) {
            const texture = await gltf.parser.getDependency("texture", extension.diffuseTexture.index);
            texture.colorSpace = THREE.SRGBColorSpace;
            standard.map = texture;
          }
          prepare(standard);
        })(),
      );
    }
  });
  await Promise.all(pending);
}

async function applyTreeColorMaps(gltf: TreeGltf) {
  await applySpecularGlossinessColorMaps(gltf, prepareTreeLighting);
}

function trunkBasePoint(root: THREE.Object3D): THREE.Vector3 {
  const band: THREE.Vector3[] = [];
  let minY = Infinity;
  const vertex = new THREE.Vector3();
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) {
      return;
    }
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.Material;
    if (!material.name.toLowerCase().includes("bark")) {
      return;
    }
    const position = mesh.geometry.getAttribute("position");
    for (let index = 0; index < position.count; index += 1) {
      vertex.fromBufferAttribute(position, index);
      mesh.localToWorld(vertex);
      if (vertex.y < minY - 1e-3) {
        minY = vertex.y;
        band.length = 0;
        band.push(vertex.clone());
      } else if (vertex.y <= minY + 0.12) {
        band.push(vertex.clone());
      }
    }
  });
  const trunk = new THREE.Vector3();
  if (band.length === 0) {
    const bounds = new THREE.Box3().setFromObject(root);
    return bounds.getCenter(trunk);
  }
  for (const point of band) {
    trunk.add(point);
  }
  return trunk.multiplyScalar(1 / band.length);
}

function normalizeRoadsideTree(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  root.scale.multiplyScalar(TREE_HEIGHT / Math.max(size.y, 1e-3));
  root.updateMatrixWorld(true);
  const trunk = trunkBasePoint(root);
  const grounded = new THREE.Box3().setFromObject(root);
  root.position.x -= trunk.x;
  root.position.z -= trunk.z;
  root.position.y -= grounded.min.y;
}

function RoadSunShadows() {
  const scene = useThree((state) => state.scene);

  useLayoutEffect(() => {
    const lights: THREE.DirectionalLight[] = [];
    scene.traverse((child) => {
      const light = child as THREE.DirectionalLight;
      if (light.isDirectionalLight && light.castShadow) {
        lights.push(light);
      }
    });
    const sun = lights[0];
    if (!sun) {
      return;
    }
    const shadowCamera = sun.shadow.camera;
    const previous = {
      left: shadowCamera.left,
      right: shadowCamera.right,
      top: shadowCamera.top,
      bottom: shadowCamera.bottom,
      near: shadowCamera.near,
      far: shadowCamera.far,
      bias: sun.shadow.bias,
      normalBias: sun.shadow.normalBias,
    };
    // Keep the 1024 map allocated for the studio. Reallocating a 2048 map on
    // this switch drops a frame and then shades every tree into it.
    shadowCamera.left = -34;
    shadowCamera.right = 34;
    shadowCamera.top = 34;
    shadowCamera.bottom = -34;
    shadowCamera.near = 0.5;
    shadowCamera.far = 70;
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.08;
    shadowCamera.updateProjectionMatrix();
    sun.shadow.needsUpdate = true;
    return () => {
      sun.shadow.camera.left = previous.left;
      sun.shadow.camera.right = previous.right;
      sun.shadow.camera.top = previous.top;
      sun.shadow.camera.bottom = previous.bottom;
      sun.shadow.camera.near = previous.near;
      sun.shadow.camera.far = previous.far;
      sun.shadow.bias = previous.bias;
      sun.shadow.normalBias = previous.normalBias;
      sun.shadow.camera.updateProjectionMatrix();
      sun.shadow.needsUpdate = true;
    };
  }, [scene]);

  return null;
}

type TreeModel = {
  root: THREE.Object3D;
  clip: THREE.AnimationClip | null;
  placements: PlacedTree[];
};

let treeModelCache: TreeModel | null = null;
let treeModelPromise: Promise<TreeModel | null> | null = null;

function loadTreeModel() {
  if (treeModelCache) {
    return Promise.resolve(treeModelCache);
  }
  if (!treeModelPromise) {
    treeModelPromise = new Promise((resolve) => {
      const loader = new GLTFLoader();
      registerSpecularGlossiness(loader);
      loader.load(
        TREE_MODEL_URL,
        (gltf) => {
          const loaded = gltf as unknown as TreeGltf;
          void applyTreeColorMaps(loaded)
            .then(() => {
              normalizeRoadsideTree(loaded.scene);
              loaded.scene.updateMatrixWorld(true);
              const bounds = new THREE.Box3().setFromObject(loaded.scene);
              const alongReach = Math.max(Math.abs(bounds.min.x), bounds.max.x);
              const sideReach = Math.max(Math.abs(bounds.min.z), bounds.max.z);
              const wrapper = new THREE.Group();
              wrapper.add(loaded.scene);
              const model: TreeModel = {
                root: wrapper,
                clip: loaded.animations.find((item) => item.name === "MorphBake") ?? loaded.animations[0] ?? null,
                placements: buildTreePlacements(alongReach, sideReach),
              };
              treeModelCache = model;
              resolve(model);
            })
            .catch((error: unknown) => {
              console.error("Roadside tree materials failed to load", error);
              treeModelPromise = null;
              resolve(null);
            });
        },
        undefined,
        (error) => {
          console.error("Roadside tree model failed to load", error);
          treeModelPromise = null;
          resolve(null);
        },
      );
    });
  }
  return treeModelPromise;
}

function RoadsideTrees({
  reduceMotion,
  travelRef,
}: {
  reduceMotion: boolean;
  travelRef: RefObject<number>;
}) {
  const [model, setModel] = useState<TreeModel | null>(() => treeModelCache);
  const mixers = useRef<THREE.AnimationMixer[]>([]);
  const appliedTravel = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadTreeModel().then((loaded) => {
      if (!cancelled) {
        setModel(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const clones = useMemo(() => {
    if (!model) {
      return [];
    }
    return model.placements.map((placement) => {
      const clone = model.root.clone(true);
      clone.position.set(placement.position[0], placement.position[1], placement.position[2]);
      clone.rotation.y = placement.rotationY;
      clone.scale.multiplyScalar(placement.scale);
      return clone;
    });
  }, [model]);

  useLayoutEffect(() => {
    appliedTravel.current = null;
    if (!model?.clip) {
      mixers.current = [];
      return;
    }
    const created = clones.map((clone, index) => {
      const mixer = new THREE.AnimationMixer(clone);
      const action = mixer.clipAction(model.clip as THREE.AnimationClip);
      action.play();
      action.time = model.placements[index].timeOffset * action.getClip().duration;
      action.paused = reduceMotion;
      return mixer;
    });
    mixers.current = created;
    return () => {
      created.forEach((mixer) => mixer.stopAllAction());
      mixers.current = [];
    };
  }, [clones, model, reduceMotion]);

  /* eslint-disable react-hooks/immutability -- three.js scene graph is mutated each frame */
  useFrame((_, delta) => {
    const travel = travelRef?.current ?? 0;
    if (appliedTravel.current !== travel) {
      appliedTravel.current = travel;
      for (let index = 0; index < clones.length; index += 1) {
        const placement = model?.placements[index];
        const clone = clones[index];
        if (!placement || !clone) {
          continue;
        }
        if (!(placement.repeatSpan > 0) || !Number.isFinite(placement.repeatMinX)) {
          continue;
        }
        clone.position.x = wrapRange(
          placement.position[0] + travel,
          placement.repeatMinX,
          placement.repeatSpan,
        );
      }
    }
    if (reduceMotion) {
      return;
    }
    for (const mixer of mixers.current) {
      mixer.update(delta);
    }
  });
  /* eslint-enable react-hooks/immutability */

  return (
    <group name="showroom-road-trees">
      {clones.map((clone, index) => (
        <primitive key={model?.placements[index].position.join(":")} object={clone} />
      ))}
    </group>
  );
}


const MEADOW = new THREE.Color("#2f5a28");
const FOREST = new THREE.Color("#1a2e16");
const ROCK = new THREE.Color("#3c3832");
const SCREE = new THREE.Color("#6a6258");
const SNOW = new THREE.Color("#f7f8f6");

export function createMountainGeometry(direction: 1 | -1) {
  const segmentsAcross = MOUNTAIN_SEGMENTS.across;
  const segmentsDepth = MOUNTAIN_SEGMENTS.depth;
  const across = 240;
  const depth = 70;
  const near = 38;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const color = new THREE.Color();
  const columns = segmentsAcross + 1;

  for (let iz = 0; iz <= segmentsDepth; iz += 1) {
    const v = iz / segmentsDepth;
    for (let ix = 0; ix <= segmentsAcross; ix += 1) {
      const u = ix / segmentsAcross;
      const acrossN = u * 2 - 1;
      const acrossFade = Math.pow(Math.cos(acrossN * Math.PI * 0.5), 1.15);
      const depthFade = Math.sin(Math.PI * v);
      const ridge = ridgedFbm(u * 8.5 + direction * 2, v * 3.1, MOUNTAIN_NOISE_OCTAVES);
      const broad = ridgedFbm(u * 2.4 + 4.0, v * 1.1 + direction, MOUNTAIN_NOISE_OCTAVES);
      const detail = fbm2(u * 14, v * 8, MOUNTAIN_NOISE_OCTAVES);
      const height =
        acrossFade * Math.pow(depthFade, 0.55) * (ridge * 30 + broad * 10) + detail * depthFade;
      const worldX = direction * (near + v * depth);
      const worldZ = (u - 0.5) * across;
      positions.push(worldX, SHOWROOM_GROUND_Y + height, worldZ);

      const snowLine = 22 + fbm2(u * 9, v * 5, MOUNTAIN_NOISE_OCTAVES) * 3;
      if (height < 2.2) {
        color.copy(MEADOW).lerp(FOREST, smoothstep(0.3, 2.2, height));
      } else if (height < snowLine) {
        color.copy(ROCK).lerp(SCREE, smoothstep(8, snowLine, height));
        color.lerp(FOREST, smoothstep(7, 2.2, height) * 0.65);
      } else {
        color.copy(SCREE).lerp(SNOW, smoothstep(snowLine, snowLine + 1.4, height));
      }
      colors.push(color.r, color.g, color.b);
    }
  }

  for (let iz = 0; iz < segmentsDepth; iz += 1) {
    for (let ix = 0; ix < segmentsAcross; ix += 1) {
      const a = iz * columns + ix;
      const b = a + 1;
      const c = a + columns;
      const d = c + 1;
      indices.push(a, c, b, c, d, b);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const mountainGeometryCache = new Map<1 | -1, THREE.BufferGeometry>();

function getMountainGeometry(direction: 1 | -1) {
  const cached = mountainGeometryCache.get(direction);
  if (cached) {
    return cached;
  }
  const geometry = createMountainGeometry(direction);
  mountainGeometryCache.set(direction, geometry);
  return geometry;
}

function DistantMountains() {
  const ahead = useMemo(() => getMountainGeometry(-1), []);
  const behind = useMemo(() => getMountainGeometry(1), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.93,
        metalness: 0,
      }),
    [],
  );

  useLayoutEffect(
    () => () => {
      material.dispose();
    },
    [material],
  );

  return (
    <>
      <mesh geometry={ahead} material={material} />
      <mesh geometry={behind} material={material} />
    </>
  );
}

function prepareGrassMaterial(material: THREE.MeshStandardMaterial) {
  material.metalness = 0;
  material.roughness = 0.92;
  material.envMapIntensity = 0.35;
  material.side = THREE.DoubleSide;
  if (material.transparent) {
    material.alphaTest = 0.4;
    material.transparent = false;
    material.opacity = 1;
  }
  material.depthWrite = true;
  material.needsUpdate = true;
}

function grassAttributeKey(geometry: THREE.BufferGeometry) {
  return Object.keys(geometry.attributes).sort().join("|");
}

const grassRootVByMaterial = new WeakMap<THREE.Material, number>();

/** Lowest texture row that still draws a blade. The card bottoms are transparent. */
function grassRootTextureV(material: THREE.MeshStandardMaterial) {
  const cached = grassRootVByMaterial.get(material);
  if (cached != null) {
    return cached;
  }
  const image = material.map?.image as CanvasImageSource & { width?: number; height?: number } | undefined;
  let visibleV = 0;
  if (image && image.width && image.height && typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context) {
      try {
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, image.width, image.height).data;
        for (let y = image.height - 1; y >= 0; y -= 1) {
          const row = y * image.width * 4;
          let opaque = false;
          for (let x = 0; x < image.width; x += 1) {
            if (pixels[row + x * 4 + 3] > 127) {
              opaque = true;
              break;
            }
          }
          if (opaque) {
            visibleV = 1 - (y + 0.5) / image.height;
            break;
          }
        }
      } catch {
        visibleV = 0;
      }
    }
  }
  grassRootVByMaterial.set(material, visibleV);
  return visibleV;
}

function grassCardRootY(geometry: THREE.BufferGeometry, material: THREE.MeshStandardMaterial) {
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  const box = geometry.boundingBox;
  if (!position || !uv || !box) {
    return box?.min.y ?? 0;
  }
  let lowV = Infinity;
  let highV = -Infinity;
  let yAtLow = box.min.y;
  let yAtHigh = box.max.y;
  for (let index = 0; index < position.count; index += 1) {
    const textureV = uv.getY(index);
    const y = position.getY(index);
    if (textureV < lowV) {
      lowV = textureV;
      yAtLow = y;
    }
    if (textureV > highV) {
      highV = textureV;
      yAtHigh = y;
    }
  }
  const span = highV - lowV;
  if (span < 1e-4) {
    return box.min.y;
  }
  const t = Math.min(1, Math.max(0, (grassRootTextureV(material) - lowV) / span));
  return yAtLow + (yAtHigh - yAtLow) * t;
}

const scratchBox = new THREE.Box3();

function meshWorldHeight(mesh: THREE.Mesh) {
  const geometry = mesh.geometry;
  if (!geometry.boundingBox) {
    geometry.computeBoundingBox();
  }
  const box = geometry.boundingBox;
  if (!box) {
    return 0;
  }
  scratchBox.copy(box).applyMatrix4(mesh.matrixWorld);
  return scratchBox.max.y - scratchBox.min.y;
}

function nextFrame() {
  return new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

type GrassAssets = {
  patches: THREE.InstancedMesh[];
  groundMap: THREE.Texture | null;
  repeatMinX: number;
  repeatSpan: number;
};

async function buildRoadsideGrass(root: THREE.Object3D): Promise<GrassAssets> {
  root.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh) {
      meshes.push(mesh);
    }
  });

  const grouped = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[] }>();
  let cardIndex = 0;
  let groundSource: THREE.Texture | null = null;
  for (let index = 0; index < meshes.length; index += 1) {
    if (index > 0 && index % 350 === 0) {
      await nextFrame();
    }
    const mesh = meshes[index];
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
    if (!material.isMeshStandardMaterial) {
      continue;
    }
    const height = meshWorldHeight(mesh);
    if (height >= GRASS_UPRIGHT_HEIGHT || height <= 0.02) {
      if (height <= 0.02 && material.map && !groundSource) {
        groundSource = material.map;
      }
      continue;
    }
    const keep = cardIndex % GRASS_BLADE_STRIDE === 0;
    cardIndex += 1;
    if (!keep) {
      continue;
    }
    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
    geometry.computeBoundingBox();
    geometry.translate(0, -grassCardRootY(geometry, material), 0);
    geometry.computeBoundingBox();
    const key = `${material.uuid}:${grassAttributeKey(geometry)}`;
    const group = grouped.get(key) ?? { material, geometries: [] };
    group.geometries.push(geometry);
    grouped.set(key, group);
  }

  const clones = [...grouped.values()].flatMap((group) => group.geometries);
  const bounds = new THREE.Box3();
  for (const geometry of clones) {
    if (geometry.boundingBox) {
      bounds.union(geometry.boundingBox);
    }
  }
  if (bounds.isEmpty()) {
    clones.forEach((geometry) => geometry.dispose());
    return {
      patches: [],
      groundMap: groundSource ? createGrassDecal(groundSource) : null,
      repeatMinX: 0,
      repeatSpan: 1,
    };
  }
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = GRASS_BLADE_HEIGHT / Math.max(bounds.max.y, 1e-3);
  for (const geometry of clones) {
    geometry.translate(-center.x, 0, -center.z);
    geometry.scale(scale, scale, scale);
  }
  const width = size.x * scale;
  const depth = size.z * scale;
  const { matrices, repeatMinX, repeatSpan } = grassInstanceMatrices(width, depth);
  const patches: THREE.InstancedMesh[] = [];
  for (const group of grouped.values()) {
    const geometry = mergeGeometries(group.geometries, false);
    group.geometries.forEach((item) => item.dispose());
    if (!geometry || matrices.length === 0) {
      geometry?.dispose();
      continue;
    }
    const material = group.material as THREE.MeshStandardMaterial;
    prepareGrassMaterial(material);
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.name = "showroom-road-grass";
    patches.push(mesh);
  }
  return {
    patches,
    groundMap: groundSource ? createGrassDecal(groundSource) : null,
    repeatMinX,
    repeatSpan,
  };
}

function grassInstanceMatrices(width: number, depth: number) {
  const matrices: THREE.Matrix4[] = [];
  const stepX = Math.max(width * 0.92, 0.4);
  const xStart = -ROAD_LENGTH / 2 + width * 0.2;
  const xEnd = ROAD_LENGTH / 2 - width * 0.2;
  const dummy = new THREE.Object3D();
  const xs: number[] = [];
  let index = 0;
  for (let x = xStart; x <= xEnd + 0.01; x += stepX) {
    for (const side of [-1, 1]) {
      const placedX = x + (hash(index * 1.7) - 0.5) * stepX * 0.08;
      const z = side * (ROAD_WIDTH / 2 + 0.25 + depth / 2);
      dummy.position.set(placedX, SHOWROOM_GROUND_Y - GRASS_GROUND_SINK, z);
      dummy.rotation.set(0, (hash(index + 3) - 0.5) * 0.12, 0);
      dummy.scale.setScalar(0.96 + hash(index * 5.1) * 0.04);
      dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());
      xs.push(placedX);
      index += 1;
    }
  }
  const repeat =
    xs.length > 0 ? repeatWindow(Math.min(...xs), Math.max(...xs), stepX) : { min: 0, span: 1 };
  return { matrices, repeatMinX: repeat.min, repeatSpan: repeat.span };
}

function createGrassDecal(source: THREE.Texture) {
  const texture = source.clone();
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(GRASS_TEXTURE_REPEAT, GRASS_TEXTURE_REPEAT);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

let roadTextureCache: THREE.CanvasTexture | null = null;

function getRoadTexture() {
  if (!roadTextureCache) {
    roadTextureCache = createRoadTexture();
  }
  return roadTextureCache;
}

let grassAssetsCache: GrassAssets | null = null;
let grassAssetsPromise: Promise<GrassAssets | null> | null = null;

function loadGrassAssets() {
  if (grassAssetsCache) {
    return Promise.resolve(grassAssetsCache);
  }
  if (!grassAssetsPromise) {
    grassAssetsPromise = new Promise((resolve) => {
      const loader = new GLTFLoader();
      loader.load(
        GRASS_MODEL_URL,
        (gltf) => {
          gltf.scene.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh) {
              return;
            }
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const material of materials) {
              const standard = material as THREE.MeshStandardMaterial;
              if (standard.isMeshStandardMaterial) {
                prepareGrassMaterial(standard);
              }
            }
          });
          void buildRoadsideGrass(gltf.scene)
            .then((built) => {
              gltf.scene.traverse((child) => {
                const mesh = child as THREE.Mesh;
                if (mesh.isMesh) {
                  mesh.geometry.dispose();
                }
              });
              grassAssetsCache = built;
              resolve(built);
            })
            .catch((error: unknown) => {
              console.error("Roadside grass failed to build", error);
              grassAssetsPromise = null;
              resolve(null);
            });
        },
        undefined,
        (error) => {
          console.error("Roadside grass model failed to load", error);
          grassAssetsPromise = null;
          resolve(null);
        },
      );
    });
  }
  return grassAssetsPromise;
}

let geometryPromise: Promise<void> | null = null;
let warmPromise: Promise<void> | null = null;

/** Asphalt and ridges only. No network, so it can run while the car GLB is still loading. */
export function warmupShowroomRoadGeometry() {
  if (!geometryPromise) {
    geometryPromise = (async () => {
      await nextFrame();
      getRoadTexture();
      await nextFrame();
      getMountainGeometry(-1);
      getMountainGeometry(1);
    })();
  }
  return geometryPromise;
}

/** Build the highway while the studio is on screen, so the venue click does not parse it. */
export function preloadShowroomRoadScene() {
  if (!warmPromise) {
    warmPromise = (async () => {
      await warmupShowroomRoadGeometry();
      await nextFrame();
      await loadGrassAssets();
      await nextFrame();
      await loadTreeModel();
    })();
  }
  return warmPromise;
}

function RoadsideGrassBlades({
  patches,
  repeatMinX,
  repeatSpan,
  travelRef,
}: {
  patches: THREE.InstancedMesh[];
  repeatMinX: number;
  repeatSpan: number;
  travelRef: RefObject<number>;
}) {
  const basesRef = useRef<THREE.Matrix4[][] | null>(null);
  const appliedTravel = useRef<number | null>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const scale = useMemo(() => new THREE.Vector3(), []);

  useLayoutEffect(() => {
    const snapshots = patches.map((patch) => {
      const list: THREE.Matrix4[] = [];
      const matrix = new THREE.Matrix4();
      for (let index = 0; index < patch.count; index += 1) {
        patch.getMatrixAt(index, matrix);
        list.push(matrix.clone());
      }
      return list;
    });
    basesRef.current = snapshots;
    appliedTravel.current = null;
    return () => {
      patches.forEach((patch, patchIndex) => {
        const list = snapshots[patchIndex];
        if (!list) {
          return;
        }
        list.forEach((matrix, index) => patch.setMatrixAt(index, matrix));
        patch.instanceMatrix.needsUpdate = true;
      });
      basesRef.current = null;
    };
  }, [patches]);

  /* eslint-disable react-hooks/immutability -- three.js scene graph is mutated each frame */
  useFrame(() => {
    const bases = basesRef.current;
    const travel = travelRef?.current ?? 0;
    if (!bases || appliedTravel.current === travel) {
      return;
    }
    appliedTravel.current = travel;
    for (let patchIndex = 0; patchIndex < patches.length; patchIndex += 1) {
      const patch = patches[patchIndex];
      const list = bases[patchIndex];
      if (!patch || !list) {
        continue;
      }
      for (let index = 0; index < list.length; index += 1) {
        list[index].decompose(position, quaternion, scale);
        position.x = wrapRange(position.x + travel, repeatMinX, repeatSpan);
        dummy.position.copy(position);
        dummy.quaternion.copy(quaternion);
        dummy.scale.copy(scale);
        dummy.updateMatrix();
        patch.setMatrixAt(index, dummy.matrix);
      }
      patch.instanceMatrix.needsUpdate = true;
    }
  });
  /* eslint-enable react-hooks/immutability */

  return (
    <group name="showroom-road-grass-blades">
      {patches.map((patch) => (
        <primitive key={patch.uuid} object={patch} />
      ))}
    </group>
  );
}

/**
 * drei resets its frame counter on every React render, so this stays memoized.
 * One bake under the car; grass and ridges stay out of that pass.
 */
const RoadContactShadow = memo(function RoadContactShadow({
  lighting,
}: {
  lighting: ShowroomLightingMode;
}) {
  return (
    <ContactShadows
      position={[0, SHOWROOM_GROUND_Y + 0.03, 0]}
      opacity={lighting === "night" ? 0.22 : 0.38}
      blur={2.2}
      scale={12}
      far={4}
      frames={1}
    />
  );
});

/** Outdoor highway: asphalt under the car, grass shoulders, and a day or night sky. */
export function ShowroomRoadScene({
  lighting = "day",
  reduceMotion = false,
  driveSpeedRef,
}: {
  lighting?: ShowroomLightingMode;
  reduceMotion?: boolean;
  /** Signed m/s along showroom forward (−X). The road reads this; the car writes it. */
  driveSpeedRef?: RefObject<number>;
}) {
  const roadMap = useMemo(() => getRoadTexture(), []);
  const travelRef = useRef(0);
  const idleDriveSpeedRef = useRef(0);
  const speedRef = driveSpeedRef ?? idleDriveSpeedRef;
  const [grassAssets, setGrassAssets] = useState<GrassAssets | null>(() => grassAssetsCache);
  const [showScenery, setShowScenery] = useState(false);
  const groundMap = grassAssets?.groundMap ?? null;
  const groundMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: groundMap ? "#d7e2c2" : "#4c7a32",
        map: groundMap ?? undefined,
        roughness: 0.96,
        metalness: 0,
      }),
    [groundMap],
  );

  useEffect(() => {
    let cancelled = false;
    void loadGrassAssets().then((assets) => {
      if (!cancelled && assets) {
        setGrassAssets(assets);
      }
    });
    void loadTreeModel();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      getMountainGeometry(-1);
      getMountainGeometry(1);
      setShowScenery(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useLayoutEffect(
    () => () => {
      groundMaterial.dispose();
    },
    [groundMaterial],
  );

  useLayoutEffect(
    () => () => {
      roadMap.offset.x = 0;
    },
    [roadMap],
  );

  useLayoutEffect(() => {
    if (!groundMap) {
      return;
    }
    return () => {
      groundMap.offset.x = 0;
    };
  }, [groundMap]);

  /* eslint-disable react-hooks/immutability -- three.js scene graph is mutated each frame */
  useFrame((_, delta) => {
    travelRef.current += sceneryShiftX(speedRef.current, delta);
    const travel = travelRef.current;
    roadMap.offset.x = wrappedTextureOffset(travel, ROAD_LENGTH, ROAD_TEXTURE_REPEAT_X);
    if (groundMap) {
      groundMap.offset.x = wrappedTextureOffset(travel, GRASS_SIZE, GRASS_TEXTURE_REPEAT);
    }
  });
  /* eslint-enable react-hooks/immutability */

  return (
    <group name="showroom-road-scene">
      <RoadSky lighting={lighting} />
      <group name="showroom-road-lanes" position={[0, 0, ROAD_RIGHT_LANE_OFFSET_Z]}>
        <mesh
          receiveShadow
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, SHOWROOM_GROUND_Y - 0.04, 0]}
          material={groundMaterial}
        >
          <planeGeometry args={[GRASS_SIZE, GRASS_SIZE]} />
        </mesh>
        {showScenery && grassAssets && grassAssets.patches.length > 0 ? (
          <RoadsideGrassBlades
            patches={grassAssets.patches}
            repeatMinX={grassAssets.repeatMinX}
            repeatSpan={grassAssets.repeatSpan}
            travelRef={travelRef}
          />
        ) : null}
        <mesh
          name="showroom-road"
          receiveShadow
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, SHOWROOM_GROUND_Y, 0]}
        >
          <planeGeometry args={[ROAD_LENGTH, ROAD_WIDTH]} />
          <meshStandardMaterial
            map={roadMap}
            roughness={0.92}
            metalness={0.03}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
        {showScenery ? <RoadsideTrees reduceMotion={reduceMotion} travelRef={travelRef} /> : null}
        {showScenery ? <DistantMountains /> : null}
      </group>
      <RoadSunShadows />
      <RoadContactShadow lighting={lighting} />
    </group>
  );
}
