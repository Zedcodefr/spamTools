import type { ImportReport } from '../../domain/ImportReport.ts';

/**
 * Port : ce dont l'UI a besoin pour lancer un import,
 * sans savoir comment c'est fait (HTTP, mock, ...).
 */
export interface ImportGateway {
  importFile(file: File): Promise<ImportReport>;
}
