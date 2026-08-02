/*
 * no_egress.test.mjs — mdview must not attempt outbound requests while opening files.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AUDITED_FILES = ["app.js", "fileio.js"];
const BANNED = [
  ["fetch(", /fetch\s*\(/],
  ["XMLHttpRequest", /\bXMLHttpRequest\b/],
  ["sendBeacon", /\bsendBeacon\b/],
  ["WebSocket", /\bWebSocket\b/],
  ["EventSource", /\bEventSource\b/],
  ["https://", /https:\/\//]
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

const result = spawnSync(process.execPath, [path.join(ROOT, "scripts", "check_no_egress.mjs")], {
  cwd: ROOT,
  encoding: "utf8"
});

let ledger = null;
try {
  ledger = JSON.parse(result.stdout);
} catch (err) {
  ledger = null;
}

if (result.stderr) {
  process.stderr.write(result.stderr);
}

check("check_no_egress exits zero", result.status === 0);
check("check_no_egress prints a HAR-shaped ledger", Array.isArray(ledger?.log?.entries));
check("HAR-shaped ledger has zero entries", ledger?.log?.entries?.length === 0);

for (const file of AUDITED_FILES) {
  const source = readFileSync(path.join(ROOT, file), "utf8");
  for (const [label, pattern] of BANNED) {
    check(`${file} does not contain ${label}`, !pattern.test(source));
  }
}

console.log("");
if (failures === 0) {
  console.log("All no-egress assertions passed.");
  process.exit(0);
} else {
  console.error(failures + " no-egress assertion(s) FAILED.");
  process.exit(1);
}
