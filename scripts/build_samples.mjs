/*
 * build_samples.mjs — render two non-trivial GFM documents through the SAME renderMarkdown
 * pipeline the app uses, and emit self-contained HTML (vendored CSS inlined) so the output
 * quality can be eyeballed by opening the files directly. Not part of the app; a demo/QA aid.
 *
 *   node scripts/build_samples.mjs
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const { renderMarkdown } = require("../render.js");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function css(rel) { return readFileSync(join(root, rel), "utf8"); }
const mdLight = css("assets/github-markdown-light.css");
const mdDark = css("assets/github-markdown-dark.css");
const hlLight = css("assets/hljs-github.css");
const hlDark = css("assets/hljs-github-dark.css");

function page(title, theme, bodyHtml) {
  const isDark = theme === "dark";
  const bg = isDark ? "#0d1117" : "#ffffff";
  return `<!doctype html>
<html lang="en" data-theme="${theme}">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
${isDark ? mdDark : mdLight}
${isDark ? hlDark : hlLight}
html,body{margin:0;background:${bg};}
.markdown-body{background:transparent!important;max-width:860px;margin:0 auto;padding:32px 28px;}
</style>
</head>
<body>
<article class="markdown-body">
${bodyHtml}
</article>
</body>
</html>`;
}

const README = `# Acme Toolkit

[![build](https://img.shields.io/badge/build-passing-brightgreen)](#) [![license](https://img.shields.io/badge/license-MIT-blue)](#)

**Acme Toolkit** is a batteries-included CLI for wrangling data pipelines. It is fast,
scriptable, and has *zero* runtime dependencies.

> "It replaced three shell scripts and a cron job." — a happy user

## Features

- One-command installs
- Cross-platform (Linux, macOS, Windows)
- Pluggable via a simple hook API
- [x] Streaming mode
- [x] Resumable jobs
- [ ] Distributed mode (on the roadmap)

## Install

\`\`\`bash
# via the install script
curl -fsSL https://example.com/install.sh | sh

# or with npm
npm install -g acme-toolkit
\`\`\`

## Usage

| Command        | Description                    | Since |
| -------------- | ------------------------------ | :---: |
| \`acme run\`     | Execute a pipeline             |  1.0  |
| \`acme watch\`   | Re-run on file changes         |  1.2  |
| \`acme doctor\`  | Diagnose environment problems  |  1.4  |

A minimal pipeline config:

\`\`\`yaml
name: nightly
steps:
  - extract: { source: db, table: orders }
  - transform: { drop_nulls: true }
  - load: { dest: warehouse }
\`\`\`

## API

Register a hook in \`acme.config.js\`:

\`\`\`js
export default {
  hooks: {
    beforeRun(ctx) {
      ctx.log.info(\`starting \${ctx.pipeline.name}\`);
    },
  },
};
\`\`\`

## Contributing

1. Fork the repo
2. Create a feature branch
3. Open a pull request

See [CONTRIBUTING](https://example.com/contributing) for details. Questions? Reach us on
[the forum](https://example.com/forum).

---

Made with care. Licensed under **MIT**.
`;

const CODEHEAVY = `# Syntax Highlighting Showcase

A code-heavy document to exercise the fenced-code renderer across several languages.

## Python

\`\`\`python
from dataclasses import dataclass

@dataclass
class Point:
    x: float
    y: float

    def dist(self, other: "Point") -> float:
        return ((self.x - other.x) ** 2 + (self.y - other.y) ** 2) ** 0.5

print(Point(0, 0).dist(Point(3, 4)))  # 5.0
\`\`\`

## Rust

\`\`\`rust
fn main() {
    let nums = vec![1, 2, 3, 4, 5];
    let sum: i32 = nums.iter().filter(|&&n| n % 2 == 1).sum();
    println!("sum of odds = {sum}");
}
\`\`\`

## TypeScript

\`\`\`ts
interface User { id: number; name: string; admin?: boolean }

const admins = (users: User[]): string[] =>
  users.filter(u => u.admin).map(u => u.name);
\`\`\`

## SQL

\`\`\`sql
SELECT customer_id, COUNT(*) AS orders, SUM(total) AS revenue
FROM orders
WHERE created_at >= '2026-01-01'
GROUP BY customer_id
HAVING COUNT(*) > 5
ORDER BY revenue DESC;
\`\`\`

## Go

\`\`\`go
package main

import "fmt"

func main() {
    ch := make(chan int)
    go func() { ch <- 42 }()
    fmt.Println(<-ch)
}
\`\`\`

## Shell

\`\`\`bash
set -euo pipefail
for f in *.md; do
  echo "processing $f"
  wc -l "$f"
done
\`\`\`

Inline code like \`git rebase -i HEAD~3\` renders too, and a final note in a
> blockquote, to close things out.
`;

mkdirSync(join(root, "samples"), { recursive: true });
writeFileSync(join(root, "samples", "readme-scale.html"), page("Sample — README-scale (light)", "light", renderMarkdown(README)));
writeFileSync(join(root, "samples", "code-heavy.html"), page("Sample — code-heavy (dark)", "dark", renderMarkdown(CODEHEAVY)));
console.log("Wrote samples/readme-scale.html (light) and samples/code-heavy.html (dark)");
