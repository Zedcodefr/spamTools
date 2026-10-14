import { access, mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AssetStore } from '../application/index.js';
import type { AssetPath } from '../domain/index.js';

/**
 * Images stockées sur disque sous `rootDirectory`, au même chemin relatif que sur la source.
 */
export class FileSystemAssetStore implements AssetStore {
  constructor(private readonly rootDirectory: string) {}

  async has(asset: AssetPath): Promise<boolean> {
    try {
      await access(this.resolve(asset));
      return true;
    } catch {
      return false;
    }
  }

  async put(asset: AssetPath, content: Uint8Array): Promise<void> {
    const target = this.resolve(asset);
    await mkdir(path.dirname(target), { recursive: true });
    // Écriture puis renommage : un fichier présent est toujours complet.
    const temporary = `${target}.${process.pid}.tmp`;
    await writeFile(temporary, content);
    await rename(temporary, target);
  }

  private resolve(asset: AssetPath): string {
    return path.join(this.rootDirectory, ...asset.value.split('/'));
  }
}
