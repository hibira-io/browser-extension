// The model side over HTTPS: one metered turn per call.

import type { Transport, TurnRequest, TurnResponse } from '../core/types';
import { BASE } from './config';

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export class HibiraTransport implements Transport {
  constructor(private token: () => Promise<string | null>) {}

  async turn(req: TurnRequest, signal?: AbortSignal): Promise<TurnResponse> {
    const token = await this.token();
    if (!token) throw new HttpError(401, 'signed_out', 'Please sign in again.');
    const res = await fetch(new URL('/api/secretary/v1/extension/turn', BASE), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(req),
      signal,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string };
      throw new HttpError(res.status, body.code ?? 'error', body.message ?? `Request failed (${res.status}).`);
    }
    return (await res.json()) as TurnResponse;
  }
}
