// The side panel: Hibi's conversation for the active tab, the per-site
// switch, sign-in and this month's allowance.

import { Agent } from '../core/agent';
import type { Approval, Usage } from '../core/types';
import { currentSession, signIn, signOut } from '../chrome/auth';
import { BASE } from '../chrome/config';
import { TabRunner } from '../chrome/runner';
import { isOn, originPattern, turnOff, turnOn } from '../chrome/sites';
import { HibiraTransport, HttpError } from '../chrome/transport';

const t = (key: string, ...subs: string[]): string => chrome.i18n.getMessage(key, subs) || key;
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const log = $('log');
const gate = $('gate');
const form = $<HTMLFormElement>('ask');
const input = $<HTMLTextAreaElement>('input');
const sendBtn = $<HTMLButtonElement>('send');
const stopBtn = $<HTMLButtonElement>('stop');
const siteLabel = $('site');
const meter = $('meter');
const account = $('account');

input.placeholder = t('askPlaceholder');
sendBtn.title = t('send');
stopBtn.title = t('stop');
$('menu').title = t('account');

const transport = new HibiraTransport(async () => (await currentSession())?.token ?? null);
let agent: Agent | null = null;
let agentKey = '';
let running: AbortController | null = null;
let tab: chrome.tabs.Tab | null = null;
let thinking: HTMLElement | null = null;

declare const __DEMO__: boolean;

async function activeTab(): Promise<chrome.tabs.Tab | null> {
  // Local demo builds can pin the panel to a tab, for screenshots taken with
  // the panel open in its own window.
  const pinned = __DEMO__ ? Number(new URLSearchParams(location.search).get('tab')) : 0;
  if (pinned) return chrome.tabs.get(pinned);
  const [t0] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t0 ?? null;
}

async function refresh(): Promise<void> {
  tab = await activeTab();
  const url = tab?.url ?? '';
  const origin = originPattern(url);
  siteLabel.textContent = origin ? new URL(url).host : '';
  const session = await currentSession();
  renderAccount(session?.email ?? null);
  gate.replaceChildren();
  gate.hidden = true;
  form.hidden = true;
  if (!session) return showGate(t('signInIntro'), t('signIn'), onSignIn);
  if (tab && tab.url === undefined) return showGate(t('needInvoke'));
  if (!origin) return showGate(t('unsupportedPage'));
  if (!(await isOn(url))) {
    return showGate(t('siteOffIntro', new URL(url).host), t('turnOn', new URL(url).host), onTurnOn);
  }
  form.hidden = false;
  if (agentKey !== `${tab?.id}|${origin}`) {
    agentKey = `${tab?.id}|${origin}`;
    agent = null;
    log.replaceChildren();
    say('hibi', t('hello', new URL(url).host));
  }
}

function showGate(text: string, button?: string, action?: () => void): void {
  gate.hidden = false;
  const p = document.createElement('p');
  p.textContent = text;
  gate.append(p);
  if (button && action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'primary wide';
    b.textContent = button;
    b.addEventListener('click', action);
    gate.append(b);
  }
}

function renderAccount(email: string | null): void {
  account.replaceChildren();
  if (!email) return;
  const who = document.createElement('div');
  who.textContent = email;
  const links = document.createElement('div');
  links.className = 'row';
  const billing = linkButton(t('managePlan'), () => chrome.tabs.create({ url: new URL('/secretary/extension/plan', BASE).toString() }));
  const off = tab?.url && originPattern(tab.url) ? linkButton(t('turnOffSite'), onTurnOff) : null;
  const out = linkButton(t('signOut'), async () => {
    await signOut();
    account.hidden = true;
    await refresh();
  });
  links.append(billing, ...(off ? [off] : []), out);
  account.append(who, links);
}

function linkButton(text: string, action: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'link';
  b.textContent = text;
  b.addEventListener('click', action);
  return b;
}

async function onSignIn(): Promise<void> {
  try {
    await signIn();
  } catch (e) {
    say('note', (e as Error).message);
  }
  await refresh();
}

async function onTurnOn(): Promise<void> {
  if (tab?.url) await turnOn(tab.url);
  await refresh();
}

async function onTurnOff(): Promise<void> {
  if (tab?.url) await turnOff(tab.url);
  account.hidden = true;
  agentKey = '';
  await refresh();
}

function say(who: 'hibi' | 'me' | 'note' | 'action', text: string): HTMLElement {
  const div = document.createElement('div');
  div.className = `msg ${who}`;
  div.textContent = text;
  log.append(div);
  if (thinking?.isConnected && thinking !== div) log.append(thinking);
  log.scrollTop = log.scrollHeight;
  return div;
}

function ask(card: HTMLElement, yes: string, no: string): Promise<boolean> {
  return new Promise((resolve) => {
    const row = document.createElement('div');
    row.className = 'row';
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'primary';
    ok.textContent = yes;
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = no;
    const done = (v: boolean) => {
      row.remove();
      card.classList.add(v ? 'approved' : 'declined');
      const s = document.createElement('div');
      s.className = 'verdict';
      s.textContent = v ? t('approved') : t('declined');
      card.append(s);
      resolve(v);
    };
    ok.addEventListener('click', () => done(true));
    cancel.addEventListener('click', () => done(false));
    row.append(ok, cancel);
    card.append(row);
    log.scrollTop = log.scrollHeight;
    ok.focus();
  });
}

function approvalCard(a: Approval): Promise<boolean> {
  const card = document.createElement('div');
  card.className = 'msg approval';
  const title = document.createElement('strong');
  title.textContent = t('approveTitle', a.label);
  card.append(title);
  if (a.summary.length) {
    const ul = document.createElement('ul');
    for (const line of a.summary) {
      const li = document.createElement('li');
      li.textContent = line;
      ul.append(li);
    }
    card.append(ul);
  }
  log.append(card);
  return ask(card, t('approve'), t('decline'));
}

function activity(tool: string, label: string): string {
  switch (tool) {
    case 'read_page':
      return t('actRead');
    case 'click':
      return t('actClick', label);
    case 'type_text':
      return t('actType', label);
    case 'select_option':
      return t('actSelect', label);
    case 'scroll':
      return t('actScroll');
    default:
      return tool;
  }
}

function showUsage(u: Usage): void {
  const left = Math.max(0, u.tasksIncluded - u.tasksUsed);
  meter.textContent = left > 0 || !u.canExceed ? t('tasksLeft', String(left), String(u.tasksIncluded)) : t('tasksExtra', (u.extraTaskCents / 100).toFixed(2));
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  void run();
});
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    form.requestSubmit();
  }
});
stopBtn.addEventListener('click', () => running?.abort());
$('menu').addEventListener('click', () => {
  account.hidden = !account.hidden || account.childElementCount === 0;
});

async function run(): Promise<void> {
  const text = input.value.trim();
  if (!text || running || !tab?.id || !tab.url) return;
  const origin = originPattern(tab.url);
  if (!origin) return;
  input.value = '';
  say('me', text);
  if (!agent) {
    agent = new Agent(
      transport,
      new TabRunner(tab.id, origin),
      {
        text: (s) => void say('hibi', s),
        action: (call, result) => void say('action', activity(call.name, result.label ?? '')),
        approve: approvalCard,
        continueTask: (step, cap) => {
          const card = say('note', t('stepCap', String(cap)));
          return ask(card, t('continue'), t('stopHere'));
        },
        usage: showUsage,
      },
      chrome.i18n.getUILanguage(),
    );
  }
  running = new AbortController();
  sendBtn.hidden = true;
  stopBtn.hidden = false;
  thinking = say('note', t('working'));
  try {
    await agent.ask(text, running.signal);
  } catch (e) {
    if ((e as Error).name !== 'AbortError') {
      if (e instanceof HttpError && e.status === 401) await signOut();
      if (e instanceof HttpError && e.code === 'allowance_used') {
        say('note', t('allowanceUsed'));
      } else say('note', (e as Error).message);
    }
  } finally {
    thinking.remove();
    thinking = null;
    running = null;
    sendBtn.hidden = false;
    stopBtn.hidden = true;
    await refresh();
  }
}

chrome.tabs.onActivated.addListener(() => void (running ? undefined : refresh()));
chrome.tabs.onUpdated.addListener((id, info) => {
  if (id === tab?.id && info.url && !running) void refresh();
});
chrome.runtime.onMessage.addListener((msg: { hibi?: string }) => {
  if (msg.hibi === 'invoked' && !running) void refresh();
});
chrome.permissions.onAdded.addListener(() => void refresh());
chrome.permissions.onRemoved.addListener(() => void refresh());
void refresh();
