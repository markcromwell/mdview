/*
 * render.js — the pure markdown render façade for mdview.
 *
 * Exposes a single pure function:  renderMarkdown(md) -> sanitized HTML string.
 *
 * Works in BOTH environments so the render is unit-testable headless:
 *   - Browser: loaded as a classic <script> after the vendored marked / highlight.js /
 *              DOMPurify globals; assigns globalThis.renderMarkdown.
 *   - Node:    require()'d by test/render.test.mjs; pulls marked / highlight.js / dompurify
 *              (+ jsdom to give DOMPurify a DOM) from node_modules.
 *
 * GitHub-Flavored Markdown (tables, task lists, autolinks, strikethrough) + fenced-code
 * syntax highlighting via highlight.js. Output is sanitized with DOMPurify so pasted
 * <script> / onerror handlers can never execute — a viewer must never run its input.
 */
(function (root, factory) {
  if (typeof module === "object" && typeof module.exports === "object") {
    // ---- Node / CommonJS ----
    const { Marked } = require("marked");
    const hljs = require("highlight.js");
    const createDOMPurify = require("dompurify");
    const { JSDOM } = require("jsdom");
    const DOMPurify = createDOMPurify(new JSDOM("").window);
    module.exports = factory(Marked, hljs, DOMPurify);
  } else {
    // ---- Browser ----
    const api = factory(root.marked.Marked, root.hljs, root.DOMPurify);
    root.renderMarkdown = api.renderMarkdown;
  }
})(typeof self !== "undefined" ? self : this, function (Marked, hljs, DOMPurify) {
  "use strict";

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // Custom fenced-code renderer: highlight.js on the code, tagged class="hljs" so the
  // vendored hljs theme styles it. Defensive about marked's renderer.code signature
  // (object token in newer marked, positional args in older).
  function renderCode(codeArg, infostring) {
    let code, lang;
    if (codeArg && typeof codeArg === "object") {
      code = codeArg.text;
      lang = codeArg.lang;
    } else {
      code = codeArg;
      lang = infostring;
    }
    lang = (lang || "").match(/\S*/)[0];
    let highlighted;
    try {
      if (lang && hljs.getLanguage(lang)) {
        highlighted = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
      } else {
        highlighted = hljs.highlightAuto(code).value;
      }
    } catch (e) {
      highlighted = escapeHtml(code);
    }
    const cls = lang ? " language-" + lang : "";
    return '<pre><code class="hljs' + cls + '">' + highlighted + "</code></pre>\n";
  }

  const marked = new Marked({ gfm: true, breaks: false });
  marked.use({ renderer: { code: renderCode } });

  function renderMarkdown(md) {
    const raw = marked.parse(md == null ? "" : String(md));
    // Sanitize: strip <script>, event-handler attributes, javascript: URLs, etc.
    // Keep the structural HTML a viewer needs (tables, task-list <input>, hljs spans).
    return DOMPurify.sanitize(raw, { ADD_ATTR: ["target", "rel"] });
  }

  return { renderMarkdown: renderMarkdown };
});
