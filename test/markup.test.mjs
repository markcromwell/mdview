/*
 * markup.test.mjs — structural checks for mdview's CSP-clean file-open chrome.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(path.join(ROOT, "index.html"), "utf8");
const css = readFileSync(path.join(ROOT, "assets", "app.css"), "utf8");
const dom = new JSDOM(html);
const { document } = dom.window;

const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src * data:; font-src 'self' data:; base-uri 'none'; form-action 'none'";

let failures = 0;
function check(name, cond) {
  if (cond) {
    console.log("  PASS  " + name);
  } else {
    console.error("  FAIL  " + name);
    failures++;
  }
}

const fileInput = document.getElementById("file-input");
const dropZone = document.getElementById("drop-zone");
const errorBanner = document.getElementById("error-banner");
const previewMessage = document.getElementById("preview-message");
const docTitle = document.getElementById("doc-title");
const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]');

check("finds #file-input", !!fileInput);
check("#file-input is a file picker", fileInput?.getAttribute("type") === "file");
check("#file-input accepts .md files", fileInput?.getAttribute("accept")?.includes(".md"));
check("finds #drop-zone", !!dropZone);
check("finds hidden #error-banner", !!errorBanner && errorBanner.hasAttribute("hidden"));
check("#error-banner is an assertive alert", errorBanner?.getAttribute("role") === "alert" && errorBanner?.getAttribute("aria-live") === "assertive");
check("finds hidden #preview-message", !!previewMessage && previewMessage.hasAttribute("hidden"));
check("finds print title holder", !!docTitle);
check("CSP content is unchanged", csp?.getAttribute("content") === CSP);

const eventAttrs = [];
for (const el of document.querySelectorAll("*")) {
  for (const attr of el.getAttributeNames()) {
    if (/^on/i.test(attr)) eventAttrs.push(`${el.tagName.toLowerCase()}[${attr}]`);
  }
}
check("contains zero inline event-handler attributes", eventAttrs.length === 0);

const inlineScripts = [...document.querySelectorAll("script:not([src])")]
  .filter((script) => script.textContent.trim().length > 0);
check("contains zero inline script bodies", inlineScripts.length === 0);
check("styles .drop-zone", /\.drop-zone\s*\{/.test(css));
check("styles .drop-zone.dragover", /\.drop-zone\.dragover\s*\{/.test(css));
check("styles light error banner", /:root\s+\.error-banner\s*\{/.test(css));
check("styles dark error banner", /:root\[data-theme="dark"\]\s+\.error-banner\s*\{/.test(css));

console.log("");
if (failures === 0) {
  console.log("All markup assertions passed.");
  process.exit(0);
} else {
  console.error(failures + " markup assertion(s) FAILED.");
  process.exit(1);
}
