/* app.js — browser bootstrap for mdview (no inline script → CSP-clean).
   Wires the textarea to a live rendered preview and drives the light/dark theme toggle.
   The actual markdown->HTML is done by globalThis.renderMarkdown (render.js). */
(function () {
  "use strict";

  var input = document.getElementById("input");
  var preview = document.getElementById("preview");
  var toggle = document.getElementById("theme-toggle");
  var mdTheme = document.getElementById("md-theme");
  var hlTheme = document.getElementById("hl-theme");
  var toggleLabel = document.getElementById("theme-label");

  var THEMES = {
    light: { md: "assets/github-markdown-light.css", hl: "assets/hljs-github.css", label: "Dark", icon: "☾" },
    dark:  { md: "assets/github-markdown-dark.css",  hl: "assets/hljs-github-dark.css", label: "Light", icon: "☀" }
  };

  function applyTheme(name) {
    var t = THEMES[name] || THEMES.light;
    document.documentElement.setAttribute("data-theme", name);
    mdTheme.setAttribute("href", t.md);
    hlTheme.setAttribute("href", t.hl);
    if (toggleLabel) toggleLabel.textContent = t.label;
    var iconEl = document.getElementById("theme-icon");
    if (iconEl) iconEl.textContent = t.icon;
    try { localStorage.setItem("mdview-theme", name); } catch (e) {}
  }

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function render() {
    preview.innerHTML = globalThis.renderMarkdown(input.value);
  }

  // initial theme: saved preference, else OS preference
  var saved = null;
  try { saved = localStorage.getItem("mdview-theme"); } catch (e) {}
  if (!saved) {
    saved = (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  }
  applyTheme(saved);

  toggle.addEventListener("click", function () {
    applyTheme(currentTheme() === "dark" ? "light" : "dark");
  });

  input.addEventListener("input", render);
  render();
})();
