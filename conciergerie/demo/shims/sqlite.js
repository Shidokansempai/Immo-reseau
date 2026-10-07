'use strict';
// node:sqlite DatabaseSync API on top of sql.js (demo build only).
class DatabaseSync {
  constructor() {
    this.db = new globalThis.__SQL.Database(globalThis.__demoDbBytes || undefined);
    globalThis.__demoDb = this.db;
  }
  exec(sql) { this.db.exec(sql); }
  prepare(sql) {
    const db = this.db;
    const norm = (p) => p.map((v) => (typeof v === 'bigint' ? Number(v) : v));
    const withStmt = (p, fn) => {
      const s = db.prepare(sql);
      try { s.bind(norm(p)); return fn(s); } finally { s.free(); }
    };
    return {
      get: (...p) => withStmt(p, (s) => (s.step() ? s.getAsObject() : undefined)),
      all: (...p) => withStmt(p, (s) => { const out = []; while (s.step()) out.push(s.getAsObject()); return out; }),
      run: (...p) => {
        withStmt(p, (s) => s.step());
        return { changes: db.getRowsModified(), lastInsertRowid: db.exec('SELECT last_insert_rowid()')[0].values[0][0] };
      },
    };
  }
  close() {}
}
module.exports = { DatabaseSync };
