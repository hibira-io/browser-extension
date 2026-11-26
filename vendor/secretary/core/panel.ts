// The panel: a launcher button and a chat panel in a shadow root, so the
// page's styles and ours never mix. It shows the conversation, each step
// the assistant takes, and an approval card before anything is sent.
// Plain DOM, no framework, so it fits in any page and in an extension's
// side panel (mount it into any element).

import { t, type Lang, type StringKey } from './i18n';
import { UI_ATTR } from './dom';
import type { Step } from './runner';
import type { Message, Summary } from './types';

export interface PanelOptions {
  lang: Lang;
  name: string;
  color: string;
  branding: boolean;
  /** The assistant's portrait (Hibi's), on the launcher and in the header; none draws the spark icon. */
  avatar?: string;
  autoAllowed: boolean;
  voice: boolean;
  speech: boolean;
  /** Where to mount; default a fixed launcher in the page's corner. */
  mount?: HTMLElement;
  position?: 'right' | 'left';
  nonce?: string;
}

export interface PanelEvents {
  ask: (text: string) => void;
  stop: () => void;
  reset: () => void;
  auto: (on: boolean) => void;
  mic: () => void;
  readAloud: (on: boolean) => void;
  open: (open: boolean) => void;
}

const ICON = {
  spark: '<path d="M12 3l1.8 4.9L19 9.7l-4.6 2.3L12 17l-2.4-5L5 9.7l5.2-1.8z" fill="currentColor"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" fill="currentColor" opacity=".7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  send: '<path d="M4 12l16-8-6 16-2-6z" fill="currentColor"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M5 11a7 7 0 0014 0M12 18v3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
  reset: '<path d="M4 12a8 8 0 108-8 8 8 0 00-6 2.7M4 4v4h4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="currentColor"/>',
  speaker: '<path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
};

const svg = (k: keyof typeof ICON, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;

const CSS = `[hidden]{display:none!important}

:host{all:initial}
*{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI","Noto Sans",sans-serif}
.root{--c:#d6332a;--bg:#fff;--fg:#1c1c1f;--mut:#6b6b74;--line:#e7e7ea;--soft:#f5f5f7;--bub:#f1f1f4;color:var(--fg);font-size:14px;line-height:1.45}
@media (prefers-color-scheme:dark){.root{--bg:#18181b;--fg:#ececf0;--mut:#a0a0aa;--line:#2e2e33;--soft:#222226;--bub:#26262b}}
.launch{position:fixed;bottom:20px;z-index:2147483600;width:56px;height:56px;border-radius:50%;border:0;background:var(--c);color:#fff;display:grid;place-items:center;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.25);transition:transform .15s}
.launch:hover{transform:scale(1.06)}.launch:focus-visible{outline:3px solid color-mix(in srgb,var(--c) 45%,#fff);outline-offset:3px}
.panel{position:fixed;bottom:88px;z-index:2147483601;width:min(400px,calc(100vw - 24px));height:min(620px,calc(100vh - 120px));background:var(--bg);border:1px solid var(--line);border-radius:16px;box-shadow:0 18px 60px rgba(0,0,0,.28);display:flex;flex-direction:column;overflow:hidden}
.embedded .panel{position:static;width:100%;height:100%;border-radius:0;box-shadow:none;border:0}
.panel[hidden],.launch[hidden]{display:none}
.right{right:20px}.left{left:20px}
header{display:flex;align-items:center;gap:8px;padding:12px 12px 12px 16px;border-bottom:1px solid var(--line)}
.title{flex:1;font-weight:650;font-size:15px;display:flex;align-items:center;gap:8px;min-width:0}
.launch.has-face{background:var(--bg);padding:0;overflow:hidden;border:3px solid var(--c)}.launch .face,.dot .face{width:100%;height:100%;object-fit:cover;border-radius:50%;display:block}.title .dot.has-face{background:var(--soft);width:30px;height:30px;overflow:hidden}
.title .dot{width:24px;height:24px;border-radius:50%;background:var(--c);color:#fff;display:grid;place-items:center;flex:none}
.ib{width:32px;height:32px;border-radius:8px;border:0;background:transparent;color:var(--mut);display:grid;place-items:center;cursor:pointer;position:relative}
.ib:hover{background:var(--soft);color:var(--fg)}.ib.on{color:var(--c);background:color-mix(in srgb,var(--c) 12%,transparent)}
.ib[data-tip]:hover::after{content:attr(data-tip);position:absolute;top:36px;right:0;background:var(--fg);color:var(--bg);font-size:12px;padding:4px 8px;border-radius:6px;white-space:nowrap;z-index:2}
.autobar{background:color-mix(in srgb,var(--c) 12%,transparent);color:var(--fg);font-size:12px;padding:6px 16px;display:flex;gap:6px;align-items:center}
.log{flex:1;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:10px}
.msg{max-width:88%;padding:9px 12px;border-radius:14px;white-space:pre-wrap;word-wrap:break-word}
.me{align-self:flex-end;background:var(--c);color:#fff;border-bottom-right-radius:4px}
.ai{align-self:flex-start;background:var(--bub);border-bottom-left-radius:4px}
.ai ul{margin:4px 0;padding-left:18px}.ai p{margin:0 0 6px}.ai p:last-child{margin:0}
.step{align-self:flex-start;font-size:12.5px;color:var(--mut);display:flex;gap:6px;align-items:center;padding:2px 4px}
.step i{width:8px;height:8px;border-radius:50%;background:var(--mut);flex:none}
.step.running i{background:var(--c);animation:p 1s infinite}.step.done i{background:#2f9e5b}.step.failed i,.step.refused i,.step.declined i{background:#c2410c}.step.waiting i{background:#d39e00}
@keyframes p{50%{opacity:.3}}
.card{align-self:stretch;border:1px solid color-mix(in srgb,var(--c) 40%,var(--line));background:color-mix(in srgb,var(--c) 6%,var(--bg));border-radius:12px;padding:12px}
.card b{display:block;margin-bottom:4px}.card ul{margin:6px 0 0;padding-left:18px;color:var(--mut);font-size:13px}
.row{display:flex;gap:8px;margin-top:10px}
.btn{flex:1;height:36px;border-radius:9px;border:1px solid var(--line);background:var(--bg);color:var(--fg);font-weight:600;cursor:pointer;font-size:14px}
.btn.pri{background:var(--c);border-color:var(--c);color:#fff}.btn:focus-visible{outline:2px solid var(--c);outline-offset:2px}
.note{align-self:center;font-size:12px;color:var(--mut);text-align:center}
.typing{align-self:flex-start;display:flex;gap:4px;padding:10px 12px;background:var(--bub);border-radius:14px}
.typing span{width:6px;height:6px;border-radius:50%;background:var(--mut);animation:p 1s infinite}.typing span:nth-child(2){animation-delay:.2s}.typing span:nth-child(3){animation-delay:.4s}
form{display:flex;gap:6px;align-items:flex-end;padding:10px;border-top:1px solid var(--line)}
textarea{flex:1;resize:none;border:1px solid var(--line);border-radius:12px;padding:9px 12px;background:var(--soft);color:var(--fg);font-size:14px;max-height:120px;min-height:40px;outline:none}
textarea:focus{border-color:var(--c)}
.go{width:40px;height:40px;border-radius:12px;border:0;background:var(--c);color:#fff;display:grid;place-items:center;cursor:pointer;flex:none}
.go:disabled{opacity:.4;cursor:default}
.mic.on{color:#fff;background:#c2410c}
footer{font-size:11px;color:var(--mut);text-align:center;padding:0 0 8px}footer a{color:inherit}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

const STEP_KEY: Record<string, StringKey> = {
  read_page: 'stepRead',
  find: 'stepFind',
  click: 'stepClick',
  type: 'stepType',
  select: 'stepSelect',
  scroll: 'stepScroll',
  navigate: 'stepNavigate',
  go_back: 'stepBack',
  point: 'stepPoint',
};

/** Escapes text and turns **bold**, `code` and "- " lists into HTML. */
export function miniMarkdown(s: string): string {
  const esc = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (x: string) => x.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const out: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) out.push('<ul>' + list.map((l) => `<li>${inline(l)}</li>`).join('') + '</ul>');
    list = [];
  };
  for (const line of esc.split('\n')) {
    const m = /^\s*(?:[-*•]|\d+\.)\s+(.*)$/.exec(line);
    if (m) list.push(m[1]);
    else {
      flush();
      if (line.trim()) out.push(`<p>${inline(line)}</p>`);
    }
  }
  flush();
  return out.join('');
}

export class Panel {
  readonly host: HTMLElement;
  private root: ShadowRoot;
  private wrap!: HTMLDivElement;
  private log!: HTMLDivElement;
  private input!: HTMLTextAreaElement;
  private go!: HTMLButtonElement;
  private panel!: HTMLDivElement;
  private launch!: HTMLButtonElement;
  private autoBtn?: HTMLButtonElement;
  private micBtn?: HTMLButtonElement;
  private autobar!: HTMLDivElement;
  private busy = false;
  private auto = false;
  private steps = new Map<string, HTMLDivElement>();
  private typing?: HTMLDivElement;

  constructor(private o: PanelOptions, private ev: PanelEvents) {
    this.host = document.createElement('div');
    this.host.setAttribute(UI_ATTR, 'panel');
    this.host.style.cssText = 'display:block !important';
    this.root = this.host.attachShadow({ mode: 'open' });
    this.build();
    (o.mount ?? document.body).appendChild(this.host);
  }

  private tr(k: StringKey, v: Record<string, string | number> = {}) {
    return t(this.o.lang, k, { name: this.o.name, ...v });
  }

  private build() {
    const st = document.createElement('style');
    if (this.o.nonce) st.nonce = this.o.nonce;
    st.textContent = CSS;
    this.wrap = document.createElement('div');
    this.wrap.className = 'root' + (this.o.mount ? ' embedded' : '');
    this.wrap.style.setProperty('--c', this.o.color);
    const side = this.o.position === 'left' ? 'left' : 'right';
    this.wrap.innerHTML = `
      <button class="launch ${side}" part="launcher" aria-label=""></button>
      <div class="panel ${side}" role="dialog" aria-modal="false" hidden>
        <header>
          <div class="title"><span class="dot">${svg('spark', 15)}</span><span class="nm"></span></div>
          <button class="ib speak" hidden></button>
          <button class="ib auto" hidden></button>
          <button class="ib reset"></button>
          <button class="ib close"></button>
        </header>
        <div class="autobar" hidden>${svg('bolt', 13)}<span></span></div>
        <div class="log" aria-live="polite"></div>
        <form><button type="button" class="ib mic" hidden></button><textarea rows="1"></textarea><button class="go" type="submit"></button></form>
        <footer hidden><a href="https://hibira.io/secretary" target="_blank" rel="noopener"></a></footer>
      </div>`;
    this.root.append(st, this.wrap);
    const $ = <T extends Element>(s: string) => this.wrap.querySelector(s) as T;
    this.launch = $('.launch');
    this.panel = $('.panel');
    this.log = $('.log');
    this.input = $('textarea');
    this.go = $('.go');
    this.autobar = $('.autobar');
    this.launch.innerHTML = svg('spark', 26);
    if (this.o.avatar) {
      const img = (cls: string) => {
        const i = document.createElement('img');
        i.src = this.o.avatar!;
        i.alt = '';
        i.className = cls;
        i.decoding = 'async';
        return i;
      };
      this.launch.replaceChildren(img('face'));
      this.launch.classList.add('has-face');
      $('.title .dot').replaceChildren(img('face'));
      $('.title .dot').classList.add('has-face');
    }
    this.launch.setAttribute('aria-label', this.tr('open'));
    this.launch.title = this.tr('open');
    ($('.nm') as HTMLElement).textContent = this.o.name;
    const tip = (b: HTMLElement, k: StringKey, icon: keyof typeof ICON) => {
      b.innerHTML = svg(icon);
      b.setAttribute('aria-label', this.tr(k));
      b.dataset.tip = this.tr(k);
    };
    tip($('.close'), 'close', 'x');
    tip($('.reset'), 'newChat', 'reset');
    this.input.placeholder = this.tr('placeholder');
    this.go.innerHTML = svg('send');
    this.go.setAttribute('aria-label', this.tr('send'));
    ($('.autobar span') as HTMLElement).textContent = this.tr('autoOn');
    if (this.o.branding) {
      $('footer').removeAttribute('hidden');
      ($('footer a') as HTMLElement).textContent = this.tr('powered');
    }
    if (this.o.autoAllowed) {
      this.autoBtn = $('.auto');
      this.autoBtn.hidden = false;
      tip(this.autoBtn, 'auto', 'bolt');
      this.autoBtn.onclick = () => this.toggleAuto();
    }
    if (this.o.voice) {
      this.micBtn = $('.mic');
      this.micBtn.hidden = false;
      tip(this.micBtn, 'mic', 'mic');
      this.micBtn.onclick = () => this.ev.mic();
    }
    if (this.o.speech) {
      const sp = $('.speak') as HTMLButtonElement;
      sp.hidden = false;
      tip(sp, 'readAloud', 'speaker');
      sp.onclick = () => {
        sp.classList.toggle('on');
        this.ev.readAloud(sp.classList.contains('on'));
      };
    }
    this.launch.onclick = () => this.setOpen(true);
    ($('.close') as HTMLElement).onclick = () => this.setOpen(false);
    ($('.reset') as HTMLElement).onclick = () => this.ev.reset();
    $('form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (this.busy) return this.ev.stop();
      const q = this.input.value.trim();
      if (!q) return;
      this.input.value = '';
      this.autosize();
      this.ev.ask(q);
    });
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        ($('form') as HTMLFormElement).requestSubmit();
      }
    });
    this.input.addEventListener('input', () => this.autosize());
    this.wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.o.mount) this.setOpen(false);
    });
    if (this.o.mount) {
      this.launch.hidden = true;
      this.panel.hidden = false;
      ($('.close') as HTMLElement).hidden = true;
    }
  }

  private autosize() {
    this.input.style.height = 'auto';
    this.input.style.height = Math.min(this.input.scrollHeight, 120) + 'px';
  }

  isOpen() {
    return !this.panel.hidden;
  }

  setOpen(open: boolean) {
    if (this.o.mount) return;
    this.panel.hidden = !open;
    this.launch.hidden = open;
    if (open) {
      if (!this.log.children.length) this.note(this.tr('hello', { name: this.o.name }), 'ai');
      setTimeout(() => this.input.focus(), 50);
    } else this.launch.focus();
    this.ev.open(open);
  }

  private toggleAuto() {
    if (this.auto) return this.setAuto(false);
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<div></div><div class="row"><button class="btn">${''}</button><button class="btn pri"></button></div>`;
    (card.firstElementChild as HTMLElement).textContent = this.tr('autoConfirm');
    const [no, yes] = Array.from(card.querySelectorAll('button'));
    no.textContent = this.tr('cancel');
    yes.textContent = this.tr('autoYes');
    no.onclick = () => card.remove();
    yes.onclick = () => {
      card.remove();
      this.setAuto(true);
    };
    this.append(card);
  }

  setAuto(on: boolean) {
    this.auto = on;
    this.autoBtn?.classList.toggle('on', on);
    this.autobar.hidden = !on;
    this.ev.auto(on);
  }

  setBusy(busy: boolean) {
    this.busy = busy;
    this.go.innerHTML = svg(busy ? 'stop' : 'send');
    this.go.setAttribute('aria-label', this.tr(busy ? 'stop' : 'send'));
    if (busy && !this.typing) {
      this.typing = document.createElement('div');
      this.typing.className = 'typing';
      this.typing.setAttribute('aria-label', this.tr('thinking'));
      this.typing.innerHTML = '<span></span><span></span><span></span>';
      this.append(this.typing);
    } else if (!busy) {
      this.typing?.remove();
      this.typing = undefined;
    }
  }

  setListening(on: boolean) {
    this.micBtn?.classList.toggle('on', on);
    if (on) this.input.placeholder = this.tr('listening');
    else this.input.placeholder = this.tr('placeholder');
  }

  setDraft(text: string) {
    this.input.value = text;
    this.autosize();
  }

  private append(el: HTMLElement) {
    if (this.typing && el !== this.typing) this.log.insertBefore(el, this.typing);
    else this.log.appendChild(el);
    this.log.scrollTop = this.log.scrollHeight;
  }

  note(text: string, kind: 'ai' | 'me' | 'note') {
    const d = document.createElement('div');
    d.className = kind === 'note' ? 'note' : 'msg ' + kind;
    if (kind === 'ai') d.innerHTML = miniMarkdown(text);
    else d.textContent = text;
    this.append(d);
  }

  /** Redraws the conversation (after a page load). */
  showMessages(ms: Message[]) {
    this.log.textContent = '';
    this.steps.clear();
    if (ms.length) this.note(this.tr('hello', { name: this.o.name }), 'ai');
    const results = new Map<string, { content?: unknown; is_error?: boolean }>();
    for (const m of ms) for (const b of m.content) if (b.type === 'tool_result' && b.tool_use_id) results.set(b.tool_use_id, b);
    for (const m of ms) {
      for (const b of m.content) {
        if (b.type === 'text' && b.text) this.note(b.text, m.role === 'user' ? 'me' : 'ai');
        else if (b.type === 'tool_use' && b.id) {
          // The steps taken before the page loaded, as they ended.
          const r = results.get(b.id);
          const text = typeof r?.content === 'string' ? r.content : '';
          const state: Step['state'] = !r ? 'done' : !r.is_error ? 'done' : text.startsWith('The person declined') ? 'declined' : text.startsWith('Refused') ? 'refused' : 'failed';
          this.step({ id: b.id, tool: b.name ?? '', input: (b.input ?? {}) as Record<string, unknown>, state });
        }
      }
    }
  }

  step(s: Step) {
    let el = this.steps.get(s.id);
    if (!el) {
      el = document.createElement('div');
      this.steps.set(s.id, el);
      this.append(el);
    }
    el.className = 'step ' + s.state;
    const k = STEP_KEY[s.tool];
    let label = k ? this.tr(k, { q: String(s.input.query ?? '') }) : this.tr('stepTool', { tool: s.tool });
    if (s.state === 'declined') label += ' · ' + this.tr('declined');
    if (s.state === 'refused') label += ' · ' + this.tr('refused');
    if (s.state === 'failed') label += ' · ' + this.tr('failed');
    if (s.state === 'waiting') label += ' · ' + this.tr('waiting');
    if (s.auto) label += ' ⚡';
    el.innerHTML = '<i></i><span></span>';
    (el.lastElementChild as HTMLElement).textContent = label;
  }

  /** Asks the user to approve; resolves with their answer. */
  approve(summary: Summary, signal: AbortSignal): Promise<boolean> {
    if (!this.isOpen()) this.setOpen(true);
    return new Promise((resolve) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('role', 'alertdialog');
      card.innerHTML = '<b></b><div class="what"></div><div class="row"><button class="btn no"></button><button class="btn pri yes"></button></div>';
      (card.querySelector('b') as HTMLElement).textContent = this.tr('approveTitle');
      (card.querySelector('.what') as HTMLElement).textContent = summary.text;
      if (summary.fields?.length) {
        const p = document.createElement('div');
        p.style.cssText = 'margin-top:6px;font-size:12.5px;color:var(--mut)';
        p.textContent = this.tr('willSend');
        const ul = document.createElement('ul');
        for (const f of summary.fields) {
          const li = document.createElement('li');
          li.textContent = f;
          ul.appendChild(li);
        }
        card.querySelector('.what')!.after(p, ul);
      }
      const yes = card.querySelector('.yes') as HTMLButtonElement;
      const no = card.querySelector('.no') as HTMLButtonElement;
      yes.textContent = this.tr('approve');
      no.textContent = this.tr('decline');
      const done = (v: boolean) => {
        card.remove();
        signal.removeEventListener('abort', abort);
        resolve(v);
      };
      const abort = () => done(false);
      signal.addEventListener('abort', abort);
      yes.onclick = () => done(true);
      no.onclick = () => done(false);
      this.append(card);
      yes.focus();
    });
  }

  setLook(name: string, color: string) {
    this.o.name = name;
    this.wrap.style.setProperty('--c', color);
    (this.wrap.querySelector('.nm') as HTMLElement).textContent = name;
    this.launch.setAttribute('aria-label', this.tr('open'));
    this.launch.title = this.tr('open');
  }

  clear() {
    this.log.textContent = '';
    this.steps.clear();
    this.note(this.tr('hello', { name: this.o.name }), 'ai');
  }

  destroy() {
    this.host.remove();
  }
}
