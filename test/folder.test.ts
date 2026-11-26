// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fileAt, listFiles, readText } from '../src/chrome/folder';

// A folder handle stand-in: name → File or nested folder.
type Tree = { [name: string]: File | Tree };
function dir(name: string, tree: Tree): any {
  return {
    kind: 'directory',
    name,
    async *values() {
      for (const [n, v] of Object.entries(tree)) yield v instanceof File ? file(n, v) : dir(n, v);
    },
    async getDirectoryHandle(n: string) {
      const v = tree[n];
      if (!v || v instanceof File) throw new Error('NotFoundError');
      return dir(n, v);
    },
    async getFileHandle(n: string) {
      const v = tree[n];
      if (!(v instanceof File)) throw new Error('NotFoundError');
      return file(n, v);
    },
  };
}
const file = (name: string, f: File) => ({ kind: 'file', name, getFile: async () => f });

const root = dir('Invoices', {
  'march.csv': new File(['date,total\n2026-03-01,36'], 'march.csv', { type: 'text/csv' }),
  'scan.pdf': new File([new Uint8Array(2048)], 'scan.pdf', { type: 'application/pdf' }),
  '.DS_Store': new File(['x'], '.DS_Store'),
  2025: { 'old.txt': new File(['hi'], 'old.txt', { type: 'text/plain' }), deep: { 'x.txt': new File(['x'], 'x.txt') } },
});

describe('the chosen folder', () => {
  it('lists files one level down, without hidden files', async () => {
    const out = await listFiles(root);
    expect(out).toContain('march.csv (');
    expect(out).toContain('scan.pdf (2 KB)');
    expect(out).toContain('2025/old.txt');
    expect(out).not.toContain('.DS_Store');
    expect(out).not.toContain('x.txt');
  });

  it('reads text files and describes the rest', async () => {
    expect(await readText(await fileAt(root, 'march.csv'))).toContain('2026-03-01,36');
    expect(await readText(await fileAt(root, '2025/old.txt'))).toBe('hi');
    expect(await readText(await fileAt(root, 'scan.pdf'))).toMatch(/not a text file.*attached/);
  });

  it('stays inside the folder', async () => {
    await expect(fileAt(root, '../secret.txt')).rejects.toThrow(/list_files/);
    await expect(fileAt(root, '')).rejects.toThrow(/list_files/);
    await expect(fileAt(root, 'nope.txt')).rejects.toThrow();
  });
});
