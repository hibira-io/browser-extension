// Signing in with a Hibira account. The portal's connect page asks the
// person to sign in (Hibi never touches sign-in pages: the person does it
// in a Chrome-owned window) and hands back a token scoped to the extension.

import { BASE } from './config';

const KEY = 'hibiToken';

export interface Session {
  token: string;
  email: string;
  expiresAt: number;
}

export async function currentSession(): Promise<Session | null> {
  const got = await chrome.storage.local.get(KEY);
  const s = got[KEY] as Session | undefined;
  if (!s || s.expiresAt <= Date.now()) return null;
  return s;
}

export async function signIn(): Promise<Session> {
  const state = crypto.randomUUID();
  const redirect = chrome.identity.getRedirectURL('connected');
  const url = new URL('/secretary/extension/connect', BASE);
  url.searchParams.set('redirect_uri', redirect);
  url.searchParams.set('state', state);
  const back = await chrome.identity.launchWebAuthFlow({ url: url.toString(), interactive: true });
  if (!back) throw new Error('Sign-in was cancelled.');
  const params = new URLSearchParams(new URL(back).hash.slice(1));
  if (params.get('state') !== state) throw new Error('Sign-in failed. Please try again.');
  const token = params.get('token');
  if (!token) throw new Error(params.get('error') ?? 'Sign-in failed. Please try again.');
  const session: Session = {
    token,
    email: params.get('email') ?? '',
    expiresAt: Date.now() + Number(params.get('expires_in') ?? 3600) * 1000,
  };
  await chrome.storage.local.set({ [KEY]: session });
  return session;
}

export async function signOut(): Promise<void> {
  const s = await currentSession();
  await chrome.storage.local.remove(KEY);
  if (s) {
    await fetch(new URL('/secretary/v1/extension/session', BASE), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${s.token}` },
    }).catch(() => undefined);
  }
}
