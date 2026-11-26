// The shared core: no globals, no script-tag bootstrap. A page imports it
// through index.ts; a browser extension can import the parts it needs.
export { Secretary, type SecretaryOptions } from './secretary';
export { HttpTransport, SecretaryError, type Auth } from './api';
export { LocalPage, type PageAdapter, type PageSignals } from './page';
export { Panel, type PanelOptions, type PanelEvents } from './panel';
export { ask, resume, trimHistory, MAX_STEPS, type RunHooks, type RunState, type Step, type Transport, type TurnRequest } from './runner';
export { builtinTools, customTool, toolSpecs, resultText } from './tools';
export { authPage, decideClick, decideSelect, decideType, type Decision, type Target } from './policy';
export { snapshot, find, click, type as typeInto, choose, settle, describe, formSummary, Refs } from './dom';
export { pickLang, STRINGS, type Lang } from './i18n';
export { webMCPTools } from './webmcp';
export type { FromSchema, JSONSchema, ObjectSchema } from './schema';
export type { Block, Message, Tool, ToolDef, ToolContext, Check, Summary, TurnResult, PanelInfo } from './types';
