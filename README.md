# mdview

A **serverless, static, single-page markdown viewer**. Paste GitHub-Flavored Markdown on the
left or open a local `.md` file, get a clean, GitHub-like rendered preview on the right — with a
light/dark theme toggle and fenced-code syntax highlighting. Everything runs in your browser;
nothing is uploaded anywhere (privacy by construction).

## Open it

It's a static file — no build, no server:

- Open `index.html` directly in a browser (`file://`).
- The page loads only local files from this repository.

## What it does (MVP-1)

- Paste / type markdown → **live** rendered preview.
- Open a local `.md` / `.markdown` file with the picker or by dropping it onto the app.
- File open is capped at **2 MiB**. Oversized files are refused visibly instead of truncated.
- File reads use strict UTF-8 decoding, so invalid byte sequences produce a visible preview
  message instead of replacement characters.
- GitHub-Flavored Markdown: headings, nested & ordered lists, **tables**, fenced code with
  **syntax highlighting**, links, images, blockquotes, and **task lists**.
- Polished GitHub-like theme with a working **light / dark** toggle (remembers your choice).
- **CSP-clean and CDN-free**: every JS/CSS asset is vendored into the repo under `vendor/` and
  `assets/`. No remote script or stylesheet is loaded at runtime.
- **Zero-egress file open**: `scripts/check_no_egress.mjs` boots the app in jsdom with outbound
  browser APIs replaced by recording stubs and asserts the HAR-shaped ledger stays empty.
- **XSS-safe**: pasted `<script>` / `onerror` handlers are sanitized out (DOMPurify) — a viewer
  must never execute its input.

## Layout

```
index.html                 the app (split-pane: textarea + file picker/drop zone + preview)
render.js                  pure renderMarkdown(md) -> sanitized HTML — runs in browser AND Node
fileio.js                  pure file-open helpers and generation-token loader — browser AND Node
app.js                     browser bootstrap (wires textarea/preview/toggle/file open; no inline JS)
vendor/                    marked.min.js, highlight.min.js, purify.min.js  (vendored, CDN-free)
assets/                    github-markdown-{light,dark}.css, hljs-github{,-dark}.css, app.css
scripts/check_no_egress.mjs HAR-shaped zero-egress file-open harness
test/*.test.mjs            hand-rolled PASS/FAIL unit tests discovered by npm test
```

## Test

The tests cover rendering, file-open markup, strict file I/O behavior, app wiring, and the
zero-egress harness. The render test feeds a non-trivial GFM document through `renderMarkdown()`
and asserts the output DOM (an `<h1>`, a real `<table>`, a highlighted
`<pre><code class="hljs">`, a task-list checkbox `<input type="checkbox">`, a link, an image, a
blockquote) plus XSS-safety (no surviving `<script>` / `onerror` / `javascript:`).

```
npm ci
npm test
node scripts/check_no_egress.mjs
```

The browser bundle itself needs no install. The Node test uses the committed browser builds and
`jsdom` only to provide DOMPurify with a DOM.

## Not in MVP-1 (later)

PDF export, saving, and hosted deploy (Cloudflare Pages). A Pages config can be added later; file
open stays local either way.
