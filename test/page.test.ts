import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExtensionPage, SiteChangedError } from '../src/chrome/page';
import { PAGE_METHODS } from '../src/chrome/protocol';

let url = 'https://shop.test/orders';
let granted = true;
const sent: unknown[] = [];

beforeEach(() => {
  url = 'https://shop.test/orders';
  granted = true;
  sent.length = 0;
  vi.stubGlobal('chrome', {
    tabs: {
      get: async () => ({ url, title: 'Orders', status: 'complete' }),
      sendMessage: async (_id: number, msg: { method: string; args: unknown[] }) => {
        sent.push(msg);
        return { ok: true, value: msg.method === 'read' ? 'Page: Orders' : undefined };
      },
    },
    scripting: { executeScript: async () => [] },
    permissions: { contains: async () => granted },
  });
});

describe('ExtensionPage', () => {
  it('runs core page methods in the content script', async () => {
    const page = new ExtensionPage(1, 'https://shop.test/*');
    expect(await page.read()).toBe('Page: Orders');
    expect(sent[0]).toEqual({ hibi: 'page', method: 'read', args: [] });
    expect(page.current).toEqual({ url, title: 'Orders' });
  });

  it('stops when the tab leaves the site or the site is turned off', async () => {
    const page = new ExtensionPage(1, 'https://shop.test/*');
    url = 'https://other.test/';
    await expect(page.read()).rejects.toBeInstanceOf(SiteChangedError);
    url = 'https://shop.test/';
    granted = false;
    await expect(page.click('e1')).rejects.toBeInstanceOf(SiteChangedError);
    expect(sent).toHaveLength(0);
  });

  it('allows inspection but prevents replay after an interrupted write', async () => {
    const page = new ExtensionPage(1, 'https://shop.test/*');
    const send = vi.spyOn(chrome.tabs, 'sendMessage');
    send.mockRejectedValueOnce(new Error('port closed'));
    await expect(page.click('e1')).rejects.toThrow('outcome unknown');
    expect(await page.read()).toBe('Page: Orders');
    await expect(page.click('e1')).rejects.toThrow('outcome unknown');
    expect(send).toHaveBeenCalledTimes(2);
    page.beginRequest();
    await page.choose('e2', 'a');
  });

  it('covers every PageAdapter method', () => {
    const page = new ExtensionPage(1, 'https://shop.test/*');
    for (const m of PAGE_METHODS) expect(typeof page[m]).toBe('function');
  });
});
