declare module "better-sqlite3" {
    interface Statement<BindParameters extends unknown[] = unknown[]> {
        run(...params: BindParameters): { changes: number; lastInsertRowid: number | bigint };
        get(...params: BindParameters): unknown;
        all(...params: BindParameters): unknown[];
    }

    interface Database {
        pragma(source: string): unknown;
        exec(source: string): Database;
        prepare<BindParameters extends unknown[] = unknown[]>(source: string): Statement<BindParameters>;
    }

    interface DatabaseConstructor {
        new (filename: string): Database;
    }

    const Database: DatabaseConstructor;
    export = Database;
}
