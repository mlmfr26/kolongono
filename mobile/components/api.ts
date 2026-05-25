/**
 * Client HTTP — SantéDirect Kolongono
 * Pointe vers l'API FastAPI (port 8002) et le bridge Longonia.
 */

export const API_URL    = 'http://localhost:8002';
export const SANTE_URL  = API_URL;

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(method: string, path: string, token?: string | null, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `Erreur ${res.status}` }));
      throw new Error(err.detail ?? `Erreur HTTP ${res.status}`);
    }
    return res.json();
  }

  get<T>(path: string, token?: string | null): Promise<T> {
    return this.request<T>('GET', path, token);
  }

  post<T>(path: string, body: unknown, token?: string | null): Promise<T> {
    return this.request<T>('POST', path, token, body);
  }

  put<T>(path: string, body: unknown, token?: string | null): Promise<T> {
    return this.request<T>('PUT', path, token, body);
  }

  delete<T>(path: string, token?: string | null): Promise<T> {
    return this.request<T>('DELETE', path, token);
  }
}

export const api = new ApiClient(API_URL);

// ─── Client axios-compatible — utilisé par les screens scanner ───────────────
// Retourne { data: T } et throw des erreurs avec error.response.status

class AxiosLikeClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<{ data: T }> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ detail: `Erreur ${res.status}` }));
      const err: any = new Error(errBody.detail ?? `Erreur HTTP ${res.status}`);
      err.response = { status: res.status, data: errBody };
      throw err;
    }

    const data = (await res.json()) as T;
    return { data };
  }

  get<T = any>(path: string): Promise<{ data: T }> {
    return this.request<T>('GET', path);
  }

  post<T = any>(path: string, body: unknown): Promise<{ data: T }> {
    return this.request<T>('POST', path, body);
  }
}

export const apiClient = new AxiosLikeClient(API_URL);
