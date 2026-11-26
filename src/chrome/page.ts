// The Secretary core's PageAdapter over the content script, for one tab and
// one site. Every call checks the tab is still on the site the task is about
// and that the person still has Hibi turned on there, injects the content
// script when the page is new, and treats a page load during a call (a
// click that navigates) as the call having worked.

import type { PageAdapter, PageSignals } from '../../vendor/secretary/core/page';
import type { Target } from '../../vendor/secretary/core/policy';
import type { PageCall, PageMethod, PageReply } from './protocol';
import { isOn, originPattern } from './sites';

export class SiteChangedError extends Error {}

export class ExtensionPage implements PageAdapter {
  /** The tab's URL and title as of the last check; the runner reads them synchronously. */
  current = { url: '', title: '' };

  constructor(readonly tabId: number, readonly origin: string) {}

  async refresh(): Promise<void> {
    const tab = await chrome.tabs.get(this.tabId);
    this.current = { url: tab.url ?? '', title: tab.title ?? '' };
  }

  private async call<T>(method: PageMethod, ...args: unknown[]): Promise<T> {
    await waitLoaded(this.tabId);
    await this.refresh();
    if (originPattern(this.current.url) !== this.origin) throw new SiteChangedError('the tab left the site this task is about; stop and tell the person');
    if (!(await isOn(this.current.url))) throw new SiteChangedError('Hibi is turned off for this site; stop and tell the person');
    await chrome.scripting.executeScript({ target: { tabId: this.tabId }, files: ['content.js'] });
    // Messages are JSON: a trailing undefined would arrive as null and
    // replace the method's default.
    while (args.length && args[args.length - 1] === undefined) args.pop();
    const msg: PageCall = { hibi: 'page', method, args };
    let reply: PageReply | undefined;
    try {
      reply = (await chrome.tabs.sendMessage(this.tabId, msg)) as PageReply | undefined;
    } catch (e) {
      // The page unloaded before answering: a click or navigate that worked.
      if (method === 'click' || method === 'navigate' || method === 'back' || method === 'type') {
        await settleLoad(this.tabId);
        await this.refresh();
        return undefined as T;
      }
      throw e;
    }
    if (!reply) throw new Error('the page did not answer; read the page again');
    if (!reply.ok) throw new Error(reply.error);
    if (method === 'click' || method === 'navigate' || method === 'back') {
      await settleLoad(this.tabId);
      await this.refresh();
    }
    return reply.value as T;
  }

  read(max?: number) { return this.call<string>('read', max); }
  find(query: string) { return this.call<string>('find', query); }
  describe(ref: string) { return this.call<Target | null>('describe', ref); }
  formFields(ref: string) { return this.call<string[]>('formFields', ref); }
  click(ref: string) { return this.call<void>('click', ref); }
  type(ref: string, text: string, opts: { clear?: boolean; submit?: boolean }) { return this.call<void>('type', ref, text, opts); }
  choose(ref: string, value: string) { return this.call<string>('choose', ref, value); }
  scroll(target: string) { return this.call<void>('scroll', target); }
  navigate(url: string) { return this.call<void>('navigate', url); }
  back() { return this.call<void>('back'); }
  point(ref: string, ms?: number) { return this.call<boolean>('point', ref, ms); }
  unpoint() { this.call<void>('unpoint').catch(() => undefined); }
  settle() { return this.call<void>('settle'); }
  signals() { return this.call<PageSignals>('signals'); }
}

async function waitLoaded(tabId: number, timeout = 10_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete') return;
    await sleep(150);
  }
}

/** settleLoad gives a click time to start a page load, then waits for it. */
async function settleLoad(tabId: number): Promise<void> {
  await sleep(400);
  await waitLoaded(tabId);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
