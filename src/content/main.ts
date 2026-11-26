// The content script. The side panel injects it into the active tab, only on
// sites the person turned Hibi on for. It hosts the Secretary core's
// LocalPage (the same page tools the SDK uses) and runs one method per
// message from the panel.

import { LocalPage } from '../../vendor/secretary/core/page';
import { PAGE_METHODS, type PageCall, type PageReply } from '../chrome/protocol';

declare global {
  interface Window {
    __hibiPage?: LocalPage;
  }
}

if (!window.__hibiPage) {
  const page = new LocalPage('Hibi', '#c8102e');
  window.__hibiPage = page;
  chrome.runtime.onMessage.addListener((msg: PageCall, sender, reply: (r: PageReply) => void) => {
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
