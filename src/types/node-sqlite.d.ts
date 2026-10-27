// The slice of Node 24's built-in `node:sqlite` that Cadent uses. @types/node 20 doesn't ship it;
// delete this file once @types/node is bumped to match the Node 24 runtime.
declare module "node:sqlite" {
  type Value = null | number | bigint | string | Uint8Array;

  export class StatementSync {
    all(...params: Value[]): Record<string, Value>[];
    get(...params: Value[]): Record<string, Value> | undefined;
    run(...params: Value[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  }

  export class DatabaseSync {
    constructor(path: string, options?: { readOnly?: boolean });
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
