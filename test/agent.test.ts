import { describe, expect, it } from 'vitest';
import { Agent } from '../src/core/agent';
import type { PageRunner, ToolCall, ToolResult, Transport, TurnRequest, TurnResponse } from '../src/core/types';

const usage = { tasksUsed: 1, tasksIncluded: 30, extraTaskCents: 5, canExceed: true };

function scripted(turns: Omit<TurnResponse, 'usage' | 'taskId' | 'stepCap'>[], cap = 20): Transport & { reqs: TurnRequest[] } {
  const reqs: TurnRequest[] = [];
  return {
    reqs,
    async turn(req) {
      reqs.push(structuredClone(req));
      const t = turns.shift();
      if (!t) throw new Error('no more turns');
      return { ...t, taskId: 'task_1', stepCap: cap, usage };
    },
  };
}

function runner(results: (c: ToolCall) => ToolResult): PageRunner & { calls: ToolCall[] } {
  const calls: ToolCall[] = [];
  return {
    calls,
    async run(c) {
      calls.push(c);
      return results(c);
    },
    async page() {
      return { url: 'https://a.test/', title: 'A' };
    },
  };
}

const events = (approve: boolean, cont = false) => {
  const out = { texts: [] as string[], approvals: 0 };
  return {
    out,
    ev: {
      text: (s: string) => out.texts.push(s),
      action: () => undefined,
      approve: async () => {
        out.approvals++;
        return approve;
      },
      continueTask: async () => cont,
      usage: () => undefined,
    },
  };
};

describe('Agent', () => {
  it('runs tools until the model answers', async () => {
    const tr = scripted([
      { content: [{ type: 'tool_use', id: 't1', name: 'read_page', input: {} }], stopReason: 'tool_use', step: 1 },
      { content: [{ type: 'text', text: 'Done.' }], stopReason: 'end_turn', step: 2 },
    ]);
    const r = runner(() => ({ ok: true, output: 'page' }));
    const { out, ev } = events(true);
    await new Agent(tr, r, ev, 'en').ask('read it');
    expect(out.texts).toEqual(['Done.']);
    expect(tr.reqs[1]?.taskId).toBe('task_1');
    expect(tr.reqs[1]?.messages.at(-1)?.content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 't1', content: 'page' });
  });

  it('reruns an approved submit with approved set, and reports a declined one', async () => {
    for (const approve of [true, false]) {
      const tr = scripted([
        { content: [{ type: 'tool_use', id: 't1', name: 'click', input: { ref: 3 } }], stopReason: 'tool_use', step: 1 },
        { content: [{ type: 'text', text: 'ok' }], stopReason: 'end_turn', step: 2 },
      ]);
      const r = runner((c) =>
        c.approved ? { ok: true, output: 'Clicked' } : { ok: false, needsApproval: true, output: 'wait', approval: { action: 'click', label: 'Save', summary: [] } },
      );
      const { out, ev } = events(approve);
      await new Agent(tr, r, ev, 'en').ask('save');
      expect(out.approvals).toBe(1);
      expect(r.calls.length).toBe(approve ? 2 : 1);
      const result = tr.reqs[1]?.messages.at(-1)?.content[0];
      expect(result).toMatchObject(approve ? { content: 'Clicked' } : { is_error: true });
    }
  });

  it('asks before going past the step cap', async () => {
    const tr = scripted([{ content: [{ type: 'tool_use', id: 't1', name: 'scroll', input: {} }], stopReason: 'tool_use', step: 2 }], 2);
    const r = runner(() => ({ ok: true, output: 'ok' }));
    const { ev } = events(true, false);
    await new Agent(tr, r, ev, 'en').ask('go');
    expect(tr.reqs.length).toBe(1);
  });
});
