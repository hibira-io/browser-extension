// The page tools Hibi uses: read the page, click, type, pick an option,
// scroll. They run in the content script's isolated world, on a page the
// person turned Hibi on for, and follow the shared policy.

import { classifyPage, isFinalSubmit, isSecretField, labelOf, type PageBlock } from '../core/policy';
import type { ToolCall, ToolResult } from '../core/types';

const MAX_SNAPSHOT = 14_000;
const INTERACTIVE =
  'a[href], button, input, select, textarea, summary, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="tab"], [role="menuitem"], [role="option"], [role="switch"], [role="combobox"], [role="textbox"], [contenteditable=""], [contenteditable="true"]';

export class PageTools {
  private refs = new Map<number, WeakRef<Element>>();
  private next = 1;

  constructor(private doc: Document, private url: () => string) {}

  run(call: ToolCall): ToolResult {
    const block = classifyPage(this.doc, this.url());
    if (block) return blocked(block);
    switch (call.name) {
      case 'read_page':
        return { ok: true, output: this.snapshot() };
      case 'click':
        return this.click(num(call.input.ref), call.approved === true);
      case 'type_text':
        return this.type(num(call.input.ref), String(call.input.text ?? ''), call.input.clear !== false);
      case 'select_option':
        return this.select(num(call.input.ref), String(call.input.option ?? ''));
      case 'scroll':
        return this.scroll(String(call.input.direction ?? 'down'));
      default:
        return { ok: false, output: `Unknown tool ${call.name}.` };
    }
  }

  snapshot(): string {
    const lines: string[] = [`Page: ${this.doc.title}`, `URL: ${this.url()}`, ''];
    this.refs.clear();
    this.next = 1;
    const root = this.doc.body;
    if (!root) return lines.join('\n');
    const walker = this.doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let size = 0;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n as Element;
      if (!visible(el)) continue;
      const line = this.describe(el);
      if (!line) continue;
      size += line.length + 1;
      if (size > MAX_SNAPSHOT) {
        lines.push('… (page continues; scroll down and read again for more)');
        break;
      }
      lines.push(line);
    }
    return lines.join('\n');
  }

  private describe(el: Element): string | null {
    const tag = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) return `${'#'.repeat(Number(tag[1]))} ${clip(labelOf(el), 120)}`;
    if (el.matches(INTERACTIVE)) {
      const ref = this.next++;
      this.refs.set(ref, new WeakRef(el));
      return `[${ref}] ${kind(el)} ${JSON.stringify(clip(nameOf(el), 80))}${state(el)}`;
    }
    if (tag === 'p' || tag === 'li' || tag === 'td' || tag === 'th' || tag === 'dd' || tag === 'dt') {
      if (el.querySelector(INTERACTIVE)) return null;
      const t = clip(labelOf(el), 200);
      return t ? `  ${t}` : null;
    }
    return null;
  }

  private find(ref: number): Element | null {
    const el = this.refs.get(ref)?.deref();
    return el && el.isConnected ? el : null;
  }

  private click(ref: number, approved: boolean): ToolResult {
    const el = this.find(ref);
    if (!el) return stale(ref);
    if (isFinalSubmit(el) && !approved) {
      return {
        ok: false,
        needsApproval: true,
        output: `Clicking "${clip(labelOf(el), 60)}" submits. Waiting for the person's approval.`,
        approval: { action: 'click', label: clip(labelOf(el), 60), summary: this.formSummary(el) },
      };
    }
    (el as HTMLElement).scrollIntoView?.({ block: 'center' });
    (el as HTMLElement).click();
    return { ok: true, output: `Clicked [${ref}] "${clip(labelOf(el), 60)}".`, label: clip(labelOf(el), 60) };
  }

  private type(ref: number, text: string, clear: boolean): ToolResult {
    const el = this.find(ref);
    if (!el) return stale(ref);
    if (isSecretField(el)) {
      return { ok: false, output: 'This is a password, card or code field. Hibi never types there; ask the person to fill it in.' };
    }
    const h = el as HTMLElement;
    h.focus();
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      const value = clear ? text : el.value + text;
      // The native setter, so frameworks that track the value (React) see it.
      if (setter) setter.call(el, value);
      else el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (h.isContentEditable) {
      if (clear) h.textContent = '';
      h.textContent = (h.textContent ?? '') + text;
      h.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
    } else {
      return { ok: false, output: `[${ref}] is not a text field.` };
    }
    return { ok: true, output: `Typed into [${ref}].`, label: clip(nameOf(el), 60) };
  }

  private select(ref: number, option: string): ToolResult {
    const el = this.find(ref);
    if (!el) return stale(ref);
    if (!(el instanceof HTMLSelectElement)) return { ok: false, output: `[${ref}] is not a dropdown; click it instead.` };
    const want = option.trim().toLowerCase();
    const opt = [...el.options].find((o) => o.value.toLowerCase() === want || o.text.trim().toLowerCase() === want);
    if (!opt) return { ok: false, output: `No option "${option}". Options: ${[...el.options].map((o) => o.text.trim()).join(', ')}` };
    el.value = opt.value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, output: `Selected "${opt.text.trim()}" in [${ref}].`, label: opt.text.trim() };
  }

  private scroll(direction: string): ToolResult {
    const win = this.doc.defaultView;
    const h = win?.innerHeight ?? 800;
    const dy = direction === 'up' ? -h * 0.8 : direction === 'top' ? -1e9 : direction === 'bottom' ? 1e9 : h * 0.8;
    win?.scrollBy?.({ top: dy });
    return { ok: true, output: `Scrolled ${direction}. Read the page again to see what is shown.` };
  }

  /** formSummary lists the filled fields of el's form, for the approval card. */
  private formSummary(el: Element): string[] {
    const form = el.closest('form');
    if (!form) return [];
    const out: string[] = [];
    for (const f of form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select')) {
      if (!visible(f) || isSecretField(f)) continue;
      if (f instanceof HTMLInputElement && ['submit', 'button', 'hidden', 'reset', 'image'].includes(f.type)) continue;
      let value = f instanceof HTMLSelectElement ? (f.selectedOptions[0]?.text ?? '') : f.value;
      if (f instanceof HTMLInputElement && (f.type === 'checkbox' || f.type === 'radio')) {
        if (!f.checked) continue;
        value = '✓';
      }
      if (!value) continue;
      out.push(`${clip(fieldName(f), 40)}: ${clip(value, 80)}`);
      if (out.length >= 12) break;
    }
    return out;
  }
}

function blocked(block: PageBlock): ToolResult {
  const what = { login: 'a sign-in page', register: 'a sign-up page', captcha: 'a robot check' }[block];
  return {
    ok: false,
    blocked: block,
    output: `This is ${what}. Hibi leaves these to the person: ask them to finish it and tell you when they are done.`,
  };
}

function stale(ref: number): ToolResult {
  return { ok: false, output: `[${ref}] is no longer on the page. Read the page again.` };
}

function num(v: unknown): number {
  return typeof v === 'number' ? v : Number.parseInt(String(v), 10);
}

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function kind(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute('role');
  if (role) return role;
  if (tag === 'a') return 'link';
  if (tag === 'input') return `input:${(el as HTMLInputElement).type || 'text'}`;
  if (tag === 'select') return 'dropdown';
  if (tag === 'textarea') return 'textarea';
  if ((el as HTMLElement).isContentEditable) return 'editor';
  return tag;
}

function placeholder(el: Element): string {
  const labels = (el as HTMLInputElement).labels;
  const label = labels && labels.length > 0 ? labels[0] : null;
  return (label?.textContent?.trim() || el.getAttribute('placeholder') || el.getAttribute('name') || '').trim();
}

function nameOf(el: Element): string {
  const field = el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !['submit', 'button', 'reset', 'image'].includes(el.type));
  if (field) return el.getAttribute('aria-label')?.trim() || placeholder(el) || el.getAttribute('title') || '';
  return labelOf(el) || placeholder(el);
}

function fieldName(el: Element): string {
  return placeholder(el) || el.getAttribute('aria-label') || 'field';
}

function state(el: Element): string {
  const parts: string[] = [];
  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox' || el.type === 'radio') parts.push(el.checked ? 'checked' : 'unchecked');
    else if (!isSecretField(el) && el.value && el.type !== 'submit' && el.type !== 'button') parts.push(`value=${JSON.stringify(clip(el.value, 60))}`);
  } else if (el instanceof HTMLTextAreaElement && el.value) {
    parts.push(`value=${JSON.stringify(clip(el.value, 60))}`);
  } else if (el instanceof HTMLSelectElement) {
    parts.push(`selected=${JSON.stringify(el.selectedOptions[0]?.text.trim() ?? '')}`);
  }
  if ((el as HTMLButtonElement).disabled) parts.push('disabled');
  if (el.getAttribute('aria-expanded') === 'true') parts.push('expanded');
  if (el.getAttribute('aria-selected') === 'true') parts.push('selected');
  if (isFinalSubmit(el)) parts.push('submits');
  return parts.length ? ` (${parts.join(', ')})` : '';
}

function visible(el: Element): boolean {
  const h = el as HTMLElement;
  if (h.hidden || (el as HTMLInputElement).type === 'hidden') return false;
  if (el.closest('[aria-hidden="true"]')) return false;
  if (typeof h.checkVisibility === 'function') return h.checkVisibility({ visibilityProperty: true });
  const style = el.ownerDocument.defaultView?.getComputedStyle(h);
  if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
  return true;
}
