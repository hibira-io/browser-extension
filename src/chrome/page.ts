// The Secretary core's PageAdapter over the content script, for one tab and
// one site. Every call checks the tab is still on the site the task is about
// and that the person still has Hibi turned on there, injects the content
// script when the page is new, and treats a page load during a call (a
// click that navigates) as the call having worked.

import type { PageAdapter, PageSignals } from '../../vendor/secretary/core/page';
import type { Target } from '../../vendor/secretary/core/policy';
import type { AttachCall, ImageCall, ImageReply, PageCall, PageMethod, PageReply } from './protocol';
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

  /** Waits for the page, checks it is still the task's site and Hibi is on
   *  there, and makes sure the content script is in it. */
  private async ready(): Promise<void> {
    await waitLoaded(this.tabId);
    await this.refresh();
    if (originPattern(this.current.url) !== this.origin) throw new SiteChangedError('the tab left the site this task is about; stop and tell the person');
    if (!(await isOn(this.current.url))) throw new SiteChangedError('Hibi is turned off for this site; stop and tell the person');
    await chrome.scripting.executeScript({ target: { tabId: this.tabId }, files: ['content.js'] });
  }

  /** The look tool's picture: read by the page, or cropped from a capture
   *  of the tab when another site's image can't be read there. */
  async image(ref: string): Promise<{ media_type: string; data: string }> {
    await this.ready();
    const msg: ImageCall = { hibi: 'image', ref };
    const reply = (await chrome.tabs.sendMessage(this.tabId, msg)) as PageReply | undefined;
    if (!reply) throw new Error('the page did not answer; read the page again');
    if (!reply.ok) throw new Error(reply.error);
    const got = reply.value as ImageReply;
    if (got.kind === 'data') return { media_type: got.media_type, data: got.data };
    const tab = await chrome.tabs.get(this.tabId);
    // Chrome lets an extension capture a tab only after the person clicked
    // its button there (activeTab), which is how the panel usually opens.
    const shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }).catch(() => {
      throw new Error("this image is from another site and can only be seen after the person clicks the Hibi button on this tab; tell them, or describe it from its alt text");
    });
    return crop(shot, got);
  }

  /** Puts a file from the person's chosen folder into a file field. */
  async attach(ref: string, file: AttachCall['file']): Promise<void> {
    await this.ready();
    const msg: AttachCall = { hibi: 'attach', ref, file };
    const reply = (await chrome.tabs.sendMessage(this.tabId, msg)) as PageReply | undefined;
    if (!reply) throw new Error('the page did not answer; read the page again');
    if (!reply.ok) throw new Error(reply.error);
  }

  private async call<T>(method: PageMethod, ...args: unknown[]): Promise<T> {
    await this.ready();
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

const LOOK_MAX = 1024;

async function crop(shot: string, r: Extract<ImageReply, { kind: 'rect' }>): Promise<{ media_type: string; data: string }> {
  const bmp = await createImageBitmap(await (await fetch(shot)).blob());
  const sx = Math.round(r.x * r.dpr);
  const sy = Math.round(r.y * r.dpr);
  const sw = Math.min(bmp.width - sx, Math.round(r.w * r.dpr));
  const sh = Math.min(bmp.height - sy, Math.round(r.h * r.dpr));
  const k = Math.min(1, LOOK_MAX / Math.max(sw, sh, 1));
  const c = new OffscreenCanvas(Math.max(1, Math.round(sw * k)), Math.max(1, Math.round(sh * k)));
  const g = c.getContext('2d');
  if (!g) throw new Error('this browser cannot read images');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bmp, sx, sy, sw, sh, 0, 0, c.width, c.height);
  const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { media_type: 'image/jpeg', data: btoa(s) };
}
