import * as THREE from "three";
import type { ShowroomSpinAxis } from "@/lib/asset-car-rig";

export type SyntheticWheelRig = {
  frontWheels: THREE.Object3D[];
  rearWheels: THREE.Object3D[];
  frontSteerPivots: THREE.Object3D[];
  synthetic: boolean;
};

/**
 * Sketchfab exports often place tyre template meshes at the body origin while the
 * visible tread is baked into the shell. Hide those templates to avoid duplicates.
 */
export function hideMisplacedTemplateWheels(root: THREE.Object3D, bounds: THREE.Box3) {
  const carSize = new THREE.Vector3();
  const carCenter = new THREE.Vector3();
  bounds.getSize(carSize);
  bounds.getCenter(carCenter);

  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) {
      return;
    }
    const name = `${child.name}/${child.parent?.name ?? ""}`.toLowerCase();
    if (!/(q3_tyre|tyre_nor|tyre5|tyre6|tyre7|tyre8|tyre10)/i.test(name)) {
      return;
    }
    const box = new THREE.Box3().setFromObject(mesh);
    const meshSize = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(meshSize);
    box.getCenter(center);
    const atBodyCenter =
      Math.abs(center.x - carCenter.x) < carSize.x * 0.16 &&
      Math.abs(center.z - carCenter.z) < carSize.z * 0.16;
    // Tyre meshes rigged at the origin often span the full car in bind pose — never hide those.
    const spansVehicle =
      meshSize.x > carSize.x * 0.45 || meshSize.z > carSize.z * 0.45 || meshSize.y > carSize.y * 0.55;
    const isTinyTemplate =
      meshSize.x < carSize.x * 0.12 && meshSize.z < carSize.z * 0.12 && meshSize.y < carSize.y * 0.2;
    if (atBodyCenter && isTinyTemplate && !spansVehicle) {
      mesh.visible = false;
    }
  });
}

/**
 * Place four axle-aligned cylinders at the wheel arches when the GLB has no
 * separable ground wheels (sedan / offroad body, SUV template tyres).
 */
export function createSyntheticGroundWheels(
  root: THREE.Object3D,
  bounds: THREE.Box3,
): SyntheticWheelRig {
  const size = new THREE.Vector3();
  bounds.getSize(size);
  const radius = Math.min(size.y * 0.11, size.x * 0.09);
  const width = size.z * 0.075;
  const groundY = bounds.min.y + radius * 0.92;

  const mounts = [
    { x: bounds.min.x + size.x * 0.17, z: bounds.max.z - size.z * 0.14, front: true },
    { x: bounds.min.x + size.x * 0.17, z: bounds.min.z + size.z * 0.14, front: true },
    { x: bounds.max.x - size.x * 0.17, z: bounds.max.z - size.z * 0.14, front: false },
    { x: bounds.max.x - size.x * 0.17, z: bounds.min.z + size.z * 0.14, front: false },
  ];

  const frontWheels: THREE.Object3D[] = [];
  const rearWheels: THREE.Object3D[] = [];
  const frontSteerPivots: THREE.Object3D[] = [];

  for (const mount of mounts) {
    const geometry = new THREE.CylinderGeometry(radius, radius, width, 24);
    geometry.rotateX(Math.PI / 2);
    const tire = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: 0x111827,
        roughness: 0.88,
        metalness: 0.12,
      }),
    );
    tire.castShadow = true;
    tire.receiveShadow = true;
    tire.userData.showroomSyntheticWheel = true;

    const spinPivot = new THREE.Group();
    spinPivot.position.set(mount.x, groundY, mount.z);
    spinPivot.userData.showroomSpinAxis = "z" satisfies ShowroomSpinAxis;
    spinPivot.userData.showroomSyntheticWheel = true;
    spinPivot.add(tire);
    root.add(spinPivot);

    if (mount.front) {
      const steerPivot = new THREE.Group();
      steerPivot.position.set(mount.x, groundY, mount.z);
      root.add(steerPivot);
      steerPivot.attach(spinPivot);
      frontSteerPivots.push(steerPivot);
      frontWheels.push(spinPivot);
    } else {
      rearWheels.push(spinPivot);
    }
  }

  return {
    frontWheels,
    rearWheels,
    frontSteerPivots,
    synthetic: true,
  };
}
