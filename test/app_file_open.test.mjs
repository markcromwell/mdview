/*
 * app_file_open.test.mjs — browser wiring checks for mdview file open.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT_ORDER = [
  "vendor/marked.min.js",
  "vendor/highlight.min.js",
  "vendor/purify.min.js",
  "render.js",
  "fileio.js",
  "app.js"
];

let failures = 0;
function check(name, cond) {
  if (cond) {
    console.log("  PASS  " + name);
  } else {
    console.error("  FAIL  " + name);
    failures++;
  }
}

function encode(text) {
  return new TextEncoder().encode(text);
}

function makeFile(name, body, extras = {}) {
  const bodyBytes = body instanceof Uint8Array ? body : encode(String(body));
  return {
    name,
    size: extras.size ?? bodyBytes.byteLength,
    _buffer: bodyBytes.buffer.slice(bodyBytes.byteOffset, bodyBytes.byteOffset + bodyBytes.byteLength),
    _error: extras.error === true,
    _abort: extras.abort === true
  };
}

function installAutoReader(window) {
  class AutoReader {
    constructor() {
      this.result = null;
      this.error = null;
      this.aborted = false;
      AutoReader.instances.push(this);
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
  AutoReader.instances = [];
  window.FileReader = AutoReader;
  return AutoReader;
}

function boot() {
  const dom = new JSDOM(readFileSync(path.join(ROOT, "index.html"), "utf8"), {
    runScripts: "outside-only",
    url: pathToFileURL(path.join(ROOT, "index.html")).href,
    pretendToBeVisual: true
  });
  dom.window.TextDecoder = TextDecoder;
  dom.window.TextEncoder = TextEncoder;
  installAutoReader(dom.window);
  for (const file of SCRIPT_ORDER) {
    dom.window.eval(readFileSync(path.join(ROOT, file), "utf8"));
  }
  return dom;
}

function setPickerFiles(window, files) {
  Object.defineProperty(window.document.getElementById("file-input"), "files", {
    configurable: true,
    value: files
  });
}

function dispatchPicker(window, file) {
  setPickerFiles(window, [file]);
  window.document.getElementById("file-input").dispatchEvent(new window.Event("change", {
    bubbles: true
  }));
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
  return event;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

function headingText(window) {
  return window.document.querySelector("#preview h1")?.textContent.trim();
}

function visibleMessage(window) {
  const el = window.document.getElementById("preview-message");
  return !el.hidden && el.textContent.trim().length > 0 ? el.textContent.trim() : "";
}

{
  const dom = boot();
  dispatchPicker(dom.window, makeFile("picked.md", "# Picked\n\nfrom picker"));
  await flush();
  check("picker renders a valid .md heading", headingText(dom.window) === "Picked");
  check("picker hides file messages on success", dom.window.document.getElementById("preview-message").hidden);
}

{
  const dom = boot();
  const dropEvent = dispatchDrop(dom.window, makeFile("dropped.md", "# Dropped\n\nfrom drop"));
  await flush();
  check("drop renders a valid .md heading", headingText(dom.window) === "Dropped");
  check("drop event is cancelled for browser open prevention", dropEvent.defaultPrevented);
}

{
  const dom = boot();
  const before = dom.window.document.getElementById("preview").textContent.trim();
  dispatchPicker(dom.window, makeFile("huge.md", "", { size: 3 * 1024 * 1024 }));
  await flush();
  const banner = dom.window.document.getElementById("error-banner");
  const after = dom.window.document.getElementById("preview").textContent.trim();
  check("oversize file shows visible error banner", !banner.hidden && banner.textContent.includes("2 MiB"));
  check("oversize file does not blank previous preview", before.length > 0 && after.length > 0);
}

{
  const dom = boot();
  dispatchPicker(dom.window, makeFile("empty.md", "", { size: 0 }));
  await flush();
  const empty = visibleMessage(dom.window);
  dispatchPicker(dom.window, makeFile("bad.md", new Uint8Array([0xff, 0xfe, 0xfd])));
  await flush();
  const decode = visibleMessage(dom.window);
  dispatchPicker(dom.window, makeFile("boom.md", "x", { error: true }));
  await flush();
  const readError = visibleMessage(dom.window);
  dispatchPicker(dom.window, makeFile("cancel.md", "x", { abort: true }));
  await flush();
  const aborted = visibleMessage(dom.window);
  check("empty file leaves visible preview message", empty.length > 0);
  check("invalid UTF-8 leaves visible preview message", decode.length > 0);
  check("reader error leaves visible preview message", readError.length > 0);
  check("reader abort leaves visible preview message", aborted.length > 0);
  check("file failure messages are distinct", new Set([empty, decode, readError, aborted]).size === 4);
}

{
  const dom = boot();
  let renderCalls = 0;
  const originalRender = dom.window.renderMarkdown;
  dom.window.renderMarkdown = function (md) {
    renderCalls += 1;
    return originalRender(md);
  };
  dispatchDrop(dom.window, makeFile("first.md", "# First"));
  dispatchDrop(dom.window, makeFile("second.md", "# Second"));
  await flush();
  check("two same-tick drops produce one final render", renderCalls === 1);
  check("two same-tick drops render the second file", headingText(dom.window) === "Second");
}

{
  const dom = boot();
  dispatchPicker(dom.window, makeFile("../../weird\u0001name.md", "# Titled"));
  await flush();
  const holderText = dom.window.document.getElementById("doc-title").textContent;
  check("document title uses sanitized basename", dom.window.document.title === "weirdname.md — mdview");
  check("print title holder uses sanitized basename", holderText === "weirdname.md");
  check("sanitized title has no separators or controls", !/[\\/\u0000-\u001f\u007f-\u009f]/.test(holderText));
}

console.log("");
if (failures === 0) {
  console.log("All app file-open assertions passed.");
  process.exit(0);
} else {
  console.error(failures + " app file-open assertion(s) FAILED.");
  process.exit(1);
}
