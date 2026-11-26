// Where the built-in tools act. In a customer's page that is the page
// itself (LocalPage); a browser extension implements PageAdapter over its
// content script, so the agent loop and the panel stay the same.

import { makeMarks, type Marks } from '../../shared/marks';
import { choose, click, describe, find, formSummary, Refs, scrollTo, settle, snapshot, type, pageSignals } from './dom';
import type { Target } from './policy';

export interface PageSignals {
  path: string;
  title: string;
  url: string;
  password: boolean;
  captcha: boolean;
}

export interface PageAdapter {
  read(max?: number): Promise<string>;
  find(query: string): Promise<string>;
  describe(ref: string): Promise<Target | null>;
  /** Fields the form around ref will send. */
  formFields(ref: string): Promise<string[]>;
  click(ref: string): Promise<void>;
  type(ref: string, text: string, opts: { clear?: boolean; submit?: boolean }): Promise<void>;
  choose(ref: string, value: string): Promise<string>;
  scroll(target: string): Promise<void>;
  /** Opens a URL on the same site (a full page load). */
  navigate(url: string): Promise<void>;
  back(): Promise<void>;
  /** Frames ref on the page for ms, with a label. */
  point(ref: string, ms?: number): Promise<boolean>;
  /** Takes away the frames point drew. */
  unpoint(): void;
  settle(): Promise<void>;
  signals(): Promise<PageSignals>;
}

/** The page the script runs in. */
export class LocalPage implements PageAdapter {
  readonly refs = new Refs();
  private marks: Marks | null = null;

  constructor(private label: string, private color: string, private nonce?: string) {}

  setLook(label: string, color: string) {
    this.label = label;
    this.color = color;
    this.marks?.remove();
    this.marks = null;
  }

  private mark(): Marks {
    // The marks live on <html>, outside <body>, so read_page never sees them.
    if (!this.marks) this.marks = makeMarks('hibira-secretary-marks', this.label, this.nonce, this.color);
    return this.marks;
  }

  private el(ref: string): Element {
    const el = this.refs.get(ref);
    if (!el) throw new Error(`no element ${ref} on the page now; call read_page again`);
    return el;
  }

  async read(max?: number) {
    return snapshot(this.refs, max).text;
  }
  async find(q: string) {
    return find(this.refs, q);
  }
  async describe(ref: string) {
    const el = this.refs.get(ref);
    return el ? describe(el) : null;
  }
  async formFields(ref: string) {
    const el = this.refs.get(ref);
    return el ? formSummary(el) : [];
  }
  async click(ref: string) {
    const el = this.el(ref);
    await this.point(ref, 900);
    await click(el);
  }
  async type(ref: string, text: string, opts: { clear?: boolean; submit?: boolean }) {
    const el = this.el(ref);
    await this.point(ref, 900);
    await type(el, text, opts);
  }
  async choose(ref: string, value: string) {
    const el = this.el(ref);
    await this.point(ref, 900);
    return choose(el, value);
  }
  async scroll(target: string) {
    const el = this.refs.get(target);
    if (el) return scrollTo(el);
    const dy = target === 'up' ? -0.8 : target === 'top' ? -1e9 : target === 'bottom' ? 1e9 : 0.8;
    window.scrollBy({ top: Math.abs(dy) > 10 ? dy : dy * innerHeight, behavior: 'smooth' });
    await new Promise((r) => setTimeout(r, 400));
  }
  async navigate(url: string) {
    const u = new URL(url, location.href);
    if (u.origin !== location.origin) throw new Error('only pages on this site can be opened');
    location.assign(u.href);
    await new Promise((r) => setTimeout(r, 5000));
  }
  async back() {
    history.back();
    await settle();
  }
  async point(ref: string, ms = 2600) {
    const el = this.refs.get(ref);
    if (!el) return false;
    await scrollTo(el);
    const m = this.mark();
    m.clearFrames();
    m.frame(el.getBoundingClientRect(), ms);
    return true;
  }
  unpoint() {
    this.mark().clearFrames();
  }
  async settle() {
    await settle();
  }
  async signals() {
    const s = pageSignals();
    return { path: location.pathname, title: document.title, url: location.href, ...s };
  }
  dispose() {
    this.marks?.remove();
    this.marks = null;
  }
}
