// Signing in with a Hibira account ("Sign in with Hibira", OAuth 2.0 with
// PKCE). Chrome opens hibira.io in its own sign-in window, where the person
// signs in themselves; Hibi never sees the password. The code comes back to
// this extension's chromiumapp.org callback, is traded for a single-use
// sign-in token, and that for a session on the person's own Hibi workspace.
//
// hibira.io treats this client as its own (billing.ExtensionClient in
// pusher-server): the client ID below must stay byte-for-byte the same.

import { BASE } from './config';

const KEY = 'hibiSession';
const CLIENT_NAME = 'Hibi for Chrome';
const CALLBACK = 'auth/hibira/callback';

export interface Session {
  token: string;
  email: string;
  expiresAt: number;
}

export async function currentSession(): Promise<Session | null> {
  const got = await chrome.storage.local.get(KEY);
  const s = got[KEY] as Session | undefined;
  if (s && s.expiresAt > Date.now() + 60_000) return s;
  if (s) {
    // Expired: try again without a window, which works while the person is
    // still signed in to hibira.io.
    try {
      return await signIn(false);
    } catch {
      await chrome.storage.local.remove(KEY);
    }
  }
  return null;
}

export function clientID(redirect: string): string {
  return 'hkc_' + base64url(new TextEncoder().encode(JSON.stringify({ n: CLIENT_NAME, r: [redirect] })));
}

export async function signIn(interactive = true): Promise<Session> {
  const redirect = chrome.identity.getRedirectURL(CALLBACK);
  const client = clientID(redirect);
  const state = base64url(crypto.getRandomValues(new Uint8Array(16)));
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const url = new URL('/oauth/authorize', BASE);
  url.search = new URLSearchParams({
    response_type: 'code', client_id: client, redirect_uri: redirect, scope: 'email',
    state, code_challenge: challenge, code_challenge_method: 'S256',
  }).toString();
  const back = await chrome.identity.launchWebAuthFlow({ url: url.toString(), interactive });
  if (!back) throw new Error(chrome.i18n.getMessage('signInFailed'));
  const q = new URL(back).searchParams;
  if (q.get('state') !== state) throw new Error(chrome.i18n.getMessage('signInFailed'));
  const code = q.get('code');
  if (!code) throw new Error(q.get('error_description') || chrome.i18n.getMessage('signInFailed'));

  const tok = await fetch(new URL('/oauth/token', BASE), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirect, client_id: client, code_verifier: verifier }),
  });
  const grant = (await tok.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
  if (!tok.ok || !grant.access_token) throw new Error(grant.error_description || chrome.i18n.getMessage('signInFailed'));

  const res = await fetch(new URL('/secretary/v1/extension/session', BASE), {
    method: 'POST',
    headers: { Authorization: `Bearer ${grant.access_token}` },
  });
  const body = (await res.json().catch(() => ({}))) as { token?: string; email?: string; expires_at?: string; error?: string };
  if (!res.ok || !body.token) throw new Error(body.error || chrome.i18n.getMessage('signInFailed'));
  const session: Session = { token: body.token, email: body.email ?? '', expiresAt: Date.parse(body.expires_at ?? '') || Date.now() + 3600_000 };
  await chrome.storage.local.set({ [KEY]: session });
  return session;
}

export async function signOut(): Promise<void> {
  await chrome.storage.local.remove(KEY);
}

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
