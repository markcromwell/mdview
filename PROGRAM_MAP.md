# Program Map: mdview

<!--GENERATED:BEGIN hash=13d7956f4b9f496f4a4a72299f092dfdd00e57defd9fa77683101b99f67bb5b4 sig= job=0 commit=e72e0c9292413c60b4e4f4deaec3cf4a6c7291f8-->
<!--Generated 2026-08-02T00:55:39.822615+00:00. Do not edit — will be overwritten.-->

## II. Canonical Data Schema [GENERATED — do not edit]

_No SQLAlchemy models found._

## III. File and Module Map [GENERATED — do not edit]

```
.github/workflows/ci.yml
.gitignore
PROGRAM_MAP.md
README.md
app.js
assets/app.css
assets/github-markdown-dark.css
assets/github-markdown-light.css
assets/hljs-github-dark.css
assets/hljs-github.css
assets/sample-image.svg
fileio.js
index.html
package-lock.json
package.json
render.js
samples/code-heavy.html
samples/readme-scale.html
scripts/build_samples.mjs
scripts/check_no_egress.mjs
scripts/run_unit_tests.mjs
test/app_file_open.test.mjs
test/fileio.test.mjs
test/markup.test.mjs
test/no_egress.test.mjs
test/render.test.mjs
vendor/highlight.min.js
vendor/marked.min.js
vendor/purify.min.js
```

## IV. API Surface [GENERATED — do not edit]

_No FastAPI routes found._

<!--GENERATED:END-->

---

## V. Architectural Decisions [CURATED]

- ADR-1: All file reads are strictly client-side. Zero network egress during file open is enforced
  by a HAR-shaped ledger check in `scripts/check_no_egress.mjs`.
- ADR-2: Markdown file input has a hard 2 MiB cap and oversized files are refused visibly rather
  than truncated.
- ADR-3: File content is decoded with strict `TextDecoder("utf-8", { fatal: true })` semantics
  instead of `FileReader.readAsText`, so invalid byte sequences fail explicitly.
- ADR-4: File loading allows only one in-flight read and uses generation-token last-write-wins
  semantics to drop stale completion callbacks.
- ADR-5: Filenames are sanitized to a basename before any display, document-title, or print-title
  use.

---

## VI. Planned Work [CURATED]
_To be populated by the spec planner._
