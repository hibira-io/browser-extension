// WebMCP (experimental): a page can declare tools for AI agents on
// document.modelContext (Chromium's origin trial; navigator.modelContext in
// earlier drafts). When a page has, Secretary offers those tools too, so
// the page needs no Secretary-specific code. The proposal may still
// change; secretary.tool() is the supported way.

import type { Tool } from './types';

interface ModelContextTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  execute?: (input: unknown) => unknown;
  annotations?: { readOnlyHint?: boolean };
}

interface ModelContext {
  tools?: ModelContextTool[] | (() => ModelContextTool[]);
  listTools?: () => ModelContextTool[] | Promise<ModelContextTool[]>;
}

function context(): ModelContext | null {
  const d = document as unknown as { modelContext?: ModelContext };
  const n = navigator as unknown as { modelContext?: ModelContext };
  return d.modelContext ?? n.modelContext ?? null;
}

/** The tools the page declared through WebMCP, if any. */
export async function webMCPTools(): Promise<Tool[]> {
  const mc = context();
  if (!mc) return [];
  let list: ModelContextTool[] = [];
  try {
    if (typeof mc.listTools === 'function') list = await mc.listTools();
    else if (typeof mc.tools === 'function') list = mc.tools();
    else if (Array.isArray(mc.tools)) list = mc.tools;
  } catch {
    return [];
  }
  return list
    .filter((t) => t && /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(t.name) && typeof t.execute === 'function')
    .slice(0, 24)
    .map((t) => ({
      name: t.name,
      description: (t.description ?? t.name).slice(0, 1024),
      inputSchema: (t.inputSchema?.type === 'object' ? t.inputSchema : { type: 'object', properties: {} }) as unknown as Tool['inputSchema'],
      custom: true,
      // A tool that doesn't say it only reads may change something: ask.
      check: t.annotations?.readOnlyHint ? undefined : () => ({ kind: 'ask' as const, why: 'changes something' }),
      summary: (i) => ({ text: `${t.name} ${JSON.stringify(i).slice(0, 160)}` }),
      run: async (input) => t.execute!(input),
    }));
}
