# mdview

A **serverless, static, single-page markdown viewer**. Paste GitHub-Flavored Markdown on the
left, get a clean, GitHub-like rendered preview on the right — with a light/dark theme toggle and
fenced-code syntax highlighting. Everything runs in your browser; nothing is uploaded anywhere
(privacy by construction).

## Open it

It's a static file — no build, no server:

- Open `index.html` directly in a browser (`file://`), **or**
- serve the folder: `python -m http.server` then visit `http://localhost:8000/`.

## What it does (MVP-1)

- Paste / type markdown → **live** rendered preview.
- GitHub-Flavored Markdown: headings, nested & ordered lists, **tables**, fenced code with
  **syntax highlighting**, links, images, blockquotes, and **task lists**.
- Polished GitHub-like theme with a working **light / dark** toggle (remembers your choice).
- **CSP-clean and CDN-free**: every JS/CSS asset is vendored into the repo under `vendor/` and
  `assets/`. No network requests at runtime.
- **XSS-safe**: pasted `<script>` / `onerror` handlers are sanitized out (DOMPurify) — a viewer
  must never execute its input.

## Layout

```
index.html                 the app (split-pane: textarea + live preview + theme toggle)
render.js                  pure renderMarkdown(md) -> sanitized HTML — runs in browser AND Node
app.js                     browser bootstrap (wires textarea/preview/toggle; no inline JS)
vendor/                    marked.min.js, highlight.min.js, purify.min.js  (vendored, CDN-free)
assets/                    github-markdown-{light,dark}.css, hljs-github{,-dark}.css, app.css
test/render.test.mjs       real render test (asserts the rendered DOM, not just file-exists)
scripts/build_samples.mjs  renders demo docs to samples/*.html (QA aid)
samples/                   two rendered demos (README-scale + code-heavy) for eyeballing
```

## Test

The render test feeds a non-trivial GFM document through `renderMarkdown()` and asserts the output
DOM (an `<h1>`, a real `<table>`, a highlighted `<pre><code class="hljs">`, a task-list checkbox
`<input type="checkbox">`, a link, an image, a blockquote) plus XSS-safety (no surviving `<script>`
/ `onerror` / `javascript:`).

```
npm install      # dev deps for the headless test (marked, highlight.js, dompurify, jsdom)
npm test         # node test/render.test.mjs
```

The browser bundle itself needs **no** install — the libraries are vendored.

## Not in MVP-1 (later)

File upload / open `.md`, PDF export, saving, and hosted deploy (Cloudflare Pages). A Pages config
can be added later; nothing here talks to a network at runtime today.
