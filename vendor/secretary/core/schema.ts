// Types for tools whose input is described by a JSON Schema: write the
// schema `as const` and the tool's execute gets its input typed from it.
//
//   secretary.tool({
//     name: 'refund_order',
//     inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } as const,
//     execute: ({ id }) => api.refund(id), // id: string
//   });

export type JSONSchema =
  | { type: 'string'; enum?: readonly string[]; description?: string }
  | { type: 'number' | 'integer'; description?: string; minimum?: number; maximum?: number }
  | { type: 'boolean'; description?: string }
  | { type: 'array'; items: JSONSchema; description?: string }
  | ObjectSchema;

export interface ObjectSchema {
  type: 'object';
  properties?: { readonly [k: string]: JSONSchema };
  required?: readonly string[];
  description?: string;
}

type Simplify<T> = { [K in keyof T]: T[K] } & {};

/** The value a schema describes. */
export type FromSchema<S> = S extends { type: 'string'; enum: readonly (infer E)[] }
  ? E
  : S extends { type: 'string' }
    ? string
    : S extends { type: 'number' | 'integer' }
      ? number
      : S extends { type: 'boolean' }
        ? boolean
        : S extends { type: 'array'; items: infer I }
          ? FromSchema<I>[]
          : S extends { type: 'object'; properties: infer P }
            ? Simplify<
                { -readonly [K in keyof P as K extends Req<S> ? K : never]: FromSchema<P[K]> } & {
                  -readonly [K in keyof P as K extends Req<S> ? never : K]?: FromSchema<P[K]>;
                }
              >
            : S extends { type: 'object' }
              ? Record<string, unknown>
              : unknown;

type Req<S> = S extends { required: readonly (infer R)[] } ? R : never;
