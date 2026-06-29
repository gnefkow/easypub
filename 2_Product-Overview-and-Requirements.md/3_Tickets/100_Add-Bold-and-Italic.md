# Ticket: Bold + Italic inline formatting in TextBlock

## Goal
Enable editors to **bold** and **italicize** text within a `TextBlock` editor so that formatting **renders in the exported EPUB**.

This must work for both:
- **New formatting** added in EasyPub
- **Existing formatting** already present in imported EPUB XHTML (e.g. `<strong>`, `<em>`)

## Why this matters (current constraint)
`TextBlock` currently stores `block.html` and displays it via `dangerouslySetInnerHTML`, but the edit UI uses a plain `<textarea>` and strips markup to `textContent`. On save, it escapes `<`/`>` so users cannot persist inline tags.

## Canonical output format (EPUB/XHTML)
Write **standard inline XHTML** within the block’s element:
- **Bold**: `<strong>…</strong>`
- **Italic**: `<em>…</em>`
- **Line break**: `<br />` (optional; existing behavior already maps `\n` → `<br />`)

Do **not** output non-standard tags like `<span=bold>` or rely on inline styles for this feature.

## UX / Interface
### Editing surface
Replace the `TextBlock` edit `textarea` with a **rich text editor** that:
- displays formatted text inline
- can toggle marks on selection
- can serialize to an **HTML fragment** that becomes the block’s `innerHTML`

### Inline formatting toolbar
When a `TextBlock` is in **editing mode**, show a small formatting toolbar near the top of the edit area:
- **Bold** button (B)
  - Button size: medium, Hierarchy: tertiary
- **Italic** button (I)
  - Button size: medium, Hierarchy: tertiary
- Optional: show active state when cursor/selection is within bold/italic text

### Hotkeys
Inside the editor (while editing a block):
- `Cmd/Ctrl+B`: toggle bold
- `Cmd/Ctrl+I`: toggle italic
- Preserve existing behaviors:
  - `Esc`: cancel editing
  - `Cmd+Enter`: commit editing





## Data model changes
### Frontend queue action
Add a new queue action to represent “replace block inner HTML”:
- `action: 'edit-html'`
- identifiers: `fromHref`, plus `blockId` preferred (fallback to `blockIndex`)
- payload: `html` (string, HTML fragment)

Update `src/types/reader.ts`:
- Extend `QueueItem['action']` union with `'edit-html'`
- Add `html?: string` to `QueueItem`

### Queue sidebar labeling
Update `QueueSidebar` to label `edit-html` similarly to `edit-text` (e.g. “Edit Text”), but optionally show `… with formatting` or show `html length`.

## Backend changes (server)
### New action handler: `edit-html`
In `server/index.js` queue execution:
- Handle `action.action === 'edit-html'`
- Locate target element via:
  - `blockId` → `[data-easypub-id="..."]` (preferred)
  - else `blockIndex` (fallback)
- Replace **inner HTML** of that element with the provided fragment.

### Sanitization (must-have)
Before writing the fragment into the EPUB XHTML, sanitize to an allowlist of inline tags/attrs.

Initial allowlist (minimal for this ticket):
- Tags: `strong`, `em`, `br`
- No attributes allowed (or allow `class` only if needed later)
- Explicitly disallow: `style`, `script`, event handlers (`on*`), unknown tags

Implementation options:
- **Server-side sanitization** using a small allowlist sanitizer for Cheerio DOM nodes
- Optionally also sanitize on the client for instant feedback (server remains source of truth for safety)

## Editor implementation (frontend)
### Recommended library
Use a standard, widely adopted rich-text editor that outputs HTML and supports marks + input rules:
- **TipTap (ProseMirror)** is a strong fit (common, well-supported, good mark/tooling story).

### Component structure (keep modules small)
Suggested files:
- `src/components/viewer/richText/TextBlockRichEditor.tsx`
  - wraps editor instance
  - exposes `valueHtml`, `onChangeHtml`, hotkeys, focus management
- `src/components/viewer/richText/InlineFormatToolbar.tsx`
  - Bold/Italic buttons + active state
- `src/components/viewer/richText/sanitizeInlineHtml.ts`
  - client-side allowlist sanitizer (optional but useful)
- `src/components/viewer/richText/inlineFormatSchema.ts` (optional)
  - centralizes allowlist/spec in one place so client+server can match

Update `TextBlock.tsx`:
- When `isEditing`, render `TextBlockRichEditor` instead of `<textarea>`
- Initialize editor content from `block.html` (not plain text)
- On commit, enqueue `edit-html` with sanitized HTML fragment

Update `ReaderView.tsx`:
- Replace `handleSaveText` with a handler that accepts `nextHtml` and:
  - updates `sections[].blocks[].html = nextHtml` (sanitized)
  - queues `edit-html` (not `edit-text`)

## Acceptance criteria
- **Inline toolbar** appears only while editing a `TextBlock`.
- Clicking **Bold** toggles `<strong>` around the selection; **Italic** toggles `<em>`.
- `Cmd/Ctrl+B` and `Cmd/Ctrl+I` work while editing.
- Saving the block and executing the queue writes XHTML such that EPUB readers render bold/italic.
- Existing `<strong>/<em>` from imported EPUBs is preserved and editable.
- Sanitization prevents unsafe markup from being written into the EPUB content docs.
- No regressions to existing queue actions (change tag, justify, append, split, delete).

## Step-by-step implementation checklist
1. **Types**
   - Add `'edit-html'` + `html?: string` to `QueueItem` type.
2. **Queue payload**
   - Ensure `ReaderView` includes `html` in the POST body for `edit-html`.
3. **Frontend editor**
   - Add rich editor component (TipTap recommended) with bold/italic marks + hotkeys.
   - Add inline toolbar with toggle buttons.
4. **Frontend save path**
   - Replace current escape-to-text behavior with “sanitize + store HTML fragment”.
   - Queue `edit-html`.
5. **Backend queue executor**
   - Implement `edit-html` action: find block by `blockId`/`blockIndex`, replace inner HTML.
   - Sanitize server-side before writing.
6. **Queue sidebar**
   - Display human-friendly label for `edit-html`.
7. **Testing / verification**
   - Manual: import a known EPUB with italics/bold, edit, save, open result in at least 2 readers (e.g. Apple Books + Calibre).
   - Add minimal unit tests if a test harness exists (sanitization + HTML replacement behavior).

## Notes / future extensions (not required for this ticket)
- Underline, strikethrough, superscript/subscript
- Links (`<a href>`), with additional allowlist + URL validation
- Preserve/round-trip other inline tags already in EPUBs (e.g. `<span>`, `<cite>`) via expanded allowlist
- “Format painter” / clear formatting (remove marks)




## What library should we use?

### What we chose:
**TipTap**

- **Best fit for our shape**: We edit at the TextBlock (single XHTML element) level—each editor instance is scoped to a small HTML fragment (`block.html`). TipTap is headless and designed for constrained schemas; we can limit it to `<strong>/<em>/<br />` and build a minimal per-block toolbar.
- **Straightforward HTML workflow**: Our app already treats each block as an `innerHTML` fragment. TipTap’s ProseMirror foundation treats HTML in/out as a core, well-supported path—no Delta↔HTML translation layer.
- **Scales with our model**: We don’t expect large content documents; future multi-block styling would be a batch/queue action (iterate selected blocks, apply transform, enqueue multiple `edit-html` actions), not one big shared editor. TipTap for per-block rich text + queue actions for cross-block formatting is a clean split.
- **Ecosystem and maintenance**: Widely used, MIT, actively maintained. Easy to extend with links, input rules (`**bold**`), paste rules, etc.



### What we considered:
| Option | Functionality (now + future) | Fit for EasyPub (React, per-TextBlock, EPUB XHTML) | Project reach | Availability | Project currentness / effort | Notes |
|---|---|---|---|---|---|---|
| **TipTap (ProseMirror)** ([repo](https://github.com/ueberdosis/tiptap)) | Strong marks (bold/italic), input rules (markdown-like), paste handling, extensible schema; HTML in/out is a first-class workflow | **Very good**: React bindings, headless (you build your own small toolbar), easy to constrain to `<strong>/<em>/<br />` and sanitize | ~**35k** GitHub stars; large ecosystem | **MIT** (FOSS) | Active; last commit shown **2026-02-26** | Great default choice for “toolbar + optional markdown typing” |
| **Lexical** ([repo](https://github.com/facebook/lexical)) | Strong marks, good performance, markdown transformers exist; extensible; React package | **Good**: React-first ergonomics; define HTML export/import + sanitization carefully (model-based) | ~**21k** GitHub stars; significant adoption | **MIT** (FOSS) | Active; release shown **v0.41.0 (2026-02-25)** | Very viable; slightly more “framework” feeling than TipTap |
| **ProseMirror (direct)** ([org](https://github.com/ProseMirror)) | Extremely capable core; full control over schema/commands/plugins | **Medium**: most work to wire up UI + React integration; best if you want maximum control | ~**8.6k** stars on `prosemirror` repo (ecosystem is bigger than one repo) | **MIT** (FOSS) | Active; last commit shown **2026-01-22** | TipTap/Remirror exist largely to avoid DIY’ing this layer |
| **Slate** ([repo](https://github.com/ianstormtaylor/slate)) | Very flexible; you build many behaviors yourself; marks are doable but edge-cases are on you | **Medium**: React-native, but more DIY for selection/clipboard/HTML interop; higher implementation cost for robust HTML round-trip | ~**30k** GitHub stars | **MIT** (FOSS) | Active; last commit shown **2026-01-10** | Powerful, but tends to become “build your own editor” quickly |
| **Quill (v2)** ([repo](https://github.com/slab/quill)) | Good basic formatting; Delta model; HTML import/export exists but isn’t the native truth | **Medium/low** for EPUB fidelity: Delta↔HTML round-trip + strict XHTML output can add friction | ~**45k** GitHub stars | **BSD-3-Clause** (FOSS) | Last commit shown **2025-07-25** | Consider only if you accept conversion complexity |
| **TinyMCE** ([repo](https://github.com/tinymce/tinymce)) | Full-featured “word processor in the browser” | **Low/medium**: heavier UI than you want per-block; harder to constrain output; licensing can be a blocker | ~**15.5k** GitHub stars | **GPLv2+** for v7+ (copyleft) + commercial options | Active; tags/commits shown into **2026-02-10** | Strong product, but likely overkill + license risk |
| **CKEditor 5** ([repo](https://github.com/ckeditor/ckeditor5)) | Full-featured, very capable | **Low/medium**: heavier; customization is possible but substantial; licensing is the big consideration | ~**10k** GitHub stars | **GPL-2.0-or-later** or commercial | Active (release shown **2025-04-07**) | Great editor, but GPL/commercial may not fit your distribution goals |
| **Remirror (ProseMirror toolkit)** ([repo](https://github.com/remirror/remirror)) | ProseMirror + React abstractions; marks/tooling | **Medium**: React friendly; adds another abstraction layer | ~**2.9k** GitHub stars | **MIT** (FOSS) | Last commit/release shown around **2025-08-02** | Feels less “current” than TipTap/Lexical for a new bet |