import * as THREE from "three";

/** Longest axis after normalize; slightly above geometric `BODY_LENGTH` (3.2) for presence. */
export const MARKET_MODEL_TARGET_LENGTH = 4;

/** Must match showroom floor `SHOWROOM_GROUND_Y`. */
export const MARKET_MODEL_GROUND_Y = -0.22;

const HELPER_NAME_PATTERN = /(camera|cam|target|helper|gizmo|locator|control)/i;

/** World bounds of visible meshes only (hidden helpers / rig templates excluded). */
function getVisibleMeshBounds(root: THREE.Object3D) {
  const bounds = new THREE.Box3();
  const chunk = new THREE.Box3();
  let hasMesh = false;
  root.updateWorldMatrix(true, true);
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible) {
      return;
    }
    chunk.setFromObject(mesh);
    if (!hasMesh) {
      bounds.copy(chunk);
      hasMesh = true;
    } else {
      bounds.union(chunk);
    }
  });
  return hasMesh ? bounds : new THREE.Box3().setFromObject(root);
}

function hideHelperMeshes(root: THREE.Object3D) {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) {
      return;
    }
    const ownName = mesh.name.toLowerCase();
    const parentName = mesh.parent?.name?.toLowerCase() ?? "";
    if (HELPER_NAME_PATTERN.test(ownName) || HELPER_NAME_PATTERN.test(parentName)) {
      mesh.visible = false;
    }
  });
}

/**
 * Center, scale, ground, and orient a Sketchfab / market GLB for the showroom.
 * Uses world-space bounds so FBX root scales (e.g. 0.01) are included correctly.
 */
export function normalizeMarketModel(
  root: THREE.Object3D,
  targetLength = MARKET_MODEL_TARGET_LENGTH,
  groundY = MARKET_MODEL_GROUND_Y,
): THREE.Box3 {
  hideHelperMeshes(root);
  root.updateWorldMatrix(true, true);

  const bounds = getVisibleMeshBounds(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);

  root.position.sub(center);

  const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
  const scaleFactor = targetLength / maxDim;
  root.scale.multiplyScalar(scaleFactor);

  // Market GLBs are usually Z-forward; showroom camera presets assume -X forward.
  root.rotation.y = -Math.PI / 2;
  root.updateWorldMatrix(true, true);

  // Ground after rotation so tires sit on the showroom floor, not on an AABB from pre-rotate pose.
  const groundedBounds = getVisibleMeshBounds(root);
  root.position.y += groundY - groundedBounds.min.y;
  root.updateWorldMatrix(true, true);

  return getVisibleMeshBounds(root);
}
