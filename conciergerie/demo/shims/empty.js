'use strict';
module.exports = { join: (...a) => a.join('/'), dirname: (p) => p, mkdirSync() {}, existsSync: () => false, readFileSync() { return ''; } };
