// The agent loop: send the conversation to the server, run the page tools the
// model asks for, and repeat until it answers. A submit waits for the
// person's approval; a task past its step cap asks before it goes on, since
// going on counts as another task.

import type { Approval, Block, Message, PageRunner, ToolCall, ToolResult, Transport, TurnResponse, Usage } from './types';

/** hardStop bounds one ask, whatever the server says, in model turns. */
const hardStop = 100;

export interface AgentEvents {
  text(text: string): void;
  action(call: ToolCall, result: ToolResult): void;
  approve(approval: Approval): Promise<boolean>;
  continueTask(step: number, cap: number): Promise<boolean>;
  usage(usage: Usage): void;
}

export class Agent {
  messages: Message[] = [];
  private taskId: string | undefined;

  constructor(
    private transport: Transport,
    private runner: PageRunner,
    private events: AgentEvents,
    private locale: string,
  ) {}

  reset(): void {
    this.messages = [];
    this.taskId = undefined;
  }

  /** ask runs one request from the person to its end. */
  async ask(text: string, signal?: AbortSignal): Promise<void> {
    this.taskId = undefined;
    this.messages.push({ role: 'user', content: [{ type: 'text', text }] });
    for (let turn = 0; turn < hardStop; turn++) {
      if (signal?.aborted) return;
      const page = await this.runner.page();
      const res: TurnResponse = await this.transport.turn(
        { taskId: this.taskId, messages: this.messages, page: { ...page, locale: this.locale } },
        signal,
      );
      this.taskId = res.taskId;
      this.events.usage(res.usage);
      this.messages.push({ role: 'assistant', content: res.content });
      for (const b of res.content) if (b.type === 'text' && b.text.trim()) this.events.text(b.text);
      const calls = res.content.filter((b): b is Extract<Block, { type: 'tool_use' }> => b.type === 'tool_use');
      if (res.stopReason !== 'tool_use' || calls.length === 0) return;
      const results: Block[] = [];
      for (const c of calls) {
        if (signal?.aborted) return;
        results.push(await this.runTool({ id: c.id, name: c.name, input: c.input }));
      }
      this.messages.push({ role: 'user', content: results });
      if (res.step >= res.stepCap) {
        if (!(await this.events.continueTask(res.step, res.stepCap))) return;
        this.taskId = undefined;
      }
    }
  }

  private async runTool(call: ToolCall): Promise<Block> {
    let result = await this.runner.run(call);
    if (result.needsApproval && result.approval) {
      if (await this.events.approve(result.approval)) {
        result = await this.runner.run({ ...call, approved: true });
      } else {
        return {
          type: 'tool_result',
          tool_use_id: call.id,
          is_error: true,
          content: 'The person declined this submit. Do not submit; ask them what to change.',
        };
      }
    }
    if (result.ok) this.events.action(call, result);
    return { type: 'tool_result', tool_use_id: call.id, content: result.output, is_error: !result.ok || undefined };
  }
}
