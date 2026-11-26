// The HTTP transport to Hibira (/secretary/v1): a session token from the
// site's server, or the public key with a visitor ID for sites without one.

import type { Transport, TurnRequest } from './runner';
import type { PanelInfo, TurnResult } from './types';

export interface Auth {
  /** The workspace's public key (pk_...), from the script tag. */
  key?: string;
  /** Returns a session token (sst_...) the site's server got for the signed-in user. */
  session?: () => Promise<string>;
}

export class SecretaryError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
  }
}

const VISITOR = 'hibira-secretary-visitor';

function visitorID(): string {
  try {
    let v = localStorage.getItem(VISITOR);
    if (!v) {
      v = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(VISITOR, v);
    }
    return v;
  } catch {
    return 'session-' + Math.random().toString(16).slice(2, 14);
  }
}

export class HttpTransport implements Transport {
  private token = '';
  private tokenAt = 0;

  constructor(private endpoint: string, private auth: Auth) {}

  private async headers(fresh = false): Promise<Record<string, string>> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.auth.session) {
      if (fresh || !this.token || Date.now() - this.tokenAt > 30 * 60_000) {
        this.token = await this.auth.session();
        this.tokenAt = Date.now();
      }
      h.Authorization = 'Bearer ' + this.token;
    } else if (this.auth.key) {
      h['X-Secretary-Key'] = this.auth.key;
      h['X-Secretary-Visitor'] = visitorID();
    } else {
      throw new SecretaryError('Secretary needs a public key (data-key) or a session.', 401, 'secretary_key');
    }
    return h;
  }

  private async call<T>(method: string, path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(this.endpoint + path, { method, headers: await this.headers(attempt > 0), body: body === undefined ? undefined : JSON.stringify(body), signal, credentials: 'omit' });
      if (res.status === 401 && this.auth.session && attempt === 0) continue;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new SecretaryError(data.error || `Secretary error ${res.status}`, res.status, data.code || '');
      return data as T;
    }
  }

  me(): Promise<PanelInfo> {
    return this.call('GET', '/me', undefined);
  }

  turn(req: TurnRequest, signal: AbortSignal): Promise<TurnResult> {
    return this.call('POST', '/turn', req, signal);
  }
}
