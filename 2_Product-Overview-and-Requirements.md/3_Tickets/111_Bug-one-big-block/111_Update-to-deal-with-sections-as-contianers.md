---
**Keywords**: section, article, container, wrapper, one big block, parseSectionBlocks, collectAllowedBlocks, allowedTags, Pandoc, content document, TextBlock, ReaderView, server/index.js, break section below, split-section, merge, PRD 1.2, PRD 1.3, ticket 111
---

Some EPUBs load in EasyPub as **one giant TextBlock** instead of one block per paragraph/heading. The affected file in this ticket folder is the Pandoc-generated *Do Artifacts Have Politics* sample (`Do Artifacts Have Politics_epub_unzipped/`). The Heidegger sample in the same folder (`Heidegger_epub_unzipped/`) loads correctly and serves as a regression check.

This ticket fixes block parsing so HTML `<section>` and `<article>` elements are treated as **structural containers**, not as editable blocks themselves.


----------------------------------------------------------------------------------------------------


## **Design and Rationale**

### **Root cause**

When a content document loads, `parseSectionBlocks` in [`ReaderView.tsx`](../../../3_App/src/views/ReaderView.tsx) walks the `<body>` DOM. When it hits a tag in `allowedTags`, it creates **one TextBlock** from that element's `innerHTML` and **stops recursing into children**.

`section` and `article` are in `allowedTags`. Pandoc EPUBs wrap chapter content like this:

```html
<body epub:type="bodymatter">
  <section id="do-artifacts-have-politics" class="level1">
    <h1>Do Artifacts Have Politics?</h1>
    <p>...</p>
    <p>...</p>
    <!-- 77 paragraphs, plus nested <section> elements -->
  </section>
</body>
```

EasyPub sees the outer `<section>` first → **one block** containing the entire chapter. The inner `<p>` and `<h1>` tags are never reached.

EPUBs with a flat structure (paragraphs as direct children of `<body>`, like the Heidegger sample) are unaffected.

The same logic exists server-side in [`collectAllowedBlocks`](../../../3_App/server/index.js) — split, merge, block ID assignment, and save paths all use the same allow-list walk. **Both must change together.**

### **Important distinction: EasyPub Section vs HTML `<section>`**

| | EasyPub **Section** | HTML `<section>` / `<article>` |
|---|---|---|
| What it is | An EPUB **content document** (one `.xhtml` file) | A **tag inside** a content document |
| Managed via | Section sidebar, boundary cards, queue (split/merge/rename) | Block parser only |
| This ticket | **No change** to these features | **Fix** how these tags are parsed |

Removing or transparentizing `<section>`/`<article>` in the block parser does **not** affect Break Section Below, Remove content document break, rename, or sidebar navigation. Those features operate on content documents and TextBlocks (`p`, `h1`, etc.). This fix actually **unblocks** Break Section Below on Pandoc EPUBs, which today have only one splittable block per chapter.

### **Chosen approach**

Treat `<section>` and `<article>` as **transparent containers** during the block walk:

- WHEN the walker hits `<section>` or `<article>` → recurse into children; do **not** create a TextBlock
- WHEN the walker hits `p`, `h1`–`h6`, etc. → create a TextBlock as today

Do **not** simply delete `section`/`article` from `allowedTags` without adding explicit container handling — nested `<section>` elements (common in Pandoc) need predictable recursion, not accidental behavior.

### **Alternatives considered**

| Option | Pros | Cons |
|--------|------|------|
| **A. Transparent containers (chosen)** | Fixes Pandoc EPUBs; preserves wrapper markup on save; no HTML mutation on load | Users cannot select the wrapper itself as a TextBlock (rarely needed) |
| B. Remove from allow list only | Minimal code change | Same effective behavior, but less explicit; edge cases with empty containers unclear |
| C. Unwrap `<section>` on load | Simple mental model | Mutates source HTML; loses `id`, `class`, `epub:type` on wrappers; save/export semantics harder |

### **In scope**

- Client: `parseSectionBlocks` in `ReaderView.tsx`
- Server: `collectAllowedBlocks` in `server/index.js` (and any caller that depends on the same walk)
- Regression: Heidegger flat-structure EPUB still parses one block per `p`/`h2`
- Fix: *Do Artifacts Have Politics* `ch001.xhtml` parses ~77+ blocks, not 1

### **Out of scope**

- Changing how EasyPub **content document** Sections are split, merged, or renamed ([PRD 1.2](../2_PRD/PRD_1.2_Section_Manage-Sections.md))
- Stripping or rewriting Pandoc `class="level1"` / nested section hierarchy on export
- General HTML normalization (e.g. unwrapping `<div>` wrappers — separate issue if encountered)
- Block-level indent, spellcheck, or space-break behavior (those consume the block list; they should work automatically once parsing is fixed)


----------------------------------------------------------------------------------------------------


## **Acceptance criteria**

- WHEN `Do Artifacts Have Politics` `ch001.xhtml` is loaded, THEN the viewer shows **one TextBlock per** `p`, `h1`, `h3`, etc. — **not** one block for the outer `<section>`
- WHEN the Heidegger sample section files (e.g. `section-52674941.xhtml`) are loaded, THEN block count and behavior are **unchanged** from today
- WHEN the user selects a paragraph in *Do Artifacts* and chooses **Break Section Below**, THEN a queued split is created at that block (same as on flat-structure EPUBs)
- WHEN the user saves and reopens the epub, THEN wrapper `<section>` elements and their attributes (`id`, `class`, `epub:type`) are **still present** in the XHTML — only parsing behavior changed, not document structure
- WHEN server-side operations run (split, merge, tag change, block ID assignment, spellcheck), THEN they use the same transparent-container rules as the client parser


----------------------------------------------------------------------------------------------------


## **Implementation Plan**

### **Step 1: Define container tags (shared concept)**

Introduce a clear split in both client and server:

- **Block tags** — create a TextBlock: `p`, `h1`–`h6`, `li`, `blockquote`, `pre`, `figure`, `figcaption`, `table`, `ul`, `ol`, `img`, `hr`
- **Container tags** — recurse only: `section`, `article`

Keep the two lists adjacent in code with a one-line comment explaining why containers exist (Pandoc / EPUB3 structural wrappers).

### **Step 2: Update `parseSectionBlocks` (client)**

In [`ReaderView.tsx`](../../../3_App/src/views/ReaderView.tsx), change the `walk` function:

```javascript
// Pseudocode — adapt to existing structure
if (CONTAINER_TAGS.has(tag)) {
  node.childNodes.forEach(walk)
  return
}
if (BLOCK_TAGS.has(tag)) {
  // existing block creation logic
  return
}
node.childNodes.forEach(walk)
```

No change to `buildPathSelector`, noteref handling, or block shape — only which nodes become blocks.

**Verify:** Load *Do Artifacts* ch001 → confirm many TextBlocks in viewer; spot-check first block is `h1`, following blocks are `p`.

### **Step 3: Update `collectAllowedBlocks` (server)**

Apply the same container vs block split in [`server/index.js`](../../../3_App/server/index.js) `collectAllowedBlocks`. Every server path that splits HTML, finds blocks by index/id, assigns `data-easypub-id`, or rebuilds `<body>` content depends on this function.

**Verify:** Queue a split on a mid-chapter paragraph in *Do Artifacts* → Update Epub → confirm two content documents with correct content split; wrapper `<section>` still wraps each part's blocks appropriately.

### **Step 4: Tag dropdown cleanup (small, same ticket)**

[`TextBlockToolbar.tsx`](../../../3_App/src/components/viewer/TextBlockToolbar.tsx) still lists `section` and `article` in `TAG_OPTIONS`. After this change, a user could tag a block as `<section>` but the parser would not treat it as a standalone block on reload.

- Remove `section` and `article` from `TAG_OPTIONS`, **or**
- Keep them but add a ticket note that changing *to* section/article is unsupported until we have a use case

**Recommendation:** Remove from dropdown in this ticket to avoid confusion.

### **Step 5: Manual test matrix**

| File | Expected block count (approx.) | Notes |
|------|-------------------------------|-------|
| `Do Artifacts…/text/ch001.xhtml` | ~80 (not 1) | Outer + nested `<section>` wrappers |
| `Do Artifacts…/text/title_page.xhtml` | 2 (`h1`, `p`) | Single wrapper section |
| `Heidegger…/section-52674941.xhtml` | ~72 | Flat body — regression |
| `Heidegger…/chap_0001.xhtml` | 2 | Cover-style page |

Copy test EPUBs to `3_App/workingFiles/` if not already present, or use the unzipped samples in this ticket folder for HTML inspection.


----------------------------------------------------------------------------------------------------


## **PRD updates (after ticket complete)**

Consider a short addendum to [PRD 1.3 Viewer and Text Block](../2_PRD/PRD_1.3_Viewer_and_Text_Block.md):

- TextBlocks are extracted from **block-level content tags** (`p`, headings, etc.)
- HTML `<section>` and `<article>` are **containers** — not rendered as TextBlocks; children inside them are

No PRD change needed for [PRD 1.2 Section Management](../2_PRD/PRD_1.2_Section_Manage-Sections.md) unless we want an explicit note that "Section" (content document) ≠ HTML `<section>`.


----------------------------------------------------------------------------------------------------


## **Test assets**

Unzipped samples live in this ticket folder:

- **Broken (before fix):** `Do Artifacts Have Politics_epub_unzipped/`
- **Working (regression):** `Heidegger_epub_unzipped/`

Key file for the bug: `Do Artifacts Have Politics_epub_unzipped/EPUB/text/ch001.xhtml` — 77 `<p>` tags inside 3 `<section>` wrappers; parser currently returns 1 block.
