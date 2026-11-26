// A folder on the person's computer that Hibi may use, chosen by the person
// in Chrome's own folder picker (File System Access). Hibi sees only that
// folder; Chrome asks again after a restart before it can read it.

const DB = 'hibi';
const STORE = 'folder';
const KEY = 'handle';
const MAX_LIST = 200;
const MAX_TEXT = 100_000;
export const MAX_ATTACH = 10 * 1024 * 1024;

interface PermissionHandle extends FileSystemDirectoryHandle {
  queryPermission(d: { mode: 'read' }): Promise<PermissionState>;
  requestPermission(d: { mode: 'read' }): Promise<PermissionState>;
  values(): AsyncIterable<FileSystemDirectoryHandle | FileSystemFileHandle>;
}

declare global {
  interface Window {
    showDirectoryPicker(o?: { mode?: 'read'; id?: string }): Promise<FileSystemDirectoryHandle>;
  }
}

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = fn(d.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result as T);
    r.onerror = () => reject(r.error);
  });
}

/** The folder the person chose, if any (permission not checked). */
export async function savedFolder(): Promise<PermissionHandle | null> {
  return ((await idb<PermissionHandle | undefined>('readonly', (s) => s.get(KEY)).catch(() => undefined)) ?? null);
}

/** Opens Chrome's folder picker. Must run in a click. */
export async function pickFolder(): Promise<string> {
  const h = await window.showDirectoryPicker({ mode: 'read', id: 'hibi' });
  await idb('readwrite', (s) => s.put(h, KEY));
  return h.name;
}

export async function forgetFolder(): Promise<void> {
  await idb('readwrite', (s) => s.delete(KEY));
}

/** The folder, if Hibi may read it now. With ask (only in a click), Chrome
 *  asks the person again when it needs to. */
export async function usableFolder(ask: boolean): Promise<PermissionHandle | null> {
  const h = await savedFolder();
  if (!h) return null;
  if ((await h.queryPermission({ mode: 'read' })) === 'granted') return h;
  if (ask && (await h.requestPermission({ mode: 'read' }).catch(() => 'denied')) === 'granted') return h;
  return null;
}

/** Paths in the folder and one level of subfolders, with sizes. */
export async function listFiles(root: PermissionHandle): Promise<string> {
  const out: string[] = [];
  const walk = async (dir: PermissionHandle, prefix: string, depth: number) => {
    for await (const e of dir.values()) {
      if (out.length >= MAX_LIST || e.name.startsWith('.')) continue;
      if (e.kind === 'file') {
        const f = await (e as FileSystemFileHandle).getFile();
        out.push(`${prefix}${e.name} (${size(f.size)})`);
      } else if (depth < 1) await walk(e as PermissionHandle, `${prefix}${e.name}/`, depth + 1);
    }
  };
  await walk(root, '', 0);
  if (!out.length) return `The folder "${root.name}" is empty.`;
  return `Folder "${root.name}":\n${out.sort().join('\n')}${out.length >= MAX_LIST ? '\n(more files not listed)' : ''}`;
}

/** One file by its path in the folder; no way out of it. */
export async function fileAt(root: PermissionHandle, path: string): Promise<File> {
  const parts = path.split('/').filter((p) => p && p !== '.');
  if (!parts.length || parts.includes('..')) throw new Error('give a file path from list_files');
  let dir: FileSystemDirectoryHandle = root;
  for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p);
  return (await dir.getFileHandle(parts[parts.length - 1]!)).getFile();
}

const TEXT = /^(text\/|application\/(json|xml|csv))/;
const TEXT_EXT = /\.(txt|csv|tsv|md|json|xml|html?|ya?ml|log)$/i;

/** A text file's contents, or what kind of file it is. */
export async function readText(f: File): Promise<string> {
  if (!TEXT.test(f.type) && !TEXT_EXT.test(f.name)) return `${f.name} is not a text file (${f.type || 'unknown type'}, ${size(f.size)}). It can still be attached to a file field.`;
  const text = await f.slice(0, MAX_TEXT).text();
  return f.size > MAX_TEXT ? `${text}\n(cut at ${size(MAX_TEXT)} of ${size(f.size)})` : text;
}

export function size(n: number): string {
  return n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`;
}

export async function toBase64(f: File): Promise<string> {
  const bytes = new Uint8Array(await f.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
