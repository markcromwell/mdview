#!/usr/bin/env node
// Discover and run every unit test under test/.
//
// Why (COUNCIL #293915 / audit #237 hollow-green class):
//   package.json "test" and programs.test_cmd_unit were pinned to ONE file
//   (node test/render.test.mjs). Any new test/<name>.test.mjs a worker adds
//   never ran, while the phase stayed GREEN on the pre-existing 14 cases.
//
// Runner mechanics (verified before choosing this approach):
//   - test/render.test.mjs is hand-rolled (no node:test / no framework).
//     It prints "  PASS  <name>" / "  FAIL  <name>" and exits 0/1.
//   - forge_wrap_junit.py parses those PASS/FAIL lines into junit cases.
//     Silent exit 0 -> empty suite (hollow gate BLOCKS). It never fabricates
//     a green from exit code alone.
//   - Therefore we MUST NOT switch to `node --test test/` (different reporter;
//     would risk empty-suite PASS or drop PASS/FAIL lines the wrapper needs).
//   - This runner walks test/ for *.test.mjs|*.test.js, runs each with node,
//     streams stdout/stderr so forge_wrap_junit still sees every PASS/FAIL
//     line, and exits non-zero if any file fails.
//
// Keep package.json "test" and programs.test_cmd_unit pointing at THIS script
// so the two sources of truth cannot drift.
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEST_ROOT = path.join(ROOT, "test");

function walkTestFiles(dir) {
  /** @type {string[]} */
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    console.error(`run_unit_tests: cannot read ${dir}: ${err}`);
    process.exit(1);
  }
  for (const ent of entries) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...walkTestFiles(p));
    } else if (/\.test\.m?js$/i.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}

const files = walkTestFiles(TEST_ROOT).sort();
if (files.length === 0) {
  console.error("run_unit_tests: no test/**/*.test.mjs (or .test.js) files found");
  process.exit(1);
}

console.log(`run_unit_tests: discovering ${files.length} file(s) under test/`);
let failedFiles = 0;
for (const f of files) {
  const rel = path.relative(ROOT, f).replace(/\\/g, "/");
  console.log(`\n== ${rel} ==`);
  const r = spawnSync(process.execPath, [f], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.error) {
    console.error(`spawn error for ${rel}: ${r.error}`);
    failedFiles += 1;
    continue;
  }
  if ((r.status ?? 1) !== 0) {
    failedFiles += 1;
  }
}

if (failedFiles > 0) {
  console.error(`\n${failedFiles}/${files.length} test file(s) FAILED.`);
  process.exit(1);
}
console.log(`\nAll ${files.length} test file(s) passed.`);
process.exit(0);
