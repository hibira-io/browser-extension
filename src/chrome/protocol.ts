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

/** A file for attach (no PageAdapter method: the extension's own). */
export interface AttachCall {
  hibi: 'attach';
  ref: string;
  file: { name: string; type: string; data: string };
}

/** An image for the look tool: its pixels when the page may read them, or
 *  else where it is on screen, for the panel to crop from a tab capture. */
export interface ImageCall {
  hibi: 'image';
  ref: string;
}
export type ImageReply = { kind: 'data'; media_type: string; data: string } | { kind: 'rect'; x: number; y: number; w: number; h: number; dpr: number };

export type PageReply = { ok: true; value: unknown } | { ok: false; error: string };
