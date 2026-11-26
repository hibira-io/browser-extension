// Hibira Live Chat on the same page: one launcher (the assistant's), and
// a hand-over to a person with the assistant's steps, never the values
// it typed (internal/livechat/assistant_handoff.go).

import type { PageAdapter } from './page';
import type { Step } from './runner';
import type { Tool } from './types';

/** What the hand-over tells the team. */
export interface HandOver {
  name: string;
  /** What the person wants, to start their message with. */
  text: string;
  steps: string[];
  stopped: string;
}

interface LiveChatAPI {
  open: (o?: { handoff?: HandOver }) => void;
  launcher?: (on: boolean) => void;
}

/** Live Chat on this page, once it supports hand-over. */
export function liveChat(): LiveChatAPI | null {
  const lc = typeof window !== 'undefined' ? (window as unknown as { HibiraLiveChat?: Partial<LiveChatAPI> }).HibiraLiveChat : undefined;
  return lc && typeof lc.open === 'function' && typeof lc.launcher === 'function' ? (lc as LiveChatAPI) : null;
}

/** Calls fn now if Live Chat is on the page, or once it loads. */
export function whenLiveChat(fn: (lc: LiveChatAPI) => void): () => void {
  const now = liveChat();
  if (now) {
    fn(now);
    return () => undefined;
  }
  const on = () => {
    const lc = liveChat();
    if (lc) fn(lc);
  };
  window.addEventListener('hibira-livechat:ready', on, { once: true });
  return () => window.removeEventListener('hibira-livechat:ready', on);
}

const QUIET = new Set(['read_page', 'find', 'scroll', 'point', 'talk_to_person']);

/** What a step acted on: the control's name, or the path it opened. Never a value. */
export async function stepTarget(s: Step, page: PageAdapter): Promise<string> {
  if (s.tool === 'navigate') {
    const raw = String(s.input.url ?? '');
    try {
      return new URL(raw, location.href).pathname.slice(0, 100);
    } catch {
      return raw.split(/[?#]/)[0].slice(0, 100);
    }
  }
  const ref = typeof s.input.ref === 'string' ? s.input.ref.slice(0, 20) : '';
  if (!ref) return '';
  const t = await page.describe(ref).catch(() => null);
  return (t?.name || t?.tag || '').slice(0, 80);
}

/** One line for the team about a step: what was done where, no values. */
export function stepLine(s: Step, target: string, custom: boolean): string | null {
  if (QUIET.has(s.tool)) return null;
  const name = target || 'a control';
  switch (s.tool) {
    case 'click':
      return `Clicked "${name}"`;
    case 'type':
      return `Typed into "${name}"`;
    case 'select':
      return `Chose an option in "${name}"`;
    case 'navigate':
      return `Opened ${target || 'a page'}`;
    case 'go_back':
      return 'Went back';
    default:
      return custom ? `Used ${s.tool}` : s.tool;
  }
}

/** How a step ended, for its line. */
export function stepEnd(s: Step): string {
  switch (s.state) {
    case 'declined':
      return ' (the person declined)';
    case 'refused':
      return ' (not allowed)';
    case 'failed':
      return ' (failed)';
    case 'waiting':
      return ' (waiting for approval)';
    default:
      return '';
  }
}

/** The assistant's tool that hands the person to the team. */
export function personTool(handOver: (text: string, reason: string) => boolean): Tool {
  return {
    name: 'talk_to_person',
    description:
      'Opens a chat with a person on the team, who sees the steps you took (never the values typed). Use it when the person asks for a human, or when you cannot finish: it is not allowed, they declined, or you are stuck. The person sends the message themselves.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: "What the person needs, in their words and language, as the first message to the team." },
        reason: { type: 'string', description: 'Why you are handing over, in a few words, in English.' },
      },
      required: ['message', 'reason'],
    } as Tool['inputSchema'],
    run: async (i) =>
      handOver(String(i.message ?? '').slice(0, 2000), String(i.reason ?? '').slice(0, 300))
        ? 'Opened a chat with the team, with your steps. The person reads and sends the first message there.'
        : 'Live Chat is not on this page.',
  };
}
