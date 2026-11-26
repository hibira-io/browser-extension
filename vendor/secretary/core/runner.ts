// One question: the model answers or asks for tools; the runner checks
// each call against the policy, asks the user to approve a change, runs
// the tool and sends the result back, until the model answers in words.
// The state is saved before every action, so a click that loads a new
// page (a form post, a link) carries on after the load.

import { repairInput, resultText, toolSpecs } from './tools';
import type { Block, Message, Summary, Tool, TurnResult } from './types';

/** Tool calls one question may make. */
export const MAX_STEPS = 60;

/** Messages kept in the conversation sent to the model. */
export const MAX_HISTORY = 60;

export interface TurnRequest {
  messages: Message[];
  tools: ReturnType<typeof toolSpecs>;
  page: { url: string; title: string };
  locale: string;
  mode: '' | 'auto';
  task_id: string;
  decisions: { approved: number; declined: number; auto: number };
  stop?: boolean;
}

export interface Transport {
  turn(req: TurnRequest, signal: AbortSignal): Promise<TurnResult>;
}

export type StepState = 'running' | 'waiting' | 'done' | 'failed' | 'declined' | 'refused';

export interface Step {
  id: string;
  tool: string;
  input: Record<string, unknown>;
  state: StepState;
  error?: string;
  auto?: boolean;
}

/** What survives a page load. */
export interface RunState {
  messages: Message[];
  taskId: string;
  /** Set while tools run: the results so far and the call in progress. */
  pending?: { results: Block[]; current: string; rest: string[]; url: string };
}

export interface RunHooks {
  transport: Transport;
  tools: () => Tool[];
  auto: () => boolean;
  page: () => { url: string; title: string };
  locale: () => string;
  approve: (tool: Tool, input: Record<string, unknown>, summary: Summary, signal: AbortSignal) => Promise<boolean>;
  onMessages: (messages: Message[]) => void;
  onStep: (step: Step) => void;
  onTurn?: (out: TurnResult) => void;
  save: (state: RunState) => void;
  signal: AbortSignal;
}

/** Drops the oldest turns so a long conversation still starts with a question. */
export function trimHistory(ms: Message[], max = MAX_HISTORY): Message[] {
  if (ms.length <= max) return ms;
  let i = ms.length - max;
  while (i < ms.length && !(ms[i].role === 'user' && ms[i].content.some((b) => b.type === 'text'))) i++;
  return ms.slice(i);
}

/** Asks a new question. */
export async function ask(state: RunState, question: string, h: RunHooks): Promise<RunState> {
  const s: RunState = { messages: [...trimHistory(state.messages, MAX_HISTORY - 2), { role: 'user', content: [{ type: 'text', text: question }] }], taskId: '' };
  h.onMessages(s.messages);
  return loop(s, h);
}

/** Carries on after a page load interrupted a tool (state.pending). */
export async function resume(state: RunState, h: RunHooks): Promise<RunState> {
  const p = state.pending;
  if (!p) return state;
  const now = h.page().url;
  const results: Block[] = [
    ...p.results,
    { type: 'tool_result', tool_use_id: p.current, content: now !== p.url ? `Done; the page changed to ${now}. Read the page to see it.` : 'Done; the page reloaded. Read the page to see it.' },
    ...p.rest.map((id) => ({ type: 'tool_result' as const, tool_use_id: id, content: 'Not run: the page changed first.', is_error: true })),
  ];
  const s: RunState = { messages: [...state.messages, { role: 'user', content: results }], taskId: state.taskId };
  h.onMessages(s.messages);
  return loop(s, h);
}

async function loop(s: RunState, h: RunHooks): Promise<RunState> {
  const { signal } = h;
  let steps = 0;
  let decisions = { approved: 0, declined: 0, auto: 0 };
  for (;;) {
    h.save({ messages: s.messages, taskId: s.taskId });
    const tools = h.tools();
    const out = await h.transport.turn(
      { messages: s.messages, tools: toolSpecs(tools), page: h.page(), locale: h.locale(), mode: h.auto() ? 'auto' : '', task_id: s.taskId, decisions },
      signal,
    );
    decisions = { approved: 0, declined: 0, auto: 0 };
    s.taskId = out.task_id;
    h.onTurn?.(out);
    const reply: Message = { role: 'assistant', content: out.message.content?.length ? out.message.content : [{ type: 'text', text: '…' }] };
    s.messages = [...s.messages, reply];
    h.onMessages(s.messages);
    const uses = reply.content.filter((b) => b.type === 'tool_use');
    if (!uses.length) {
      h.save({ messages: s.messages, taskId: s.taskId });
      return s;
    }
    if (steps >= MAX_STEPS) {
      s.messages = [...s.messages, { role: 'user', content: uses.map((u) => ({ type: 'tool_result' as const, tool_use_id: u.id, content: 'Stopped: too many steps for one question.', is_error: true })) }];
      h.save({ messages: s.messages, taskId: s.taskId });
      await h.transport.turn({ messages: s.messages, tools: [], page: h.page(), locale: h.locale(), mode: '', task_id: s.taskId, decisions, stop: true }, signal).catch(() => undefined);
      return s;
    }
    const results: Block[] = [];
    for (let k = 0; k < uses.length; k++) {
      const u = uses[k];
      steps++;
      const input = repairInput((u.input ?? {}) as Record<string, unknown>);
      const step: Step = { id: u.id ?? String(steps), tool: u.name ?? '', input, state: 'running' };
      const tool = tools.find((t) => t.name === u.name);
      let content: string;
      let isError = false;
      try {
        if (signal.aborted) throw new DOMException('stopped', 'AbortError');
        if (!tool) throw new Error(`there is no tool ${u.name ?? ''} on this page`);
        h.onStep(step);
        const check = tool.check ? await tool.check(input) : { kind: 'run' as const };
        if (check.kind === 'refuse') {
          h.onStep({ ...step, state: 'refused', error: check.why });
          results.push({ type: 'tool_result', tool_use_id: u.id, content: 'Refused: ' + check.why, is_error: true });
          continue;
        }
        if (check.kind === 'ask') {
          if (h.auto()) {
            step.auto = true;
            decisions.auto++;
          } else {
            h.onStep({ ...step, state: 'waiting' });
            await tool.show?.(input);
            const summary = tool.summary ? await tool.summary(input) : { text: tool.name };
            const ok = await h.approve(tool, input, summary, signal).finally(() => tool.unshow?.());
            if (!ok) {
              decisions.declined++;
              h.onStep({ ...step, state: 'declined' });
              results.push({ type: 'tool_result', tool_use_id: u.id, content: 'The person declined this. Nothing was done.', is_error: true });
              continue;
            }
            decisions.approved++;
            h.onStep({ ...step, state: 'running' });
          }
        }
        // A page load during the tool picks up from here (resume).
        h.save({ messages: s.messages, taskId: s.taskId, pending: { results: [...results], current: u.id ?? '', rest: uses.slice(k + 1).map((x) => x.id ?? ''), url: h.page().url } });
        content = resultText(await tool.run(input, { signal }));
        h.onStep({ ...step, state: 'done' });
      } catch (err) {
        if ((err as Error).name === 'AbortError') throw err;
        content = 'Failed: ' + ((err as Error).message || String(err));
        isError = true;
        h.onStep({ ...step, state: 'failed', error: (err as Error).message });
      }
      results.push({ type: 'tool_result', tool_use_id: u.id, content, is_error: isError || undefined });
    }
    s.messages = [...s.messages, { role: 'user', content: results }];
    h.onMessages(s.messages);
  }
}
