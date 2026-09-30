import { describe, expect, it, vi } from "vitest";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { registerSpecularGlossiness } from "@/lib/gltf-specular-glossiness";

function pad4(buffer: Buffer, fill: number) {
  const padding = (4 - (buffer.length % 4)) % 4;
  if (padding === 0) {
    return buffer;
  }
  return Buffer.concat([buffer, Buffer.alloc(padding, fill)]);
}

/** Minimal GLB whose material requires the deprecated specular-glossiness extension. */
function buildSpecularGlossinessGlb() {
  const positions = Buffer.from(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer);
  const json = {
    asset: { version: "2.0" },
    extensionsUsed: ["KHR_materials_pbrSpecularGlossiness"],
    extensionsRequired: ["KHR_materials_pbrSpecularGlossiness"],
    buffers: [{ byteLength: positions.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.length }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        max: [1, 1, 0],
        min: [0, 0, 0],
      },
    ],
    materials: [
      {
        name: "leaf",
        extensions: {
          KHR_materials_pbrSpecularGlossiness: {
            diffuseFactor: [0.2, 0.6, 0.1, 1],
            glossinessFactor: 0.4,
          },
        },
      },
    ],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
  };
  const jsonChunk = pad4(Buffer.from(JSON.stringify(json)), 0x20);
  const binChunk = pad4(positions, 0);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binChunk.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  const body = Buffer.concat([jsonHeader, jsonChunk, binHeader, binChunk]);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + body.length, 8);
  return Buffer.concat([header, body]);
}

function toArrayBuffer(buffer: Buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

describe("registerSpecularGlossiness", () => {
  it("loads a required specular-glossiness material without the unknown-extension warning", async () => {
    const glb = toArrayBuffer(buildSpecularGlossinessGlb());
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const unpatched = new GLTFLoader();
    await unpatched.parseAsync(glb, "");
    expect(warn.mock.calls.some((args) => String(args[0]).includes("KHR_materials_pbrSpecularGlossiness"))).toBe(
      true,
    );

    warn.mockClear();
    const loader = new GLTFLoader();
    registerSpecularGlossiness(loader);
    const gltf = await loader.parseAsync(glb.slice(0), "");
    expect(warn.mock.calls.some((args) => String(args[0]).includes("KHR_materials_pbrSpecularGlossiness"))).toBe(
      false,
    );
    expect(gltf.scene.children.length).toBeGreaterThan(0);
    warn.mockRestore();
  });
});
