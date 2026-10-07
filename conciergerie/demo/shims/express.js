'use strict';
// Minimal Express-compatible router running in the browser (demo build only).

function compile(path, end) {
  const keys = [];
  const src = path.replace(/[.+*?^$()[\]{}|\\]/g, '\\$&').replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+?)'; });
  return { re: new RegExp(`^${src}${end ? '/?$' : '(?=/|$)'}`), keys };
}

function Router() {
  const stack = [];
  const router = (req, res, next) => handle(req, res, next);
  const add = (method, path, fns, end) => {
    const { re, keys } = compile(path, end);
    for (const fn of fns) stack.push({ method, re, keys, fn, prefix: !end });
  };
  for (const m of ['get', 'post', 'put', 'delete']) {
    router[m] = (path, ...fns) => { add(m.toUpperCase(), path, fns, true); return router; };
  }
  router.use = (...args) => {
    const path = typeof args[0] === 'string' ? args.shift() : '';
    add(null, path === '/' ? '' : path, args, false);
    return router;
  };

  function handle(req, res, done) {
    let i = 0;
    const next = async (err) => {
      while (i < stack.length) {
        const l = stack[i++];
        if (l.method && l.method !== req.method) continue;
        const m = l.re.exec(req.path);
        if (!m) continue;
        const isErrHandler = l.fn.length === 4;
        if (Boolean(err) !== isErrHandler) continue;
        const params = {};
        l.keys.forEach((k, j) => { params[k] = decodeURIComponent(m[j + 1]); });
        if (l.prefix) {
          const saved = { path: req.path, params: req.params };
          req.path = req.path.slice(m[0].length) || '/';
          if (!req.path.startsWith('/')) req.path = `/${req.path}`;
          req.params = params;
          const restore = () => { req.path = saved.path; req.params = saved.params; };
          try { await (isErrHandler ? l.fn(err, req, res, (e) => { restore(); return next(e); }) : l.fn(req, res, (e) => { restore(); return next(e); })); }
          catch (e) { restore(); return next(e); }
          return;
        }
        req.params = params;
        try { await l.fn(req, res, next); } catch (e) { return next(e); }
        return;
      }
      return done(err);
    };
    return next();
  }
  return router;
}

function express() { throw new Error('express() non disponible en démo'); }
express.Router = Router;
express.json = () => (req, res, next) => next();
module.exports = express;
