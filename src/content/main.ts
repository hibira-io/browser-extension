// The content script. The side panel injects it into the active tab, only on
// sites the person turned Hibi on for. It hosts the Secretary core's
// LocalPage (the same page tools the SDK uses) and runs one method per
// message from the panel.

import { LocalPage } from '../../vendor/secretary/core/page';
import { PAGE_METHODS, type AttachCall, type PageCall, type PageReply } from '../chrome/protocol';

declare global {
  interface Window {
    __hibiPage?: LocalPage;
  }
}

if (!window.__hibiPage) {
  const page = new LocalPage('Hibi', '#c8102e');
  window.__hibiPage = page;
  chrome.runtime.onMessage.addListener((msg: PageCall | AttachCall, sender, reply: (r: PageReply) => void) => {
    if (msg?.hibi === 'attach' && sender.id === chrome.runtime.id) {
      attach(page, msg).then(
        () => reply({ ok: true, value: undefined }),
        (e: unknown) => reply({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      );
      return true;
    }
    if (msg?.hibi !== 'page' || sender.id !== chrome.runtime.id || !PAGE_METHODS.includes(msg.method)) return false;
    const fn = page[msg.method] as (...a: unknown[]) => unknown;
    Promise.resolve()
      .then(() => fn.apply(page, msg.args))
      .then(
        (value) => reply({ ok: true, value }),
        (e: unknown) => reply({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      );
    return true;
  });
}

// Sets a file field's file, as if the person had picked it, from a file the
// panel read from the person's chosen folder.
async function attach(page: LocalPage, msg: AttachCall): Promise<void> {
  const el = page.refs.get(msg.ref);
  if (!(el instanceof HTMLInputElement) || el.type !== 'file') throw new Error(`${msg.ref} is not a file field; call read_page again`);
  if (el.disabled) throw new Error('that file field is turned off');
  const bin = atob(msg.file.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const dt = new DataTransfer();
  if (el.multiple) for (const f of Array.from(el.files ?? [])) dt.items.add(f);
  dt.items.add(new File([bytes], msg.file.name, { type: msg.file.type || 'application/octet-stream' }));
  el.files = dt.files;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  await page.point(msg.ref, 900);
}
