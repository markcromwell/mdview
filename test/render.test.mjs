/*
 * render.test.mjs — a REAL render test for mdview (no framework).
 *
 * Feeds renderMarkdown() a non-trivial GitHub-Flavored Markdown document and asserts the
 * rendered HTML actually contains the DOM a markdown viewer must produce: a heading, a real
 * table, a syntax-highlighted fenced code block, a task-list checkbox, a link, an image, a
 * blockquote — and that a pasted <script> / onerror payload does NOT survive (XSS-safe).
 *
 * This is deliberately a behaviour test on the OUTPUT, not a lint or a file-exists check.
 * Run:  npm test    (or:  node test/render.test.mjs)     Exit 0 = all pass, non-zero = fail.
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { renderMarkdown } = require("../render.js");

const SAMPLE = `# Heading One

A paragraph with a [link](https://example.com) and an image ![alt text](https://example.com/pic.png).

> A blockquote with **bold** and _italic_.

| Feature | Supported |
| ------- | --------- |
| Tables  | yes       |
| Code    | yes       |

- [x] done task
- [ ] todo task

\`\`\`js
function greet(name) {
  return \`hello \${name}\`;
}
\`\`\`
`;

const XSS = `Hello <script>window.__pwned = 1;</script> world

![x](x "t") <img src=x onerror="window.__pwned=1">

[click](javascript:window.__pwned=1)
`;

let failures = 0;
function check(name, cond) {
  if (cond) {
    console.log("  PASS  " + name);
  } else {
    console.error("  FAIL  " + name);
    failures++;
  }
}

const html = renderMarkdown(SAMPLE);

check("renders an <h1> heading", /<h1[^>]*>\s*Heading One\s*<\/h1>/i.test(html));
check("renders a real <table> with <td>", /<table[\s>][\s\S]*<td[\s>]/i.test(html));
check("renders a fenced code block as <pre><code", /<pre><code[^>]*>/i.test(html));
check(
  "fenced code is syntax-highlighted (hljs token class present)",
  /class="hljs/i.test(html) && /class="hljs-\w+/i.test(html)
);
check(
  "renders a task-list checkbox <li> (input type=checkbox)",
  /<li[^>]*>[\s\S]*<input[^>]*type="checkbox"/i.test(html)
);
check("checked task renders as checked", /<input[^>]*checked[^>]*type="checkbox"|<input[^>]*type="checkbox"[^>]*checked/i.test(html));
check("renders an <a href> link", /<a[^>]*href="https:\/\/example\.com"/i.test(html));
check("renders an <img> with src", /<img[^>]*src="https:\/\/example\.com\/pic\.png"/i.test(html));
check("renders a <blockquote>", /<blockquote[\s>]/i.test(html));

const xssHtml = renderMarkdown(XSS);
check("XSS: no <script> tag survives", !/<script/i.test(xssHtml));
check("XSS: no onerror handler survives", !/onerror/i.test(xssHtml));
check("XSS: no javascript: URL survives", !/javascript:/i.test(xssHtml));

console.log("");
if (failures === 0) {
  console.log("All render assertions passed.");
  process.exit(0);
} else {
  console.error(failures + " render assertion(s) FAILED.");
  process.exit(1);
}
