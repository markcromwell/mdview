/*
 * fileio.js — pure file-open helpers for mdview.
 *
 * Exposes mdviewFileIO in the browser and CommonJS exports in Node, matching the
 * dual-environment shape used by render.js.
 */
(function (root, factory) {
  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = factory(typeof globalThis !== "undefined" ? globalThis : root);
  } else {
    root.mdviewFileIO = factory(root);
  }
})(typeof self !== "undefined" ? self : this, function (root) {
  "use strict";

  var MAX_FILE_BYTES = 2 * 1024 * 1024;
  var FALLBACK_FILENAME = "document.md";
  var MAX_FILENAME_CHARS = 128;

  function preserveExtensionCap(name) {
    if (name.length <= MAX_FILENAME_CHARS) {
      return name;
    }

    var dot = name.lastIndexOf(".");
    var ext = dot > 0 && dot < name.length - 1 ? name.slice(dot) : "";
    if (ext.length >= MAX_FILENAME_CHARS) {
      return name.slice(0, MAX_FILENAME_CHARS);
    }

    return name.slice(0, MAX_FILENAME_CHARS - ext.length) + ext;
  }

  function sanitizeFilename(name) {
    var raw = name == null ? "" : String(name);
    var base = raw.replace(/^.*[\\/]/, "");
    base = base
      .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!base || base === "." || base === "..") {
      base = FALLBACK_FILENAME;
    }

    return preserveExtensionCap(base);
  }

  function decodeUtf8(arrayBuffer) {
    var Decoder = root && root.TextDecoder ? root.TextDecoder : TextDecoder;
    return new Decoder("utf-8", { fatal: true }).decode(arrayBuffer);
  }

  function classify(file) {
    var size = file && typeof file.size === "number" ? file.size : 0;
    if (size > MAX_FILE_BYTES) {
      return { ok: false, reason: "too-large" };
    }
    if (size === 0) {
      return { ok: false, reason: "empty" };
    }
    return { ok: true };
  }

  function messageFor(reason, detail) {
    if (reason === "too-large") {
      return "That file is over the 2 MiB limit. Choose a smaller markdown file.";
    }
    if (reason === "empty") {
      return "That markdown file is empty.";
    }
    if (reason === "decode") {
      return "That file is not valid UTF-8 markdown.";
    }
    if (reason === "read-error") {
      return "The file could not be read." + (detail ? " " + String(detail) : "");
    }
    if (reason === "aborted") {
      return "File reading was cancelled before it finished.";
    }
    return "The file could not be opened.";
  }

  function constructReader(read) {
    var Reader = read || (root && root.FileReader);
    if (typeof Reader !== "function") {
      throw new Error("FileReader is unavailable");
    }
    if (Reader.prototype && typeof Reader.prototype.readAsArrayBuffer === "function") {
      return new Reader();
    }
    return Reader();
  }

  function createFileLoader(options) {
    options = options || {};
    var read = options.read;
    var onSuccess = typeof options.onSuccess === "function" ? options.onSuccess : function () {};
    var onError = typeof options.onError === "function" ? options.onError : function () {};
    var generation = 0;
    var activeReader = null;

    function completeSuccess(token, payload) {
      if (token !== generation) {
        return;
      }
      activeReader = null;
      onSuccess(payload);
    }

    function completeError(token, reason, detail) {
      if (token !== generation) {
        return;
      }
      activeReader = null;
      onError(reason, detail);
    }

    function load(file) {
      var token = ++generation;
      var previous = activeReader;
      activeReader = null;
      if (previous && typeof previous.abort === "function") {
        previous.abort();
      }

      var classified = classify(file);
      if (!classified.ok) {
        completeError(token, classified.reason);
        return;
      }

      var reader;
      try {
        reader = constructReader(read);
      } catch (err) {
        completeError(token, "read-error", err && err.message);
        return;
      }

      activeReader = reader;
      reader.onload = function () {
        if (token !== generation) {
          return;
        }
        var text;
        try {
          text = decodeUtf8(reader.result);
        } catch (err) {
          completeError(token, "decode", err && err.message);
          return;
        }
        if (text.length === 0) {
          completeError(token, "empty");
          return;
        }
        completeSuccess(token, {
          text: text,
          filename: sanitizeFilename(file && file.name)
        });
      };
      reader.onerror = function () {
        completeError(token, "read-error", reader.error && reader.error.message);
      };
      reader.onabort = function () {
        completeError(token, "aborted");
      };

      try {
        reader.readAsArrayBuffer(file);
      } catch (err) {
        completeError(token, "read-error", err && err.message);
      }
    }

    function abort() {
      var reader = activeReader;
      if (reader && typeof reader.abort === "function") {
        reader.abort();
      }
    }

    return {
      load: load,
      abort: abort
    };
  }

  return {
    MAX_FILE_BYTES: MAX_FILE_BYTES,
    sanitizeFilename: sanitizeFilename,
    decodeUtf8: decodeUtf8,
    classify: classify,
    messageFor: messageFor,
    createFileLoader: createFileLoader
  };
});
