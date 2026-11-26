// The shapes shared by the panel, the agent loop and the page tools.

export type ToolName = 'read_page' | 'click' | 'type_text' | 'select_option' | 'scroll';

export interface ToolCall {
  id: string;
  name: ToolName | string;
  input: Record<string, unknown>;
  /** approved is set when the person approved this exact call. */
  approved?: boolean;
}

export interface Approval {
  action: 'click';
  label: string;
  /** summary lists the filled fields the submit would send. */
  summary: string[];
}

export interface ToolResult {
  ok: boolean;
  output: string;
  needsApproval?: boolean;
  approval?: Approval;
  blocked?: 'login' | 'register' | 'captcha';
  /** label names what was acted on (a button, an option), for the activity line. */
  label?: string;
}

export type Block =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export interface Message {
  role: 'user' | 'assistant';
  content: Block[];
}

export interface Usage {
  /** tasksUsed and tasksIncluded are this month's, for the person's plan. */
  tasksUsed: number;
  tasksIncluded: number;
  /** extraTaskCents is the price of a task past the allowance (0 on free). */
  extraTaskCents: number;
  canExceed: boolean;
}

export interface TurnRequest {
  taskId?: string;
  messages: Message[];
  page: { url: string; title: string; locale: string };
}

export interface TurnResponse {
  taskId: string;
  content: Block[];
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens';
  step: number;
  stepCap: number;
  usage: Usage;
}

/** The model side: one turn of the conversation, metered on the server. */
export interface Transport {
  turn(req: TurnRequest, signal?: AbortSignal): Promise<TurnResponse>;
}

/** The page side: runs one tool call on the page the task is about. */
export interface PageRunner {
  run(call: ToolCall): Promise<ToolResult>;
  page(): Promise<{ url: string; title: string }>;
}
