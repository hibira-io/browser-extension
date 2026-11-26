// The built-in tools: everything a person does with a page, over a
// PageAdapter. Each call is checked against the policy (policy.ts): it
// runs, waits for the user's approval, or is refused with a reason the
// model passes on.

import type { PageAdapter } from './page';
import { authPage, decideClick, decideSelect, decideType, type Decision } from './policy';
import type { ObjectSchema } from './schema';
import type { Check, Tool, ToolDef } from './types';

const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : '');
const obj = (properties: Record<string, unknown>, required: string[] = []): ObjectSchema => ({ type: 'object', properties, required } as ObjectSchema);
const S = (description: string) => ({ type: 'string', description });
const B = (description: string) => ({ type: 'boolean', description });
const REF = S('The ref of the element from read_page or find, like e12.');

function toCheck(d: Decision): Check {
  return d;
}

/** The page is a sign-in, sign-up or robot check page: nothing on it is ours. */
async function pageRefusal(page: PageAdapter): Promise<Check | null> {
  const s = await page.signals();
  if (s.captcha) return { kind: 'refuse', why: 'This page shows a robot check (CAPTCHA). The person must complete it themselves.' };
  if (authPage(s.path, s.title, s.password)) return { kind: 'refuse', why: 'This is a sign-in, sign-up or password page. The person does that themselves.' };
  return null;
}

/** The built-in tools over page. */
export function builtinTools(page: PageAdapter): Tool[] {
  const describeOr = async (ref: string) => {
    const t = await page.describe(ref);
    if (!t) throw new Error(`no element ${ref} on the page now; call read_page again`);
    return t;
  };
  const label = async (ref: string) => {
    const t = await page.describe(ref);
    return t ? `${t.name || t.tag}` : ref;
  };
  return [
    {
      name: 'read_page',
      description: 'Reads the page the person is on: its text and every control, each with a ref (e1, e2...). Call it first, and again after anything changes the page.',
      inputSchema: obj({}),
      run: () => page.read(),
    },
    {
      name: 'find',
      description: 'Finds controls on the page whose name or value contains some words. Use it on long pages instead of reading everything.',
      inputSchema: obj({ query: S('Words to look for.') }, ['query']),
      run: (i) => page.find(str(i.query, 200)),
    },
    {
      name: 'click',
      description: 'Clicks a link, button, tab, checkbox, menu item or other control. A click that submits, saves, sends, deletes or pays waits for the person to approve it.',
      inputSchema: obj({ ref: REF }, ['ref']),
      check: async (i) => (await pageRefusal(page)) ?? toCheck(decideClick(await describeOr(str(i.ref, 20)))),
      summary: async (i) => ({ text: `Click "${await label(str(i.ref, 20))}"`, fields: await page.formFields(str(i.ref, 20)) }),
      show: async (i) => void (await page.point(str(i.ref, 20), 60_000)),
      unshow: () => page.unpoint(),
      run: async (i) => {
        await page.click(str(i.ref, 20));
        await page.settle();
        return 'Clicked. Read the page to see what changed.';
      },
    },
    {
      name: 'type',
      description: 'Types text into a field (replacing what is there unless clear is false). Set submit to press Enter afterwards, which waits for approval unless it only searches.',
      inputSchema: obj({ ref: REF, text: S('What to type.'), clear: B('Replace the current text (default true).'), submit: B('Press Enter afterwards.') }, ['ref', 'text']),
      check: async (i) => (await pageRefusal(page)) ?? toCheck(decideType(await describeOr(str(i.ref, 20)), i.submit === true)),
      summary: async (i) => ({ text: `Type "${str(i.text, 80)}" into "${await label(str(i.ref, 20))}" and press Enter`, fields: await page.formFields(str(i.ref, 20)) }),
      show: async (i) => void (await page.point(str(i.ref, 20), 60_000)),
      unshow: () => page.unpoint(),
      run: async (i) => {
        await page.type(str(i.ref, 20), str(i.text, 5000), { clear: i.clear !== false, submit: i.submit === true });
        await page.settle();
        return i.submit ? 'Typed and pressed Enter. Read the page to see what changed.' : 'Typed.';
      },
    },
    {
      name: 'select',
      description: 'Chooses an option in a drop-down list (a <select>), by its text or value. For custom drop-downs, click them and then click the option.',
      inputSchema: obj({ ref: REF, value: S('The option to choose.') }, ['ref', 'value']),
      check: async (i) => (await pageRefusal(page)) ?? toCheck(decideSelect(await describeOr(str(i.ref, 20)))),
      run: async (i) => {
        const got = await page.choose(str(i.ref, 20), str(i.value, 200));
        await page.settle();
        return `Chose "${got}".`;
      },
    },
    {
      name: 'scroll',
      description: 'Scrolls the page: "down", "up", "top", "bottom", or to an element by ref.',
      inputSchema: obj({ to: S('down, up, top, bottom or a ref.') }, ['to']),
      run: async (i) => {
        await page.scroll(str(i.to, 20) || 'down');
        return 'Scrolled.';
      },
    },
    {
      name: 'navigate',
      description: 'Opens a page on this site by its path or URL. Prefer clicking links in the page; never guess an address.',
      inputSchema: obj({ url: S('A path like /orders or a URL on this site.') }, ['url']),
      run: async (i) => {
        await page.navigate(str(i.url, 500));
        return 'Opened.';
      },
    },
    {
      name: 'go_back',
      description: 'Goes back to the previous page.',
      inputSchema: obj({}),
      run: async () => {
        await page.back();
        return 'Went back.';
      },
    },
    {
      name: 'point',
      description: 'Frames an element on the page to show the person where something is, without clicking it.',
      inputSchema: obj({ ref: REF }, ['ref']),
      run: async (i) => ((await page.point(str(i.ref, 20))) ? 'Shown.' : 'That element is not on the page now.'),
    },
  ];
}

/** A tool the page registered (secretary.tool) as the runner keeps it. */
export function customTool<S extends ObjectSchema>(def: ToolDef<S>): Tool {
  const name = def.name.trim();
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(name)) throw new Error(`Secretary: bad tool name "${def.name}" (letters, digits and _, starting with a letter)`);
  return {
    name,
    description: def.description,
    inputSchema: def.inputSchema ?? { type: 'object', properties: {} },
    custom: true,
    check: def.write ? () => ({ kind: 'ask', why: 'changes something' }) : undefined,
    summary: def.summary ? (i) => ({ text: def.summary!(i as never) }) : (i) => ({ text: `${name} ${JSON.stringify(i).slice(0, 160)}` }),
    run: async (input, ctx) => def.execute(input as never, ctx),
  };
}

/** The tools as the server wants them. */
export function toolSpecs(tools: Tool[]) {
  return tools.map((t) => ({ name: t.name, description: t.description.slice(0, 1024), input_schema: t.inputSchema }));
}

/** A tool's result as text for the model (cut to keep turns small). */
export function resultText(v: unknown, max = 16000): string {
  let s: string;
  if (v === undefined || v === null) s = 'Done.';
  else if (typeof v === 'string') s = v;
  else {
    try {
      s = JSON.stringify(v);
    } catch {
      s = String(v);
    }
  }
  return s.length > max ? s.slice(0, max) + '… (cut)' : s;
}
