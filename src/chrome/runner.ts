// Runs page tools in the tab a task is about. Each call checks the tab is
// still on a site the person turned Hibi on for, injects the content script
// when needed, and waits for any page load a click starts.

import type { PageRunner, ToolCall, ToolResult } from '../core/types';
import { isOn, originPattern } from './sites';

export class TabRunner implements PageRunner {
  constructor(private tabId: number, private origin: string) {}

  async page(): Promise<{ url: string; title: string }> {
    const tab = await chrome.tabs.get(this.tabId);
    return { url: tab.url ?? '', title: tab.title ?? '' };
  }

  async run(call: ToolCall): Promise<ToolResult> {
    const tab = await chrome.tabs.get(this.tabId);
    const url = tab.url ?? '';
    if (originPattern(url) !== this.origin) {
      return { ok: false, output: 'The tab left the site this task is about. Stop and tell the person.' };
    }
    if (!(await isOn(url))) {
      return { ok: false, output: 'Hibi is turned off for this site. Stop and tell the person.' };
    }
    await waitLoaded(this.tabId);
    await chrome.scripting.executeScript({ target: { tabId: this.tabId }, files: ['content.js'] });
    const result = (await chrome.tabs.sendMessage(this.tabId, { hibi: 'tool', call })) as ToolResult;
    if (call.name === 'click' && result.ok) await settle(this.tabId);
    return result;
  }
}

async function waitLoaded(tabId: number, timeout = 10_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete') return;
    await sleep(150);
  }
}

/** settle gives a click time to start a navigation, then waits for it. */
async function settle(tabId: number): Promise<void> {
  await sleep(400);
  await waitLoaded(tabId);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
