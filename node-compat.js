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
