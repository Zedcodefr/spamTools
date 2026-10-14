import type { ImportGateway } from '../application/ports/ImportGateway.ts';
import type { ImportReport } from '../domain/ImportReport.ts';

/**
 * Adaptateur : implémente le port en appelant l'API (apps/api).
 */
export class HttpImportGateway implements ImportGateway {
  constructor(private readonly baseUrl = '/api') {}

  async importFile(file: File): Promise<ImportReport> {
    const response = await fetch(`${this.baseUrl}/imports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: file,
    });

    // 422 = import traité mais en échec : le rapport décrit l'erreur.
    if (!response.ok && response.status !== 422) {
      throw new Error(`Erreur serveur (${response.status})`);
    }
    return (await response.json()) as ImportReport;
  }
}
