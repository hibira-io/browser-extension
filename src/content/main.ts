// The content script. The side panel injects it into the active tab, only on
// sites the person turned Hibi on for, and sends it one tool call at a time.

import type { ToolCall, ToolResult } from '../core/types';
import { PageTools } from './tools';

declare global {
  interface Window {
    __hibiTools?: PageTools;
  }
}

if (!window.__hibiTools) {
  const tools = new PageTools(document, () => location.href);
  window.__hibiTools = tools;
  chrome.runtime.onMessage.addListener((msg: { hibi?: 'tool'; call?: ToolCall }, sender, reply: (r: ToolResult) => void) => {
    if (msg.hibi !== 'tool' || !msg.call || sender.id !== chrome.runtime.id) return false;
    try {
      reply(tools.run(msg.call));
    } catch (e) {
      reply({ ok: false, output: `The page tool failed: ${(e as Error).message}` });
    }
    return false;
  });
}
