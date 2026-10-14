import type { AssetPath } from '../../domain/index.js';

/**
 * Port : stockage local des images, rangées sous le même chemin relatif que sur la source.
 */
export interface AssetStore {
  has(path: AssetPath): Promise<boolean>;
  put(path: AssetPath, content: Uint8Array): Promise<void>;
}
