const util = require('util');

if (typeof URL !== 'undefined' && !URL.parse) {
  URL.parse = function (url, base) {
    try {
      return new URL(url, base);
    } catch {
      return null;
    }
  };
}

if (!util.styleText) {
  util.styleText = function (format, text) {
    return text;
  };
}

if (!util.parseEnv) {
  util.parseEnv = function (content) {
    const result = {};
    if (typeof content !== 'string') return result;
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const m = trimmed.match(/^([\w.-]+)\s*=\s*(.*)?$/);
      if (m) {
        let val = (m[2] || '').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        result[m[1]] = val;
      }
    }
    return result;
  };
}

// Intercept child_process spawning so Electron / DevTools child processes
// do not inherit NODE_OPTIONS (packaged Electron apps disallow NODE_OPTIONS in C++).
// Node.js processes keep NODE_OPTIONS so URL.parse & polyfills remain active.
const cp = require('child_process');
const sanitizeEnv = (env) => {
  if (!env) return env;
  const clone = { ...env };
  delete clone.NODE_OPTIONS;
  return clone;
};

const isDevToolsCmd = (cmd) => {
  const str = String(cmd);
  return (
    str.includes('DevTools') ||
    str.includes('devtools') ||
    str.includes('electron') ||
    str.includes('Electron')
  );
};

const origSpawn = cp.spawn;
cp.spawn = function (cmd, args, options) {
  if (isDevToolsCmd(cmd)) {
    if (options && options.env) {
      options.env = sanitizeEnv(options.env);
    } else if (options) {
      options.env = sanitizeEnv(process.env);
    }
  }
  return origSpawn.apply(this, arguments);
};

const origExec = cp.exec;
cp.exec = function (cmd, options, cb) {
  if (isDevToolsCmd(cmd)) {
    if (typeof options === 'object' && options !== null) {
      if (options.env) options.env = sanitizeEnv(options.env);
      else options.env = sanitizeEnv(process.env);
    }
  }
  return origExec.apply(this, arguments);
};


