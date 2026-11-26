import type { FromSchema, ObjectSchema } from './schema';

/** One part of a turn, as the server speaks it. */
export interface Block {
  type: 'text' | 'tool_use' | 'tool_result' | 'image';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
  is_error?: boolean;
  /** An image block: its type (image/jpeg) and base64 data. */
  media_type?: string;
  data?: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: Block[];
}

/**
 * A tool the assistant may use on this page. The shape follows MCP's
 * (name, description, inputSchema), so a tool written for a browser MCP
 * host or WebMCP fits as it is.
 */
export interface ToolDef<S extends ObjectSchema = ObjectSchema> {
  name: string;
  description: string;
  inputSchema?: S;
  /**
   * The tool changes something (saves, sends, deletes, pays): the user
   * approves each call first, unless they turned on auto mode.
   */
  write?: boolean;
  /** One line for the approval card; defaults to the tool's name and input. */
  summary?: (input: FromSchema<S>) => string;
  execute: (input: FromSchema<S>, ctx: ToolContext) => unknown | Promise<unknown>;
}

/** What a tool can use besides its input. */
export interface ToolContext {
  signal: AbortSignal;
}

/** A tool as the runner keeps it. */
export interface Tool {
  name: string;
  description: string;
  inputSchema: ObjectSchema;
  /** Decides whether a call needs the user's approval, or is refused. */
  check?: (input: Record<string, unknown>) => Check | Promise<Check>;
  /** The approval card's line and, for a form, what it will send. */
  summary?: (input: Record<string, unknown>) => Summary | Promise<Summary>;
  /** Shows the user where the call works (frames the element). */
  show?: (input: Record<string, unknown>) => Promise<void>;
  /** Takes away what show drew, once the person has answered. */
  unshow?: () => void;
  run: (input: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
  /** A tool another part of the page registered (not built in). */
  custom?: boolean;
}

export interface Summary {
  text: string;
  /** The fields a form will send ("Name: Mei"). */
  fields?: string[];
}

/** What a call needs: run it, ask the user first, or refuse with a reason. */
export type Check = { kind: 'run' } | { kind: 'ask'; why: string } | { kind: 'refuse'; why: string };

export interface TurnResult {
  message: Message;
  stop_reason: string;
  task_id: string;
  units: number;
  tasks: { used: number; included: number; extra: number };
}

export interface PanelInfo {
  workspace: string;
  assistant_name?: string;
  /** The assistant's portrait, relative to the API's origin (absent when the owner hides the branding). */
  avatar?: string;
  color?: string;
  auto_mode: boolean;
  branding: boolean;
  user: string;
  user_name?: string;
  enabled: boolean;
  tasks: { used: number; included: number; extra: number };
}
