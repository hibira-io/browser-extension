// Messages between the side panel and the content script.

import type { PageAdapter } from '../../vendor/secretary/core/page';

export type PageMethod = Exclude<keyof PageAdapter, never>;

/** The PageAdapter methods the content script runs; nothing else. */
export const PAGE_METHODS: readonly PageMethod[] = [
  'read', 'find', 'describe', 'formFields', 'click', 'type', 'choose', 'scroll', 'navigate', 'back', 'point', 'unpoint', 'settle', 'signals',
];

export interface PageCall {
  hibi: 'page';
  method: PageMethod;
  args: unknown[];
}

export type PageReply = { ok: true; value: unknown } | { ok: false; error: string };
