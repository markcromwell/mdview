/* app.js — browser bootstrap for mdview (no inline script → CSP-clean).
   Wires the textarea to a live rendered preview and drives the light/dark theme toggle.
   The actual markdown->HTML is done by globalThis.renderMarkdown (render.js). */
(function () {
  "use strict";

  if (globalThis.__mdviewController) {
    globalThis.__mdviewController.abort();
  }
  var controller = new AbortController();
  globalThis.__mdviewController = controller;

  var input = document.getElementById("input");
  var preview = document.getElementById("preview");
  var toggle = document.getElementById("theme-toggle");
  var mdTheme = document.getElementById("md-theme");
  var hlTheme = document.getElementById("hl-theme");
  var toggleLabel = document.getElementById("theme-label");
  var toggleIcon = document.getElementById("theme-icon");
  var fileInput = document.getElementById("file-input");
  var dropZone = document.getElementById("drop-zone");
  var errorBanner = document.getElementById("error-banner");
  var previewMessage = document.getElementById("preview-message");
  var docTitle = document.getElementById("doc-title");
  var fileIO = globalThis.mdviewFileIO;
  var renderTimer = 0;
  var renderGeneration = 0;

  var THEMES = {
    light: { md: "./assets/github-markdown-light.css", hl: "./assets/hljs-github.css", label: "Dark", icon: "☾" },
    dark:  { md: "./assets/github-markdown-dark.css",  hl: "./assets/hljs-github-dark.css", label: "Light", icon: "☀" }
  };

  function applyTheme(name) {
    var t = THEMES[name] || THEMES.light;
    document.documentElement.setAttribute("data-theme", name);
    mdTheme.setAttribute("href", t.md);
    hlTheme.setAttribute("href", t.hl);
    if (toggleLabel) toggleLabel.textContent = t.label;
    if (toggleIcon) toggleIcon.textContent = t.icon;
    try { localStorage.setItem("mdview-theme", name); } catch (e) {}
  }

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  }

  function renderToken(token) {
    var html = globalThis.renderMarkdown(input.value);
    if (token === renderGeneration) {
      preview.innerHTML = html;
    }
  }

  function renderNow() {
    renderToken(++renderGeneration);
  }

  function hideErrorBanner() {
    errorBanner.textContent = "";
    errorBanner.hidden = true;
  }

  function hidePreviewMessage() {
    previewMessage.textContent = "";
    previewMessage.hidden = true;
  }

  function clearFileStatus() {
    hideErrorBanner();
    hidePreviewMessage();
  }

  function showErrorBanner(message) {
    errorBanner.textContent = message;
    errorBanner.hidden = false;
  }

  function showPreviewMessage(message) {
    previewMessage.textContent = message;
    previewMessage.hidden = false;
  }

  function updateDocumentTitle(filename) {
    docTitle.textContent = filename;
    document.title = filename + " — mdview";
    globalThis.__mdviewDocumentTitle = filename;
  }

  function scheduleRender() {
    var token = ++renderGeneration;
    if (renderTimer) {
      clearTimeout(renderTimer);
    }
    renderTimer = setTimeout(function () {
      renderTimer = 0;
      renderToken(token);
    }, 80);
  }

  if (
    !input ||
    !preview ||
    !toggle ||
    !mdTheme ||
    !hlTheme ||
    !fileInput ||
    !dropZone ||
    !errorBanner ||
    !previewMessage ||
    !docTitle ||
    typeof globalThis.renderMarkdown !== "function" ||
    !fileIO ||
    typeof fileIO.createFileLoader !== "function" ||
    typeof fileIO.messageFor !== "function"
  ) {
    return;
  }

  var fileLoader = fileIO.createFileLoader({
    onSuccess: function (payload) {
      input.value = payload.text;
      renderNow();
      clearFileStatus();
      updateDocumentTitle(payload.filename);
    },
    onError: function (reason, detail) {
      var message = fileIO.messageFor(reason, detail);
      if (reason === "too-large") {
        showErrorBanner(message);
        hidePreviewMessage();
        return;
      }
      hideErrorBanner();
      showPreviewMessage(message);
    }
  });

  function loadFirstFile(files) {
    if (files && files[0]) {
      fileLoader.load(files[0]);
    }
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
  }, { signal: controller.signal });

  fileInput.addEventListener("change", function () {
    loadFirstFile(fileInput.files);
    fileInput.value = "";
  }, { signal: controller.signal });

  dropZone.addEventListener("dragenter", function () {
    dropZone.classList.add("dragover");
  }, { signal: controller.signal });

  dropZone.addEventListener("dragover", function (event) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
    dropZone.classList.add("dragover");
  }, { signal: controller.signal });

  dropZone.addEventListener("dragleave", function (event) {
    if (!event.relatedTarget || !dropZone.contains(event.relatedTarget)) {
      dropZone.classList.remove("dragover");
    }
  }, { signal: controller.signal });

  dropZone.addEventListener("drop", function (event) {
    event.preventDefault();
    dropZone.classList.remove("dragover");
    loadFirstFile(event.dataTransfer && event.dataTransfer.files);
  }, { signal: controller.signal });

  input.addEventListener("input", function () {
    clearFileStatus();
    scheduleRender();
  }, { signal: controller.signal });
  renderNow();
})();
