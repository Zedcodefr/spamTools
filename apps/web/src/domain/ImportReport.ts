// Domaine côté front : du TypeScript pur, aucune dépendance à React ni à fetch.

export type ImportStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ImportReport {
  readonly jobId: string;
  readonly status: ImportStatus;
  readonly importedCount: number;
  readonly rejectedCount: number;
  readonly failureReason?: string;
}

export function summarize(report: ImportReport): string {
  if (report.status === 'failed') {
    return `Échec de l'import : ${report.failureReason ?? 'raison inconnue'}`;
  }
  return `${report.importedCount} donnée(s) importée(s), ${report.rejectedCount} rejetée(s)`;
}
