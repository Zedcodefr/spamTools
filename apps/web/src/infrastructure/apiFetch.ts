/** Événement émis quand l'API répond 401 : session expirée ou fermée, retour à la connexion. */
export const SESSION_LOST_EVENT = 'spamtools:session-lost';

/** fetch vers l'API : le cookie de session part avec la requête (même origine). */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status === 401) {
    window.dispatchEvent(new Event(SESSION_LOST_EVENT));
  }
  return response;
}

/** Requête JSON vers l'API : corps JSON, erreurs de l'API en Error (leur message), 204 sans contenu. */
export async function apiRequest<T>(method: string, url: string, body?: unknown, { signalSessionLoss = true } = {}): Promise<T> {
  const init: RequestInit = {
    method,
    ...(body !== undefined && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  };
  const response = signalSessionLoss ? await apiFetch(url, init) : await fetch(url, init);
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(response.status, error?.error ?? `Erreur serveur (${response.status})`);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
