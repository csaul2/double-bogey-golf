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

// Clean up NODE_OPTIONS so child processes (like Electron React Native DevTools)
// don't inherit --require ./node-compat.js and crash.
delete process.env.NODE_OPTIONS;


