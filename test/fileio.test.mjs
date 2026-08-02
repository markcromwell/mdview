/*
 * fileio.test.mjs — pure file-open behavior checks for mdview.
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  MAX_FILE_BYTES,
  sanitizeFilename,
  decodeUtf8,
  classify,
  messageFor,
  createFileLoader
} = require("../fileio.js");

let failures = 0;
function check(name, cond) {
  if (cond) {
    console.log("  PASS  " + name);
  } else {
    console.error("  FAIL  " + name);
    failures++;
  }
}

function bytes(text) {
  return new TextEncoder().encode(text).buffer;
}

function file(name, body, extras = {}) {
  const bodyBytes = body instanceof Uint8Array ? body : new TextEncoder().encode(String(body));
  return {
    name,
    size: extras.size ?? bodyBytes.byteLength,
    _buffer: bodyBytes.buffer.slice(bodyBytes.byteOffset, bodyBytes.byteOffset + bodyBytes.byteLength),
    _error: extras.error === true
  };
}

function makeManualReader() {
  class ManualReader {
    constructor() {
      this.result = null;
      this.error = null;
      this.aborted = false;
      ManualReader.instances.push(this);
    }

    readAsArrayBuffer(nextFile) {
      this.file = nextFile;
    }

    abort() {
      this.aborted = true;
      if (typeof this.onabort === "function") {
        this.onabort({ target: this });
      }
    }

    resolve(buffer = this.file._buffer) {
      this.result = buffer;
      if (typeof this.onload === "function") {
        this.onload({ target: this });
      }
    }

    fail(message = "read failed") {
      this.error = new Error(message);
      if (typeof this.onerror === "function") {
        this.onerror({ target: this });
      }
    }
  }
  ManualReader.instances = [];
  return ManualReader;
}

check("exports MAX_FILE_BYTES", MAX_FILE_BYTES === 2097152);
check("exports sanitizeFilename", typeof sanitizeFilename === "function");
check("exports decodeUtf8", typeof decodeUtf8 === "function");
check("exports classify", typeof classify === "function");
check("exports messageFor", typeof messageFor === "function");
check("exports createFileLoader", typeof createFileLoader === "function");

check("strips POSIX paths", sanitizeFilename("../../etc/passwd") === "passwd");
check("strips Windows paths", sanitizeFilename("C:\\tmp\\a.md") === "a.md");
check("strips nested paths", sanitizeFilename("a/b/c.md") === "c.md");
const controlled = sanitizeFilename("bad\u0000\u001b\u007fname.md");
check("removes control characters", controlled === "badname.md");
check("falls back for empty names", sanitizeFilename("\u0000") === "document.md");
check("falls back for dot names", sanitizeFilename("..") === "document.md");
const longName = "a".repeat(180) + ".md";
const capped = sanitizeFilename(longName);
check("caps long names to 128 chars", capped.length <= 128);
check("preserves extension while capping", capped.endsWith(".md"));

check("decodeUtf8 round-trips valid multibyte text", decodeUtf8(bytes("hello π 世界")) === "hello π 世界");
let invalidThrew = false;
try {
  decodeUtf8(new Uint8Array([0xff, 0xfe, 0xfd]).buffer);
} catch (err) {
  invalidThrew = true;
}
check("decodeUtf8 throws on invalid UTF-8", invalidThrew);

check("classify rejects size 2097153", classify({ size: MAX_FILE_BYTES + 1 }).reason === "too-large");
check("classify accepts size 2097152", classify({ size: MAX_FILE_BYTES }).ok === true);
check("classify rejects empty files", classify({ size: 0 }).reason === "empty");
const messages = ["too-large", "empty", "decode", "read-error", "aborted"].map((reason) => messageFor(reason));
check("messageFor returns non-empty messages", messages.every((msg) => typeof msg === "string" && msg.length > 0));
check("messageFor messages are distinct", new Set(messages).size === messages.length);

{
  const Reader = makeManualReader();
  const callbacks = [];
  const loader = createFileLoader({
    read: Reader,
    onSuccess: (payload) => callbacks.push(["success", payload]),
    onError: (reason) => callbacks.push(["error", reason])
  });
  loader.load(file("first.md", "# First"));
  loader.load(file("second.md", "# Second"));
  Reader.instances[1].resolve();
  Reader.instances[0].resolve();
  check("superseding aborts the prior reader", Reader.instances[0].aborted === true);
  check("two rapid loads produce one callback", callbacks.length === 1);
  check("last load wins with second content", callbacks[0]?.[0] === "success" && callbacks[0][1].text === "# Second");
}

{
  const Reader = makeManualReader();
  const callbacks = [];
  const loader = createFileLoader({
    read: Reader,
    onSuccess: (payload) => callbacks.push(["success", payload.text]),
    onError: (reason) => callbacks.push(["error", reason])
  });
  loader.load(file("stale.md", "# Stale"));
  loader.load(file("fresh.md", "# Fresh"));
  Reader.instances[0].resolve();
  Reader.instances[1].resolve();
  check("out-of-order stale success is dropped", callbacks.length === 1 && callbacks[0][1] === "# Fresh");
}

{
  const Reader = makeManualReader();
  const callbacks = [];
  const loader = createFileLoader({
    read: Reader,
    onSuccess: () => callbacks.push(["success"]),
    onError: (reason) => callbacks.push(["error", reason])
  });
  loader.load(file("cancel.md", "# Cancel"));
  Reader.instances[0].abort();
  check("genuine reader abort surfaces aborted", callbacks.length === 1 && callbacks[0][1] === "aborted");
}

{
  let constructed = 0;
  class CountingReader {
    constructor() {
      constructed += 1;
    }
    readAsArrayBuffer() {}
  }
  const callbacks = [];
  const loader = createFileLoader({
    read: CountingReader,
    onError: (reason) => callbacks.push(reason)
  });
  loader.load({ name: "big.md", size: MAX_FILE_BYTES + 1 });
  check("oversize reports too-large", callbacks[0] === "too-large");
  check("oversize does not construct a reader", constructed === 0);
}

{
  const Reader = makeManualReader();
  const callbacks = [];
  const loader = createFileLoader({
    read: Reader,
    onSuccess: (payload) => callbacks.push(["success", payload]),
    onError: (reason) => callbacks.push(["error", reason])
  });
  loader.load(file("empty-after-decode.md", "x"));
  Reader.instances[0].resolve(new Uint8Array([]).buffer);
  loader.load(file("invalid.md", new Uint8Array([0xff, 0xfe, 0xfd])));
  Reader.instances[1].resolve();
  loader.load(file("boom.md", "x"));
  Reader.instances[2].fail();
  check(
    "empty, invalid UTF-8, and reader error map distinctly",
    callbacks.map((entry) => entry[1]).join(",") === "empty,decode,read-error"
  );
}

{
  const Reader = makeManualReader();
  const callbacks = [];
  const loader = createFileLoader({
    read: Reader,
    onSuccess: (payload) => callbacks.push(payload),
    onError: () => {}
  });
  loader.load(file("../../weird\u0001name.md", "# Safe"));
  Reader.instances[0].resolve();
  check("success payload filename is sanitized", callbacks[0]?.filename === "weirdname.md");
}

console.log("");
if (failures === 0) {
  console.log("All fileio assertions passed.");
  process.exit(0);
} else {
  console.error(failures + " fileio assertion(s) FAILED.");
  process.exit(1);
}
