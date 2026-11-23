## **Overview**
Before this ticket, the `index.js` file had more than 2,000 lines of code, which is NOT consistent with our Design Principles, which specify that we should have human-readable, small files where we abstract out certain functions. 

*This Ticket* is a tech-debt ticket where we abstract this out into multiple files. 

**Specifically:**

Today, [`3_App/server/index.js`](../../3_App/server/index.js) is a single ~2,200-line god file with almost no comments. Many distinct jobs live there: spellcheck, history/backup, OPF package edits, TOC/endnotes, HTML block transforms, styles/lang, and all API routes. That violates the Design Philosophy (“no large god files”; prefer ~150–200 line modules).

--------------------------------------------------

### **Target architecture** — same behavior (same URLs, same payloads), but split by concern:

```
server/
  index.js              # create app, mount routes, listen (~50–80 lines)
  routes/
    working-files.js    # HTTP: list, upload, download, history, undo…
    queue.js            # POST queue + progress
    spellcheck.js       # spellcheck + dictionary
  lib/
    paths.js            # workingDir, historyRoot, safe filenames
    history.js          # backup + history log
    zip.js              # open epub, read/write files in the zip
    opf.js              # manifest, spine, cover metadata
    toc.js              # nav / toc.ncx
    endnotes.js
    html-blocks.js      # block IDs, tag/justify/text/html edits, split/merge
    styles.js           # easypub stylesheet + lang
    spellcheck.js       # nspell helpers
```

**Why this shape**

| Concern | Lives in | Why |
|---|---|---|
| HTTP wiring | `routes/` | Thin: load file → call helpers → return JSON |
| EPUB package / OPF | `lib/opf.js` | Manifest, spine, cover — not Express |
| HTML block edits | `lib/html-blocks.js` | Shared by queue and other routes |
| Filesystem / history | `lib/paths.js`, `lib/history.js` | Working files + undo backups |
| Spellcheck | `lib/spellcheck.js` + `routes/spellcheck.js` | Isolated dictionary / nspell |

**What “good” means**

1. **Thin routes** — no 500-line handlers next to unrelated helpers.
2. **Pure-ish helpers** — OPF/HTML functions take `(zip, opfPath, opfData, …)` and return results.
3. **One concern per file** — fixing cover metadata means opening `opf.js`, not scrolling past spellcheck.
4. **Behavior unchanged** — refactor-only; no new API shape, no queue algorithm rewrite.
5. **Comments only for non-obvious EPUB edge cases** — module names + small files do most of the explaining.

**What we deliberately will not do**

- No rewrite of the queue algorithm or feature work “while we’re here.”
- No clever abstractions (plugins, DI) — standard Express routers + plain JS modules.
- Queue may stay a bit larger than 200 lines if it remains *only* the queue; that’s fine.

**How To File**
Guidelines live in [`3_App/server/_guidelines.md`](../../3_App/server/_guidelines.md). That signpost describes what belongs in `index.js`, `routes/`, and `lib/` (orchestration + principles), not a fixed inventory of filenames — so it stays useful as new modules are added. 

--------------------------------------------------
**QA Tests**
Because this is a deep ticket that affects everything in our system, we need to make sure to test it thoroughly. This is a **behavior-unchanged** refactor: if anything below fails vs. pre-split behavior, stop and investigate — do not “fix product” in this ticket.

Use at least one small pub and one multi-section pub (e.g. files under `4_testing/`). Restart the API after the split so you are not hitting a stale `:5174` process.

### **Boot & wiring**

- [ ] `npm run dev` starts both Vite and the API; `[server] EasyPub API running on…` appears and **stays** running (no immediate exit)
- [ ] Home lists working files (`GET /api/working-files` path still works)
- [ ] Opening a book loads the reader (download + ensure-block-ids path still works)

### **Core edit → Update Epub (queue)**

On one chapter, perform a representative mix of edits, then **Update Epub**, wait for progress to finish:

- [ ] Edit paragraph text
- [ ] Change a block’s tag / type (e.g. paragraph ↔ heading) if the UI exposes it
- [ ] Change justification (left / center / right / justify) on a block
- [ ] Merge or split sections/blocks if the UI exposes those actions
- [ ] Progress completes without error; reopening the book shows the same edits

### **Undo & history**

- [ ] After a successful Update Epub, **Undo** restores the previous version
- [ ] History still lists prior saves (or whatever the History UI currently shows)

### **Spellcheck & dictionary**

- [ ] Spellcheck still marks unknown words in a section/block
- [ ] Adding a word to the dictionary and re-checking treats it as known
- [ ] Dictionary survives reload of the same working file

### **Upload / new file**

- [ ] Upload a fresh `.epub` into working files and open it in the reader
- [ ] Run at least one small edit + Update Epub on that upload

### **Regression smoke (recent server features)**

These live in the same server today; after the split they must still behave:

- [ ] **Block IDs (112):** After Update Epub, content docs do not keep `data-easypub-id` if Continue editing / Back Home flow is used as designed; editing session still can target blocks
- [ ] **Left justification (113):** Choosing Left and updating writes `text-align: initial` (not `left`); reopening still shows Left in the toolbar
- [ ] **Cover normalize (114):** On a pub missing one of EPUB2/EPUB3 cover markers, Update Epub still fills in the missing marker (no mismatch cases)

### **Sanity checklist after QA**

- [ ] No new console/API errors under normal flows
- [ ] Folder layout matches `_guidelines.md` (`index.js` boot-only; handlers in `routes/`; domain logic in `lib/`)
- [ ] `_guidelines.md` is present and still accurate after any rename we made during the split



--------------------------------------------------
## **Implementation Plan**

Server-only. **Refactor with identical behavior** — same URLs, same request/response bodies, same EPUB mutations. No feature work. Follow [`_guidelines.md`](../../3_App/server/_guidelines.md).

**Strategy:** extract **leaf helpers first** (nothing depends on Express), restart the server after each step, and only move HTTP handlers once the libs they need already exist. Prefer cut-and-paste + `import` over rewriting function bodies.

**Import style:** ESM (`"type": "module"`). Relative imports like `./lib/paths.js` / `../lib/opf.js`. Named exports.

----------------------------------------------------------------------------------------------------

### **Step 0: Folders**

Create empty structure (no behavior change yet):

```
server/lib/
server/routes/
```

`_guidelines.md` already exists — leave it alone unless a name we invent conflicts with the guidelines narrative.

----------------------------------------------------------------------------------------------------

### **Step 1: `lib/paths.js`**

Move from `index.js`:

- `rootDir`, `workingDir`, `historyRoot`
- `ensureSafeFilename`
- The `await fs.mkdir(...)` bootstrap for those dirs (or call an `ensureDirs()` from `index.js` once at boot)

`index.js` (and later every lib/route) imports paths from here. **No Express.**

----------------------------------------------------------------------------------------------------

### **Step 2: `lib/history.js`**

Move: `historyDirFor`, `historyLogPathFor`, `readHistory`, `writeHistory`, `appendHistory`, `createBackup`.

Depends on: `paths.js` + `fs`.

----------------------------------------------------------------------------------------------------

### **Step 3: `lib/spellcheck.js`**

Move: `nspell` setup, `WORD_RE`, `spellcheckBlockHtml`, `spellcheckBlocks`, `readDictionary`, `writeDictionary`.

Depends on: `paths.js` (dictionary files live under working/history tree — keep the same file locations as today).

Leave the dictionary HTTP endpoints in `index.js` for now; they will call into this lib.

----------------------------------------------------------------------------------------------------

### **Step 4: EPUB core libs (still no routes)**

Extract in this order so dependencies point downward:

| New file | Move from `index.js` (approx.) | Notes |
|---|---|---|
| `lib/zip.js` | `getContainerOpfPath` (+ any tiny zip helpers that only open/read container) | Keep AdmZip usage here or accept zip as an argument everywhere — match today |
| `lib/opf.js` | `xmlParser` / `xmlBuilder`, `parseOpf`, `writeOpf`, `resolveHref`, manifest/spine getters/setters, property helpers, `normalizeCoverMetadata`, `extractMetadataFromOpf` | Cover logic from ticket 114 stays here, unchanged |
| `lib/endnotes.js` | placeholder regexes, `writeEndnotes` | May import `opf` helpers if needed |
| `lib/toc.js` | `escapeXml`, `collectTocEntries`, `writeToc` | |
| `lib/html-blocks.js` | block tag sets, IDs ensure/strip, find-by-id/index, tag/justify/text/html updates, `sanitizeInlineHtml`, `mergeHtmlBodies`, `splitHtmlByIndex`, `mapSpineContentHtml` / `mapManifestXhtmlHtml` | Biggest file; OK if slightly over 200 lines if it remains *only* HTML-block concerns |
| `lib/styles.js` | `ensureEasypubStylesheet`, `linkStylesheetInContentDocs`, `ensureLangAttributes`, `normalizeTextAlignLeftInZip` (and its HTML helper if only used here) | Justify “initial” normalize from ticket 113 stays with this or with html-blocks — pick one home and don’t split the pair |

After this step, `index.js` should mostly be: imports + multer/app + all `app.get`/`app.post` handlers still in place, calling the new libs.

**Smoke:** restart server, open a book, one tiny Update Epub.

----------------------------------------------------------------------------------------------------

### **Step 5: Shared request wiring helpers (tiny)**

Before splitting routes, extract anything handlers share that isn’t domain logic:

- Multer `storage` / `upload` → e.g. `lib/upload.js` or keep next to `routes/working-files.js` only (prefer routes if only upload uses it)
- `progressState` Map → e.g. `lib/progress.js` (or export from `routes/queue.js` and import into progress handler — either is fine; **one** home)

Do **not** invent a DI container. Pass `workingDir` via imports from `paths.js`.

----------------------------------------------------------------------------------------------------

### **Step 6: Extract routes (HTTP only)**

Create Express `Router`s. Preserve middleware order (today `express.json` is registered mid-file — keep JSON parsing available for the same endpoints that need it; when mounting, `app.use(express.json({ limit: '1mb' }))` can live in `index.js` before routers).

| New file | Endpoints to move |
|---|---|
| `routes/working-files.js` | `GET /`, `GET /index`, `POST /` (upload), `GET /:filename`, `POST /:filename/ensure-block-ids`, `GET /:filename/history`, `GET /:filename/endnotes`, `POST /:filename/merge`, `POST /:filename/undo` |
| `routes/queue.js` | `POST /:filename/queue`, `GET /:filename/progress` — **move the queue body without rewriting algorithms** |
| `routes/spellcheck.js` | `GET/PUT /:filename/dictionary`, `POST /:filename/spellcheck-section`, `POST /:filename/spellcheck-block` |

Mount from `index.js` something like:

```js
app.use('/api/working-files', workingFilesRouter)
// queue + spellcheck routers also under /api/working-files if paths stay identical
```

Exact mount style: keep final URLs identical to today (e.g. `/api/working-files/:filename/queue`). Prefer one parent mount at `/api/working-files` and define relative paths on each router (`/:filename/queue`, etc.), **or** three routers each mounted at `/api/working-files` — Express allows stacking.

API logging middleware (`app.use('/api', …)`) stays in `index.js`.

**Smoke after each route file:** restart; hit that slice’s QA items before moving the next.

----------------------------------------------------------------------------------------------------

### **Step 7: Slim `index.js` to boot-only**

When done, `index.js` should only:

1. Import Express + routers (+ maybe progress/paths bootstrap)
2. Create `app`, attach `/api` logger, `express.json`
3. `app.use(...)` routers
4. `app.listen` + listening / `EADDRINUSE` handlers

No EPUB helpers, no queue logic, no spellcheck guts.

----------------------------------------------------------------------------------------------------

### **Step 8: Guidelines pass**

Skim [`_guidelines.md`](../../3_App/server/_guidelines.md). If we invented an extra shared module (e.g. `lib/progress.js`), add one sentence under `lib/` that shared non-domain state (progress maps, etc.) may live there — still no Express in `lib/`.

----------------------------------------------------------------------------------------------------

### **Step 9: Full QA**

Run the **QA Tests** section above end-to-end. If something fails, fix the extraction (wrong export, broken import, middleware order) — do not change product behavior to “make QA pass.”

----------------------------------------------------------------------------------------------------

### **Out of scope**

- Changing queue ordering / action semantics
- Renaming API routes or response fields
- Splitting `html-blocks.js` further (possible later if it stays huge)
- Client/UI changes
- Automated test suite (manual QA for this ticket)

----------------------------------------------------------------------------------------------------

### **Acceptance criteria**

- [ ] `server/index.js` is boot-only (~50–100 lines)
- [ ] Domain logic lives under `server/lib/`; HTTP under `server/routes/`
- [ ] All previous URLs and payloads still work
- [ ] QA checklist completed with no intentional behavior diffs
- [ ] `_guidelines.md` still accurately describes the folder

----------------------------------------------------------------------------------------------------

## **What we shipped (implementation notes)**

Behavior-unchanged refactor of [`3_App/server/index.js`](../../3_App/server/index.js) (~2,200 lines) into boot + routes + lib.

### **Final layout**

```
server/
  index.js                 # boot only (~41 lines): ensureDirs, API logger, express.json, mount routers, listen
  _guidelines.md           # orchestration signpost (index / routes / lib)
  lib/
    paths.js               # workingDir, historyRoot, ensureSafeFilename, ensureDirs
    history.js             # backup + history log
    spellcheck.js          # nspell + dictionary read/write
    zip.js                 # getContainerOpfPath
    opf.js                 # parse/write OPF, manifest/spine, cover normalize, metadata extract
    endnotes.js            # writeEndnotes (+ ensureEpubNamespace for content docs)
    toc.js                 # nav / toc.ncx
    html-blocks.js         # block IDs, tag/justify/text/html, split/merge helpers
    styles.js              # easypub stylesheet, lang, text-align left→initial zip normalize
    progress.js            # progressState Map + yieldToEventLoop
  routes/
    working-files.js       # list, index, upload, download, ensure-block-ids, history, endnotes GET, merge, undo
    queue.js               # POST queue + GET progress
    spellcheck.js          # dictionary GET/PUT, spellcheck-section, spellcheck-block
```

### **Wiring**

- `npm run dev:server` still runs `node server/index.js`
- All three routers mount at `/api/working-files` (same URLs as before)
- `express.json({ limit: '1mb' })` is global in `index.js` (previously mid-file; same effective behavior for JSON routes)

### **Follow-on fix during QA (not part of the original split, but landed while validating)**

Calibre/pdftohtml content docs often lack `xmlns:epub`. Writing `epub:type="noteref"` via `writeEndnotes` made XHTML invalid → reader showed ~1 block even though prose was still in the file.

- **Server:** `ensureEpubNamespace()` in [`lib/endnotes.js`](../../3_App/server/lib/endnotes.js) — adds `xmlns:epub="http://www.idpf.org/2007/ops"` on content docs when noterefs are written
- **Client:** [`ReaderView.tsx`](../../3_App/src/views/ReaderView.tsx) `parseSectionBlocks` — if XHTML parse yields `parsererror`, fall back to `text/html`
