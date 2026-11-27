// Reading and operating the page the way a person would: a text snapshot
// of what is on screen with a ref (e1, e2...) for every control, and
// clicks, typing and choosing options on those refs with the events a real
// person's input fires, so React, Vue, Livewire and Alpine pages react as
// usual. Passwords and card numbers are never read out.

import type { Target } from './policy';

/** Elements the panel itself draws, skipped when reading the page. */
export const UI_ATTR = 'data-hibira-secretary';

const INTERACTIVE =
  'a[href],button,input,select,textarea,summary,[role=button],[role=link],[role=tab],[role=menuitem],[role=menuitemcheckbox],[role=menuitemradio],[role=checkbox],[role=radio],[role=switch],[role=option],[role=combobox],[role=searchbox],[role=textbox],[role=treeitem],[contenteditable=""],[contenteditable=true],[onclick],[wire\\:click],[x-on\\:click],[\\@click]';

const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'CANVAS', 'IFRAME', 'OBJECT', 'EMBED', 'HEAD', 'META', 'LINK']);
const BLOCK = /^(P|LI|TD|TH|DT|DD|H[1-6]|LABEL|LEGEND|CAPTION|FIGCAPTION|BLOCKQUOTE|PRE|SUMMARY|DIV|SECTION|ARTICLE|HEADER|FOOTER|MAIN|NAV|ASIDE|FORM|FIELDSET|TR|SPAN)$/;
const CAPTCHA = /captcha|turnstile|cf-chl|g-recaptcha|h-captcha|arkose|funcaptcha/i;

/** Refs given out by the last read, and back. */
export class Refs {
  private byRef = new Map<string, Element>();
  private n = 0;
  reset() {
    this.byRef.clear();
    this.n = 0;
  }
  add(el: Element): string {
    const r = 'e' + ++this.n;
    this.byRef.set(r, el);
    return r;
  }
  get(ref: unknown): Element | null {
    if (typeof ref !== 'string') return null;
    const el = this.byRef.get(ref.trim().replace(/^\[|\]$/g, ''));
    return el && el.isConnected ? el : null;
  }
}

function visible(el: Element): boolean {
  if (!(el instanceof HTMLElement) && !(el instanceof SVGElement)) return true;
  if (el.closest(`[${UI_ATTR}],[data-secretary=private]`)) return false;
  if ((el as HTMLElement).hidden || el.getAttribute('aria-hidden') === 'true') return false;
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse' || Number(cs.opacity) === 0) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 || r.height > 0 || cs.display === 'contents';
}

const squash = (s: string | null | undefined, n = 160) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};

/** A control's accessible name, as near as we can tell. */
export function nameOf(el: Element): string {
  const aria = el.getAttribute('aria-label');
  if (aria) return squash(aria);
  const by = el.getAttribute('aria-labelledby');
  if (by) {
    const t = by
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ');
    if (t.trim()) return squash(t);
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      const lt = l && labelText(l);
      if (lt) return squash(lt);
    }
    const wrap = el.closest('label');
    const own = wrap && labelText(wrap);
    if (own) return squash(own);
    if ('placeholder' in el && el.placeholder) return squash(el.placeholder);
    if (el instanceof HTMLInputElement && (el.type === 'submit' || el.type === 'button') && el.value) return squash(el.value);
    if (el.name) return squash(el.name.replace(/[_\-[\].]+/g, ' '));
  }
  const text = (el as HTMLElement).innerText ?? el.textContent;
  if (text?.trim()) return squash(text, 80);
  const img = el.querySelector('img[alt],svg[aria-label],[title]');
  const alt = img?.getAttribute('alt') || img?.getAttribute('aria-label') || img?.getAttribute('title');
  return squash(alt || el.getAttribute('title') || el.getAttribute('data-tooltip') || el.getAttribute('x-tooltip') || '');
}

/** A wrapping label's own words, without the text of the controls inside it (a select's options). */
function labelText(label: Element): string {
  const copy = label.cloneNode(true) as Element;
  copy.querySelectorAll('select,textarea,input,button,datalist,script,style,template').forEach((n) => n.remove());
  return copy.textContent?.trim() ?? '';
}

function roleOf(el: Element): string {
  const r = el.getAttribute('role');
  if (r) return r;
  const tag = el.tagName.toLowerCase();
  if (tag === 'a') return 'link';
  if (tag === 'select') return 'select';
  if (tag === 'textarea') return 'textbox';
  if (tag === 'summary') return 'disclosure';
  if (tag === 'input') {
    const t = (el as HTMLInputElement).type;
    if (t === 'checkbox' || t === 'radio') return t;
    if (t === 'submit' || t === 'button' || t === 'reset' || t === 'image') return 'button';
    if (t === 'search') return 'searchbox';
    if (t === 'file') return 'file';
    return 'textbox';
  }
  if ((el as HTMLElement).isContentEditable) return 'textbox';
  return tag === 'button' ? 'button' : 'button';
}

function secretField(el: Element): boolean {
  if (!(el instanceof HTMLInputElement)) return false;
  return el.type === 'password' || /password|one-time-code|^cc-/.test(el.autocomplete || '');
}

function valueOf(el: Element): string {
  if (secretField(el)) return (el as HTMLInputElement).value ? '(hidden)' : '';
  if (el instanceof HTMLSelectElement) return squash(Array.from(el.selectedOptions).map((o) => o.text).join(', '));
  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox' || el.type === 'radio') return '';
    if (el.type === 'file') return el.files?.length ? squash(Array.from(el.files).map((f) => f.name).join(', '), 120) : '';
    return squash(el.value, 120);
  }
  if (el instanceof HTMLTextAreaElement) return squash(el.value, 200);
  if ((el as HTMLElement).isContentEditable) return squash((el as HTMLElement).innerText, 200);
  return '';
}

function states(el: Element): string[] {
  const out: string[] = [];
  const h = el as HTMLInputElement;
  if (h.disabled || el.getAttribute('aria-disabled') === 'true') out.push('disabled');
  if ((el instanceof HTMLInputElement && (h.type === 'checkbox' || h.type === 'radio') && h.checked) || el.getAttribute('aria-checked') === 'true') out.push('checked');
  if (el.getAttribute('aria-pressed') === 'true') out.push('pressed');
  if (el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-current')) out.push('current');
  const exp = el.getAttribute('aria-expanded');
  if (exp) out.push(exp === 'true' ? 'expanded' : 'collapsed');
  if (h.required || el.getAttribute('aria-required') === 'true') out.push('required');
  if (el.getAttribute('aria-invalid') === 'true') out.push('invalid');
  return out;
}

/** The plain description the policy decides on. */
export function describe(el: Element): Target {
  const form = (el as HTMLInputElement).form ?? el.closest('form');
  let type: string | undefined = (el as HTMLInputElement).type || undefined;
  if (el instanceof HTMLButtonElement) type = el.getAttribute('type') || (form ? 'submit' : 'button');
  const ov = el.closest('[data-secretary]')?.getAttribute('data-secretary');
  const handler = ['wire:click', 'x-on:click', '@click', 'onclick', 'data-method', 'aria-haspopup', 'aria-expanded', 'hx-post', 'hx-delete', 'hx-put', 'hx-patch']
    .filter((a) => el.hasAttribute(a))
    .map((a) => a + '=' + (el.getAttribute(a) ?? ''))
    .join(' ');
  const href = el instanceof HTMLAnchorElement ? el.href : undefined;
  return {
    tag: el.tagName.toLowerCase(),
    type,
    role: el.getAttribute('role') ?? undefined,
    name: nameOf(el),
    override: ov === 'private' ? 'never' : ov === 'safe' || ov === 'confirm' || ov === 'never' ? ov : undefined,
    autocomplete: (el as HTMLInputElement).autocomplete || el.getAttribute('autocomplete') || undefined,
    href,
    sameOrigin: href ? new URL(href, location.href).origin === location.origin : undefined,
    form: form ? { hasPassword: !!form.querySelector('input[type=password]'), action: form.getAttribute('action') ?? undefined, name: squash(form.getAttribute('aria-label') || form.id || '') } : undefined,
    handler: handler || undefined,
    captcha: inCaptcha(el),
  };
}

function inCaptcha(el: Element): boolean {
  for (let e: Element | null = el; e; e = e.parentElement) {
    if (CAPTCHA.test(e.id) || CAPTCHA.test(typeof e.className === 'string' ? e.className : '') || CAPTCHA.test(e.getAttribute('name') ?? '')) return true;
  }
  return false;
}

/** Whether the page has a robot check or a password field showing. */
export function pageSignals() {
  const password = Array.from(document.querySelectorAll('input[type=password]')).some(visible);
  const captcha = Array.from(document.querySelectorAll('iframe[src*="captcha"],iframe[src*="turnstile"],iframe[src*="challenges.cloudflare"],.g-recaptcha,.h-captcha,.cf-turnstile')).some(visible);
  return { password, captcha };
}

export interface Snapshot {
  text: string;
  truncated: boolean;
}

/**
 * Reads the page: its title and address, its text in reading order and
 * every visible control with a ref. Text past max characters is cut.
 */
export function snapshot(refs: Refs, max = 14000, root: Element = document.body): Snapshot {
  refs.reset();
  const lines: string[] = [];
  let size = 0;
  let truncated = false;
  const push = (s: string) => {
    if (truncated) return;
    if (size + s.length > max) {
      truncated = true;
      return;
    }
    lines.push(s);
    size += s.length + 1;
  };
  const sig = pageSignals();
  push(`Page: ${document.title} (${location.pathname}${location.search ? '?…' : ''})`);
  if (sig.password) push('Note: this page has a password field. Signing in or up is for the person.');
  if (sig.captcha) push('Note: this page shows a robot check. The person must complete it.');
  const dialog = Array.from(document.querySelectorAll('[role=dialog][aria-modal=true],dialog[open],.fi-modal-open')).find(visible);
  if (dialog) push('Note: a dialog is open; its content is listed first.');
  const seenText = new Set<string>();
  const walk = (el: Element, depth: number) => {
    if (truncated || (SKIP.has(el.tagName.toUpperCase()) && !isPicture(el)) || !visible(el)) return;
    if (el !== root && isPicture(el)) {
      const ref = refs.add(el);
      const name = squash(el.getAttribute('alt') || el.getAttribute('aria-label') || el.querySelector?.('title')?.textContent || '', 120);
      push('  '.repeat(Math.min(depth, 6)) + `[${ref}] image${name ? ` "${name}"` : ''}`);
      return;
    }
    if (el !== root && el.matches(INTERACTIVE) && !(el.tagName === 'LABEL')) {
      const ref = refs.add(el);
      const role = roleOf(el);
      const name = nameOf(el);
      const val = valueOf(el);
      const st = states(el);
      let line = `[${ref}] ${role}${name ? ` "${name}"` : ''}`;
      if (val) line += ` = "${val}"`;
      if (el instanceof HTMLSelectElement && el.options.length <= 30) line += ` options: ${Array.from(el.options).map((o) => squash(o.text, 40)).join(' | ')}`;
      if (el instanceof HTMLAnchorElement && el.href && new URL(el.href).origin === location.origin) line += ` → ${new URL(el.href).pathname}`;
      if (st.length) line += ` (${st.join(', ')})`;
      push('  '.repeat(Math.min(depth, 6)) + line);
      // A control's own text is its name; still look inside composite widgets.
      if (!/^(BUTTON|A|SELECT|TEXTAREA|INPUT|SUMMARY)$/.test(el.tagName)) {
        for (const c of Array.from(el.children)) if (c.matches(INTERACTIVE)) walk(c, depth + 1);
      }
      return;
    }
    if (/^H[1-6]$/.test(el.tagName)) {
      const t = squash((el as HTMLElement).innerText, 200);
      if (t) push(`${'#'.repeat(Number(el.tagName[1]))} ${t}`);
      for (const c of Array.from(el.children)) if (c.matches(INTERACTIVE) || c.querySelector(INTERACTIVE)) walk(c, depth + 1);
      return;
    }
    // Own text: the element's direct text nodes.
    let own = '';
    for (const n of Array.from(el.childNodes)) if (n.nodeType === Node.TEXT_NODE) own += n.textContent;
    own = squash(own, 300);
    if (own && BLOCK.test(el.tagName) && !seenText.has(own)) {
      seenText.add(own);
      push('  '.repeat(Math.min(depth, 6)) + own);
    } else if (own && !seenText.has(own)) {
      seenText.add(own);
      push('  '.repeat(Math.min(depth, 6)) + own);
    }
    if (el.shadowRoot) for (const c of Array.from(el.shadowRoot.children)) walk(c, depth);
    const nextDepth = el.tagName === 'TR' || el.tagName === 'LI' || el.tagName === 'FORM' || el.tagName === 'TABLE' ? depth + 1 : depth;
    for (const c of Array.from(el.children)) walk(c, nextDepth);
  };
  if (dialog) walk(dialog, 0);
  walk(root, 0);
  if (truncated) lines.push('… (the page is longer; scroll or use find to see more)');
  return { text: lines.join('\n'), truncated };
}

/** An image, canvas or drawing big enough to be worth looking at. */
function isPicture(el: Element): boolean {
  if (!(el instanceof HTMLImageElement || el instanceof HTMLCanvasElement || (el instanceof SVGSVGElement && !el.closest('button,a,[role=button]')))) return false;
  const r = el.getBoundingClientRect();
  return r.width >= 48 && r.height >= 48;
}

/** The longest side an image is sent at. */
const LOOK_MAX = 1024;

/**
 * Captures an image, canvas or drawing on the page as a JPEG (data without
 * the data: prefix), at most LOOK_MAX pixels a side. Never one inside the
 * assistant or a data-secretary="private" area, and never an image from
 * another site that does not allow it (the browser keeps those unreadable).
 */
export async function captureImage(el: Element): Promise<{ media_type: string; data: string }> {
  if (!isPicture(el)) throw new Error('that is not an image, chart or drawing; use read_page for text');
  if (!visible(el)) throw new Error('that image is hidden or private');
  let src: CanvasImageSource;
  let w: number;
  let h: number;
  if (el instanceof HTMLCanvasElement) {
    src = el;
    w = el.width;
    h = el.height;
  } else {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    if (el instanceof HTMLImageElement) {
      img.src = el.currentSrc || el.src;
    } else {
      const svg = el.cloneNode(true) as SVGSVGElement;
      const r = el.getBoundingClientRect();
      svg.setAttribute('width', String(r.width));
      svg.setAttribute('height', String(r.height));
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
    }
    await img.decode().catch(() => {
      throw new Error('this image cannot be read (another site keeps it private)');
    });
    src = img;
    w = img.naturalWidth || el.getBoundingClientRect().width;
    h = img.naturalHeight || el.getBoundingClientRect().height;
  }
  const k = Math.min(1, LOOK_MAX / Math.max(w, h, 1));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  const g = c.getContext('2d');
  if (!g) throw new Error('this browser cannot read images');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(src, 0, 0, c.width, c.height);
  let url: string;
  try {
    url = c.toDataURL('image/jpeg', 0.8);
  } catch {
    throw new Error('this image cannot be read (another site keeps it private)');
  }
  return { media_type: 'image/jpeg', data: url.slice(url.indexOf(',') + 1) };
}

/** Controls and text that match words, for long pages. */
export function find(refs: Refs, query: string, limit = 25): string {
  const q = query.toLowerCase().trim();
  if (!q) return 'Say what to find.';
  const out: string[] = [];
  for (const el of Array.from(document.querySelectorAll(INTERACTIVE))) {
    if (out.length >= limit) break;
    if (!visible(el)) continue;
    const name = nameOf(el);
    if (name.toLowerCase().includes(q) || valueOf(el).toLowerCase().includes(q)) {
      out.push(`[${refs.add(el)}] ${roleOf(el)} "${name}"`);
    }
  }
  return out.length ? out.join('\n') : `Nothing on the page matches "${query}".`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Waits until the page stops changing (or ms passes). */
export async function settle(ms = 2500): Promise<void> {
  const start = Date.now();
  let last = Date.now();
  const mo = new MutationObserver(() => (last = Date.now()));
  mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  try {
    await sleep(120);
    while (Date.now() - start < ms && Date.now() - last < 350) await sleep(80);
    while (Date.now() - start < ms && Date.now() - last < 350) await sleep(80);
  } finally {
    mo.disconnect();
  }
}

function centre(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export async function scrollTo(el: Element) {
  el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
  await sleep(250);
}

/** Clicks like a person: pointer and mouse events, then click. */
export async function click(el: Element) {
  await scrollTo(el);
  const { x, y } = centre(el);
  const opts = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0, view: window };
  el.dispatchEvent(new PointerEvent('pointerover', opts));
  el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerId: 1, isPrimary: true }));
  el.dispatchEvent(new MouseEvent('mousedown', opts));
  if (el instanceof HTMLElement) el.focus({ preventScroll: true });
  el.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerId: 1, isPrimary: true }));
  el.dispatchEvent(new MouseEvent('mouseup', opts));
  if (el instanceof HTMLElement) el.click();
  else el.dispatchEvent(new MouseEvent('click', opts));
}

/** Sets a field's value the way frameworks notice (React tracks the native setter). */
function setNative(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const set = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (set) set.call(el, value);
  else el.value = value;
}

export async function type(el: Element, text: string, opts: { clear?: boolean; submit?: boolean } = {}) {
  await scrollTo(el);
  if (el instanceof HTMLElement) el.focus();
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const next = opts.clear === false ? el.value + text : text;
    el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }));
    setNative(el, next);
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (el instanceof HTMLElement && el.isContentEditable) {
    if (opts.clear !== false) {
      const sel = getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    if (!document.execCommand('insertText', false, text)) el.textContent = text;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  } else {
    throw new Error('that element is not a text field');
  }
  if (opts.submit) {
    const key = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    const go = el.dispatchEvent(new KeyboardEvent('keydown', key));
    el.dispatchEvent(new KeyboardEvent('keypress', key));
    el.dispatchEvent(new KeyboardEvent('keyup', key));
    const form = (el as HTMLInputElement).form;
    if (go && form && el instanceof HTMLInputElement) form.requestSubmit();
  }
}

export async function choose(el: Element, value: string) {
  await scrollTo(el);
  if (!(el instanceof HTMLSelectElement)) {
    throw new Error('that is not a list of options; click it, then click the option');
  }
  const want = value.toLowerCase().trim();
  const opt = Array.from(el.options).find((o) => o.value.toLowerCase() === want || o.text.toLowerCase().trim() === want) ?? Array.from(el.options).find((o) => o.text.toLowerCase().includes(want));
  if (!opt) throw new Error(`no option "${value}"; options are ${Array.from(el.options).map((o) => o.text).join(', ')}`);
  el.value = opt.value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return opt.text;
}

/** The fields a form is about to send, for the approval card (no secrets). */
export function formSummary(el: Element): string[] {
  const form = (el as HTMLInputElement).form ?? el.closest('form') ?? el.closest('[role=dialog]');
  if (!form) return [];
  const out: string[] = [];
  for (const f of Array.from(form.querySelectorAll('input,select,textarea'))) {
    if (out.length >= 8) break;
    const i = f as HTMLInputElement;
    if (i.type === 'hidden' || i.type === 'submit' || i.type === 'button' || !visible(f)) continue;
    let v = valueOf(f);
    if (i.type === 'checkbox' || i.type === 'radio') {
      if (!i.checked) continue;
      v = '✓';
    }
    if (!v) continue;
    out.push(`${(nameOf(f) || i.name).replace(/\s*\*$/, '')}: ${v}`);
  }
  return out;
}
