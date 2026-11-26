// Secretary: the panel, the agent loop and the tools put together. It
// takes a transport (how turns reach Hibira) and a page adapter (where
// the tools act), so the script tag, an npm import and a browser
// extension share it.

import { HttpTransport, SecretaryError, type Auth, type HandoffCommand, type HandoffTransport } from './api';
import { pickLang, t, textLang, type Lang } from './i18n';
import { LocalPage, type PageAdapter } from './page';
import { Panel } from './panel';
import { ask, resume, type RunState, type Transport } from './runner';
import { builtinTools, customTool } from './tools';
import type { ObjectSchema } from './schema';
import type { PanelInfo, Tool, ToolDef } from './types';
import { canListen, canSpeak, hush, listen, speak } from './voice';
import { webMCPTools } from './webmcp';

export interface SecretaryOptions extends Auth {
  /** Hibira's API, default https://hibira.io/secretary/v1. */
  endpoint?: string;
  /** Offer hand-off to a phone (default true). */
  handoff?: boolean;
  /** The panel's language (default: the page's). */
  lang?: string;
  /** Launcher side. */
  position?: 'right' | 'left';
  /** Mount the panel inside this element instead of a floating launcher. */
  mount?: HTMLElement;
  /** Open the panel at start. */
  open?: boolean;
  /** Turn off the microphone button. */
  voice?: boolean;
  /** Offer WebMCP tools the page declares (default true). */
  webmcp?: boolean;
  /** CSP nonce for the panel's styles. */
  nonce?: string;
  /** Overrides for an extension or tests. */
  transport?: Transport & { me?: () => Promise<PanelInfo> };
  page?: PageAdapter;
}

const STATE = 'hibira-secretary-state';
const OPEN = 'hibira-secretary-open';
const HANDOFF = 'hibira-secretary-handoff';

/** A hand-off in progress, kept across page loads. */
interface HandoffState {
  id: string;
  url: string;
  qr: string;
  after: number;
}

function load<T>(k: string): T | null {
  try {
    const v = sessionStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

function store(k: string, v: unknown) {
  try {
    if (v === null) sessionStorage.removeItem(k);
    else sessionStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage full or blocked: the conversation just won't survive a reload */
  }
}

export class Secretary {
  private transport: Transport & { me?: () => Promise<PanelInfo> };
  private page: PageAdapter;
  private panel: Panel | null = null;
  private custom = new Map<string, Tool>();
  private webmcp: Tool[] = [];
  private state: RunState = { messages: [], taskId: '' };
  private abort: AbortController | null = null;
  private auto = false;
  private speakOn = false;
  private stopListening: (() => void) | null = null;
  private lang: Lang;
  private info: PanelInfo | null = null;
  private readonly ready: Promise<void>;

  constructor(private o: SecretaryOptions) {
    const endpoint = (o.endpoint ?? 'https://hibira.io/secretary/v1').replace(/\/$/, '');
    this.endpoint = endpoint;
    this.transport = o.transport ?? new HttpTransport(endpoint, o);
    this.lang = pickLang(o.lang);
    this.page = o.page ?? new LocalPage('Hibi', '#d6332a', o.nonce);
    this.ready = this.start();
  }

  /** Registers a tool the assistant may use on this page. Returns a function that removes it. */
  tool<S extends ObjectSchema>(def: ToolDef<S>): () => void {
    const t = customTool(def);
    this.custom.set(t.name, t);
    return () => this.custom.delete(t.name);
  }

  /** Opens the panel, optionally asking a question. */
  async open(question?: string) {
    await this.ready;
    this.panel?.setOpen(true);
    if (question) this.ask(question);
  }

  close() {
    this.panel?.setOpen(false);
  }

  /** Removes the panel and stops any work. */
  destroy() {
    this.abort?.abort();
    this.panel?.destroy();
    if (this.page instanceof LocalPage) this.page.dispose();
  }

  private tools(): Tool[] {
    const all = [...builtinTools(this.page), ...this.webmcp, ...this.custom.values()];
    const seen = new Set<string>();
    return all.filter((t) => !seen.has(t.name) && seen.add(t.name)).slice(0, 64);
  }

  private endpoint = '';

  private async start() {
    try {
      this.info = this.transport.me ? await this.transport.me() : null;
    } catch (err) {
      console.warn('[Hibira Secretary]', (err as Error).message);
      if (err instanceof SecretaryError && (err.status === 401 || err.status === 403)) return;
    }
    const name = this.info?.assistant_name || 'Hibi';
    const color = this.info?.color || '#d6332a';
    if (this.page instanceof LocalPage) this.page.setLook(name, color);
    this.panel = new Panel(
      {
        lang: this.lang,
        name,
        color,
        branding: this.info?.branding ?? true,
        avatar: this.info?.avatar ? new URL(this.info.avatar, this.endpoint).href : undefined,
        autoAllowed: !!this.info?.auto_mode,
        voice: this.o.voice !== false && canListen(),
        speech: canSpeak(),
        handoff: this.o.handoff !== false && !!this.handoffs(),
        mount: this.o.mount,
        position: this.o.position,
        nonce: this.o.nonce,
      },
      {
        ask: (q) => this.ask(q),
        stop: () => this.abort?.abort(),
        reset: () => this.reset(),
        auto: (on) => (this.auto = on),
        mic: () => this.mic(),
        readAloud: (on) => {
          this.speakOn = on;
          if (!on) hush();
        },
        open: (open) => store(OPEN, open || null),
        handoff: (on) => (on ? this.startHandoff() : this.endHandoff()),
      },
    );
    if (this.o.webmcp !== false) this.webmcp = await webMCPTools();
    const saved = load<RunState>(STATE);
    if (saved?.messages?.length) {
      this.state = saved;
      this.panel.showMessages(saved.messages);
    }
    if (this.o.open || load<boolean>(OPEN) || saved?.pending) this.panel.setOpen(true);
    if (this.info && !this.info.enabled) this.panel.note(t(this.lang, 'off'), 'note');
    if (saved?.pending) this.run((h) => resume(saved, h));
    const ho = load<HandoffState>(HANDOFF);
    if (ho && this.handoffs()) this.followHandoff(ho);
  }

  private handoffs(): HandoffTransport | null {
    const tr = this.transport as Partial<HandoffTransport>;
    return tr.startHandoff && tr.syncHandoff && tr.endHandoff ? (tr as HandoffTransport) : null;
  }

  private ho: HandoffState | null = null;
  private hoTimer = 0;
  private phone = false;
  private queued: string[] = [];

  private async startHandoff() {
    const tr = this.handoffs();
    if (!tr || !this.panel) return;
    try {
      const h = await tr.startHandoff();
      this.followHandoff({ id: h.id, url: h.url, qr: h.qr, after: 0 });
    } catch (err) {
      this.panel.note((err as Error).message, 'note');
    }
  }

  private endHandoff() {
    const ho = this.ho;
    this.ho = null;
    this.phone = false;
    clearTimeout(this.hoTimer);
    store(HANDOFF, null);
    this.panel?.showHandoff(null);
    if (ho) this.handoffs()?.endHandoff(ho.id).catch(() => undefined);
  }

  /** Sends the panel to the phone and runs its commands, every 1.5 s. */
  private followHandoff(ho: HandoffState) {
    this.ho = ho;
    store(HANDOFF, ho);
    this.panel?.showHandoff(ho, this.phone);
    const tick = async () => {
      const tr = this.handoffs();
      if (!tr || !this.panel || this.ho !== ho) return;
      try {
        const out = await tr.syncHandoff(ho.id, this.panel.snapshot(), ho.after);
        if (this.ho !== ho) return;
        for (const c of out.commands) {
          ho.after = Math.max(ho.after, c.seq);
          this.command(c);
        }
        store(HANDOFF, ho);
        if (out.phone !== this.phone) {
          this.phone = out.phone;
          this.panel.showHandoff(ho, this.phone);
        }
      } catch (err) {
        if (err instanceof SecretaryError && err.status === 404) return this.endHandoff();
      }
      this.hoTimer = window.setTimeout(tick, 1500);
    };
    tick().catch(() => undefined);
  }

  private command(c: HandoffCommand) {
    if (c.type === 'stop') this.abort?.abort();
    else if (c.type === 'approve' || c.type === 'decline') this.panel?.answer(c.ref ?? '', c.type === 'approve');
    else if (c.type === 'ask' && c.text) {
      if (this.abort) this.queued.push(c.text);
      else this.ask(c.text);
    }
  }

  private reset() {
    this.abort?.abort();
    this.state = { messages: [], taskId: '' };
    store(STATE, null);
    this.panel?.clear();
  }

  private ask(q: string) {
    if (this.abort) return;
    this.panel?.note(q, 'me');
    this.run((h) => ask(this.state, q, h));
  }

  private mic() {
    if (this.stopListening) {
      this.stopListening();
      return;
    }
    hush();
    this.panel?.setListening(true);
    this.stopListening = listen(
      this.lang,
      (text, final) => {
        this.panel?.setDraft(text);
        if (final && text.trim()) {
          this.panel?.setDraft('');
          this.ask(text.trim());
        }
      },
      () => {
        this.stopListening = null;
        this.panel?.setListening(false);
      },
    );
  }

  private run(go: (h: Parameters<typeof ask>[2]) => Promise<RunState>) {
    const panel = this.panel;
    if (!panel) return;
    const ac = new AbortController();
    this.abort = ac;
    panel.setBusy(true);
    let shown = this.state.messages.length;
    let lastUnits = 1;
    go({
      transport: this.transport,
      tools: () => this.tools(),
      auto: () => this.auto,
      page: () => ({ url: location.href, title: document.title }),
      locale: () => this.lang,
      approve: (_tool, _input, summary, signal) => panel.approve(summary, signal),
      onMessages: (ms) => {
        for (const m of ms.slice(shown)) {
          if (m.role !== 'assistant') continue;
          for (const b of m.content) {
            if (b.type === 'text' && b.text && b.text !== '…') {
              panel.note(b.text, 'ai');
              if (this.speakOn && !m.content.some((x) => x.type === 'tool_use')) speak(b.text, textLang(b.text, this.lang));
            }
          }
        }
        shown = ms.length;
        this.state = { ...this.state, messages: ms };
      },
      onStep: (s) => panel.step(s),
      onTurn: (out) => {
        if (out.units > lastUnits) {
          lastUnits = out.units;
          panel.note(t(this.lang, 'limit', { n: out.units }), 'note');
        }
      },
      save: (st) => {
        this.state = st;
        store(STATE, st);
      },
      signal: ac.signal,
    })
      .then((st) => (this.state = st))
      .catch((err) => {
        if ((err as Error).name !== 'AbortError') panel.note((err as Error).message || String(err), 'note');
        store(STATE, { messages: this.state.messages, taskId: '' });
      })
      .finally(() => {
        this.abort = null;
        panel.setBusy(false);
        const next = this.queued.shift();
        if (next) this.ask(next);
      });
  }
}
