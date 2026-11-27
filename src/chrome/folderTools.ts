// Page tools for the person's chosen folder: list it, read a text file, and
// put a file into a file field. Submitting the form still waits for approval.

import type { Tool } from '../../vendor/secretary/core/types';
import { MAX_ATTACH, fileAt, listFiles, readText, size, toBase64, usableFolder } from './folder';
import type { ExtensionPage } from './page';

const str = (v: unknown, max: number) => String(v ?? '').slice(0, max);
const noFolder = 'No folder is open to Hibi. Ask the person to choose one with the folder button in the panel.';

export function folderTools(page: ExtensionPage): Tool[] {
  return [
    {
      name: 'list_files',
      description: "Lists the files in the folder the person chose for Hibi on their computer (and its subfolders, one level), with sizes. Use it when they mention their files.",
      inputSchema: { type: 'object', properties: {}, required: [] },
      run: async () => {
        const root = await usableFolder(false);
        return root ? listFiles(root) : noFolder;
      },
    },
    {
      name: 'read_file',
      description: 'Reads a text file (txt, csv, json, md...) from the chosen folder, by its path from list_files.',
      inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Path from list_files.' } }, required: ['path'] },
      run: async (i) => {
        const root = await usableFolder(false);
        if (!root) return noFolder;
        return readText(await fileAt(root, str(i.path, 300)));
      },
    },
    {
      name: 'attach_file',
      description: 'Puts a file from the chosen folder into a file field on the page (role file in read_page), by its ref and the file path from list_files. Submitting the form afterwards waits for approval as usual.',
      inputSchema: {
        type: 'object',
        properties: { ref: { type: 'string', description: 'The file field from read_page.' }, path: { type: 'string', description: 'Path from list_files.' } },
        required: ['ref', 'path'],
      },
      run: async (i) => {
        const root = await usableFolder(false);
        if (!root) return noFolder;
        const f = await fileAt(root, str(i.path, 300));
        if (f.size > MAX_ATTACH) return `${f.name} is ${size(f.size)}; Hibi attaches files up to ${size(MAX_ATTACH)}.`;
        await page.attach(str(i.ref, 20), { name: f.name, type: f.type, data: await toBase64(f) });
        return `Attached ${f.name}. Read the page to see what changed.`;
      },
    },
  ];
}
