import { SRGBColorSpace } from "three";
import type { GLTFLoader, GLTFParser } from "three/examples/jsm/loaders/GLTFLoader.js";

const EXTENSION_NAME = "KHR_materials_pbrSpecularGlossiness";

type SpecularGlossinessDef = {
  diffuseTexture?: { index: number; texCoord?: number };
};

/**
 * Three's GLTFLoader no longer implements this deprecated glTF extension.
 * Roadside trees still require it, so register a plugin that copies the
 * diffuse texture onto the standard material and stops the unknown-extension warning.
 */
export function registerSpecularGlossiness(loader: GLTFLoader) {
  loader.register((parser: GLTFParser) => ({
    name: EXTENSION_NAME,
    extendMaterialParams(materialIndex, materialParams) {
      const spec = parser.json.materials?.[materialIndex]?.extensions?.[EXTENSION_NAME] as
        | SpecularGlossinessDef
        | undefined;
      if (!spec?.diffuseTexture) {
        return null;
      }
      return parser.assignTexture(materialParams, "map", spec.diffuseTexture, SRGBColorSpace);
    },
  }));
}
