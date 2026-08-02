#!/usr/bin/env node
/*
 * Boot mdview in jsdom, replace outbound browser surfaces with recording stubs,
 * exercise file-open flows, and print a HAR-shaped ledger of attempted egress.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM, ResourceLoader } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT_ORDER = [
  "vendor/marked.min.js",
  "vendor/highlight.min.js",
  "vendor/purify.min.js",
  "render.js",
  "fileio.js",
  "app.js"
];

const ledger = { log: { entries: [] } };

function urlOf(value) {
  if (value && typeof value === "object" && typeof value.url === "string") {
    return value.url;
  }
  return String(value == null ? "" : value);
}

function isExternal(url) {
  return /^(https?:|wss?:)/i.test(url);
}

function record(surface, url, options = {}) {
  const requestUrl = urlOf(url);
  if (!isExternal(requestUrl)) {
    return;
  }
  ledger.log.entries.push({
    startedDateTime: new Date().toISOString(),
    time: 0,
    request: {
      method: options.method || "GET",
      url: requestUrl,
      httpVersion: "HTTP/1.1",
      headers: [],
      queryString: [],
      cookies: [],
      headersSize: -1,
      bodySize: options.body == null ? 0 : String(options.body).length
    },
    response: {
      status: 0,
      statusText: "blocked",
      httpVersion: "HTTP/1.1",
      headers: [],
      cookies: [],
      content: { size: 0, mimeType: "text/plain" },
      redirectURL: "",
      headersSize: -1,
      bodySize: 0
    },
    cache: {},
    timings: { send: 0, wait: 0, receive: 0 },
    _surface: surface
  });
}

class RecordingResourceLoader extends ResourceLoader {
  fetch(url, options) {
    record("resource", url, { method: options?.method || "GET" });
    return null;
  }
}

function installEgressStubs(window) {
  window.fetch = function (input, init = {}) {
    record("window.fetch", input, {
      method: init.method || "GET",
      body: init.body
    });
    return Promise.reject(new Error("egress blocked"));
  };

  window.XMLHttpRequest = class RecordingXHR {
    open(method, url) {
      this._method = method || "GET";
      this._url = url;
    }
    setRequestHeader() {}
    send(body) {
      record("XMLHttpRequest", this._url, {
        method: this._method || "GET",
        body
      });
      if (typeof this.onerror === "function") {
        this.onerror(new window.Event("error"));
      }
    }
    abort() {}
  };

  Object.defineProperty(window.navigator, "sendBeacon", {
    configurable: true,
    value(url, data) {
      record("navigator.sendBeacon", url, {
        method: "POST",
        body: data
      });
      return false;
    }
  });

  window.WebSocket = function RecordingWebSocket(url) {
    record("WebSocket", url);
    throw new Error("egress blocked");
  };

  window.EventSource = function RecordingEventSource(url) {
    record("EventSource", url);
    throw new Error("egress blocked");
  };

  window.Image = class RecordingImage {
    constructor() {
      this._src = "";
    }
    get src() {
      return this._src;
    }
    set src(value) {
      this._src = String(value);
      record("Image", value);
    }
  };

  window.HTMLFormElement.prototype.submit = function () {
    record("form.submit", this.action, {
      method: (this.method || "GET").toUpperCase()
    });
  };

  window.HTMLFormElement.prototype.requestSubmit = function () {
    record("form.requestSubmit", this.action, {
      method: (this.method || "GET").toUpperCase()
    });
  };
}

function installAutoReader(window) {
  class AutoReader {
    constructor() {
      this.result = null;
      this.error = null;
      this.aborted = false;
    }

    readAsArrayBuffer(file) {
      this.file = file;
      queueMicrotask(() => {
        if (this.aborted) {
          return;
        }
        if (file._abort) {
          this.abort();
          return;
        }
        if (file._error) {
          this.error = new Error("forced read failure");
          if (typeof this.onerror === "function") {
            this.onerror({ target: this });
          }
          return;
        }
        this.result = file._buffer;
        if (typeof this.onload === "function") {
          this.onload({ target: this });
        }
      });
    }

    abort() {
      this.aborted = true;
      if (typeof this.onabort === "function") {
        this.onabort({ target: this });
      }
    }
  }
  window.FileReader = AutoReader;
}

function makeFile(name, body, extras = {}) {
  const bodyBytes = body instanceof Uint8Array ? body : new TextEncoder().encode(String(body));
  return {
    name,
    size: extras.size ?? bodyBytes.byteLength,
    _buffer: bodyBytes.buffer.slice(bodyBytes.byteOffset, bodyBytes.byteOffset + bodyBytes.byteLength),
    _error: extras.error === true,
    _abort: extras.abort === true
  };
}

function boot() {
  const dom = new JSDOM(readFileSync(path.join(ROOT, "index.html"), "utf8"), {
    runScripts: "outside-only",
    resources: new RecordingResourceLoader(),
    url: pathToFileURL(path.join(ROOT, "index.html")).href,
    pretendToBeVisual: true
  });
  dom.window.TextDecoder = TextDecoder;
  dom.window.TextEncoder = TextEncoder;
  installEgressStubs(dom.window);
  installAutoReader(dom.window);
  for (const file of SCRIPT_ORDER) {
    dom.window.eval(readFileSync(path.join(ROOT, file), "utf8"));
  }
  return dom;
}

function dispatchPicker(window, file) {
  const input = window.document.getElementById("file-input");
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [file]
  });
  input.dispatchEvent(new window.Event("change", { bubbles: true }));
}

function dispatchDrop(window, file) {
  const event = new window.Event("drop", {
    bubbles: true,
    cancelable: true
  });
  Object.defineProperty(event, "dataTransfer", {
    value: { files: [file], dropEffect: "" }
  });
  window.document.getElementById("drop-zone").dispatchEvent(event);
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

const dom = boot();
dispatchPicker(dom.window, makeFile("picker.md", "# Picker"));
await flush();
dispatchDrop(dom.window, makeFile("drop.md", "# Drop"));
await flush();
dispatchPicker(dom.window, makeFile("huge.md", "", { size: 3 * 1024 * 1024 }));
await flush();
dispatchPicker(dom.window, makeFile("empty.md", "", { size: 0 }));
await flush();
dispatchPicker(dom.window, makeFile("decode.md", new Uint8Array([0xff, 0xfe, 0xfd])));
await flush();
dispatchPicker(dom.window, makeFile("error.md", "x", { error: true }));
await flush();
dispatchPicker(dom.window, makeFile("abort.md", "x", { abort: true }));
await flush();

console.log(JSON.stringify(ledger, null, 2));
process.exit(ledger.log.entries.length === 0 ? 0 : 1);
