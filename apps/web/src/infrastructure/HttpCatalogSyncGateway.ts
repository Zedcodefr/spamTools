import type { CatalogSyncGateway, CatalogSyncState } from '../application/ports/CatalogSyncGateway.ts';
import { apiRequest } from './apiFetch.ts';

export class HttpCatalogSyncGateway implements CatalogSyncGateway {
  private readonly url: string;

  constructor(url = '/api/admin/catalog/sync') {
    this.url = url;
  }

  state(): Promise<CatalogSyncState> {
    return apiRequest('GET', this.url);
  }

  start(): Promise<CatalogSyncState> {
    return apiRequest('POST', this.url);
  }
}
