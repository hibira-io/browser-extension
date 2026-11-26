// Per-site opt-in. The extension asks for no site at install; the person
// turns Hibi on for one site at a time, which grants that origin only.

export function originPattern(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return `${u.protocol}//${u.host}/*`;
  } catch {
    return null;
  }
}

export async function isOn(url: string): Promise<boolean> {
  const p = originPattern(url);
  return p ? chrome.permissions.contains({ origins: [p] }) : false;
}

/** turnOn must run inside the click that asked for it (a user gesture). */
export async function turnOn(url: string): Promise<boolean> {
  const p = originPattern(url);
  return p ? chrome.permissions.request({ origins: [p] }) : false;
}

export async function turnOff(url: string): Promise<boolean> {
  const p = originPattern(url);
  return p ? chrome.permissions.remove({ origins: [p] }) : false;
}
