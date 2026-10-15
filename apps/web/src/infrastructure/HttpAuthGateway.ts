import type { AccountsGateway, AuthGateway } from '../application/ports/AuthGateway.ts';
import type { Account, PasswordLink, Role } from '../domain/Account.ts';
import { ApiError, apiRequest } from './apiFetch.ts';

/**
 * Adaptateur : connexion par l'API ; la session est un cookie HttpOnly, invisible du code du front.
 */
export class HttpAuthGateway implements AuthGateway {
  private readonly baseUrl: string;

  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
  }

  async me(): Promise<Account | null> {
    try {
      return await apiRequest<Account>('GET', `${this.baseUrl}/auth/me`, undefined, { signalSessionLoss: false });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        return null;
      }
      throw error;
    }
  }

  login(username: string, password: string): Promise<Account> {
    return apiRequest('POST', `${this.baseUrl}/auth/login`, { username, password }, { signalSessionLoss: false });
  }

  logout(): Promise<void> {
    return apiRequest('POST', `${this.baseUrl}/auth/logout`, undefined, { signalSessionLoss: false });
  }

  inspectPasswordLink(token: string): Promise<{ readonly username: string }> {
    return apiRequest('POST', `${this.baseUrl}/auth/password-link/inspect`, { token }, { signalSessionLoss: false });
  }

  redeemPasswordLink(token: string, password: string): Promise<Account> {
    return apiRequest('POST', `${this.baseUrl}/auth/password-link`, { token, password }, { signalSessionLoss: false });
  }

  changePassword(currentPassword: string, newPassword: string): Promise<void> {
    return apiRequest('POST', `${this.baseUrl}/account/password`, { currentPassword, newPassword });
  }

  logoutEverywhere(): Promise<void> {
    return apiRequest('POST', `${this.baseUrl}/account/logout-everywhere`, undefined, { signalSessionLoss: false });
  }
}

export class HttpAccountsGateway implements AccountsGateway {
  private readonly baseUrl: string;

  constructor(baseUrl = '/api/admin/accounts') {
    this.baseUrl = baseUrl;
  }

  list(): Promise<readonly Account[]> {
    return apiRequest('GET', this.baseUrl);
  }

  create(username: string, role: Role): Promise<PasswordLink> {
    return apiRequest('POST', this.baseUrl, { username, role });
  }

  update(id: string, changes: { readonly role?: Role; readonly disabled?: boolean }): Promise<Account> {
    return apiRequest('PATCH', `${this.baseUrl}/${encodeURIComponent(id)}`, changes);
  }

  issuePasswordLink(id: string): Promise<PasswordLink> {
    return apiRequest('POST', `${this.baseUrl}/${encodeURIComponent(id)}/password-link`);
  }

  delete(id: string): Promise<void> {
    return apiRequest('DELETE', `${this.baseUrl}/${encodeURIComponent(id)}`);
  }
}
