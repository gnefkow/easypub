---
**Keywords**: endnotes, footnotes, noteref, backlink, epub:type, sidebar, anchor, placeholder, Standard Ebooks, endnotes.xhtml, back matter, cross-file linking, EndnotesSidebar, EndnoteBlock, TopBar, ReaderView, QueueSidebar, TipTap, sanitizeInlineHtml, writeEndnotes, parseSectionBlocks, noterefMap, OPF manifest, spine, cheerio, adm-zip
---

Users who are wrangling messy epubs often have to deal with footnotes. Because they usually come from PDFs, where the footnotes are at the bottom of a page, they are often interspersed with paragraphs -- often cutting a paragraph in half when that paragraph flows to the next page but the footnote is at the bottom.

EasyPub needs to let users create, manage, and place endnotes so that the saved epub conforms to Standard Ebooks endnote conventions.


----------------------------------------------------------------------------------------------------


## **How Endnotes Work in a Standard Epub**

An endnote system has two parts that link to each other across files:

**1. The noteref (in body text):**
A superscripted number that links to the endnote. It lives inline in a paragraph.

```xml
<p>...the Eastern Ocean.<a href="endnotes.xhtml#note-1" id="noteref-1" epub:type="noteref">1</a> My work in Java...</p>
```

**2. The endnote (in `endnotes.xhtml`):**
A list item in an ordered list in a dedicated back matter file. Contains the note text and a backlink (`↩`) pointing back to the noteref.

```xml
<section id="endnotes" epub:type="endnotes">
  <h2 epub:type="title">Endnotes</h2>
  <ol>
    <li id="note-1" epub:type="endnote">
      <p>Detailed reference text here. <a href="chapter-1.xhtml#noteref-1" epub:type="backlink">↩</a></p>
    </li>
  </ol>
</section>
```

Numbering is sequential across the *entire book*, not per-chapter.


----------------------------------------------------------------------------------------------------


## **The Experience**

### **Endnote Sidebar (right side)**

A new sidebar panel that shows all endnotes as an ordered list.

- Each endnote displays its **number** and a **preview** of the note text.
- Users can **edit** an endnote's text in a modal.
- Users can **copy the anchor** for an endnote (for pasting into body text).
- Users can **reorder** endnotes (renumbering happens automatically).
- Users can **delete** an endnote.
- **"Create Endnote"** button at the top or bottom of the sidebar.

### **In the Viewer**

- When editing a block, users can **paste an anchor** to place a noteref inline.
- When a block is *not* selected, noterefs display as styled superscript numbers (visually distinct, like a small badge or pill).
- Clicking a noteref in the viewer could highlight / scroll-to the corresponding endnote in the sidebar (nice-to-have).

### **Later**
- Users can select a block (like a misplaced footnote paragraph) and click a button to **convert it to an endnote** in one step (moves the text to the endnote list, deletes the block, and places an anchor).


----------------------------------------------------------------------------------------------------


## **How It Will Work Technically**

### **Key Concept: Two Representations**

The endnote system has two representations of the same data:

- **File format** (the saved epub): Clean SE-standard markup with sequential numbers (`note-1`, `noteref-1`, etc.), proper `<a>` elements, and a generated `endnotes.xhtml`.
- **App state** (the working session): Stable 4-digit UIDs, plain-text `<a>placeholder-{uid}</a>` strings in body text, and an endnote list held in frontend state.

**Load** = deserialize the file format into app state (server parses `endnotes.xhtml`, client converts `<a noteref>` DOM elements to placeholder text during block parsing).
**Save** = serialize the app state into the file format (server strips old noterefs, replaces placeholders with real `<a>` elements, generates `endnotes.xhtml`).

Each save overwrites everything from scratch. Each load re-ingests from scratch. The sequential numbers in the file are throwaway -- just a snapshot of the order at that moment.

### **Data Model**

Endnotes are stored as app state, separate from section blocks:

```
endnotes: [
  { uid: "vr8s77g2368g", text: "<p>Detailed reference text here.</p>" },
  { uid: "a3k9xm2p7q1f", text: "<p>Another note.</p><p>Second paragraph of this note.</p>" },
]
```

- `uid` is a **stable opaque identifier** (short random string, like `data-easypub-id`). It never changes once created, regardless of reordering, insertion, or deletion.
- `text` is the endnote content as HTML. It supports multiple `<p>` elements and inline formatting (`<em>`, `<cite>`, etc.).
- Sequential display numbers are **not stored** -- they are computed at save time based on where each noteref appears in the spine.

### **Why UIDs, Not Sequential Numbers**

If we used `{{endnote:3}}` as the token, reordering, inserting, or deleting endnotes would require finding and rewriting tokens across all body text sections. With UIDs:

- Tokens in body text (`{{endnote:vr8s77g2368g}}`) never go stale.
- The sidebar can show a *current best-guess* display number, but it's purely cosmetic.
- On save, the server walks the spine in order, finds all tokens, and assigns 1, 2, 3... based on the order they actually appear.

### **On Load (Deserialize)**

When opening an epub (fresh open or reload after save):

1. **Detect endnotes file**: Look for a file with `epub:type="endnotes"` in the spine, or a file named `endnotes.xhtml`.
2. **Parse the `<ol>`**: Each `<li>` becomes an endnote object. Strip the backlink `<a>` (that's generated on save). Assign a fresh UID to each.
3. **Build a mapping**: `note-1` → `uid-abc`, `note-2` → `uid-def`, etc.
4. **Scan body text**: Find all `<a epub:type="noteref">` elements. Use the `href` to look up the corresponding UID from the mapping. Replace the `<a>` element with `{{endnote:uid}}` in the in-memory block model.
5. **Surface orphans**: Endnotes with no matching noteref in body text, or noterefs pointing to non-existent notes, get flagged as warnings.

The result: the app is back in its working state with UIDs and tokens, ready for editing. The sequential numbers from the file are discarded.

### **On Save (Serialize / "Update Epub")**

When the queue is executed:

1. **Walk the spine in order**: Scan every body text section for `{{endnote:uid}}` tokens. Record the order they appear in.
2. **Assign sequential numbers**: First token found = note 1, second = note 2, etc.
3. **Replace tokens in body text**: Each `{{endnote:uid}}` becomes:
   `<a href="endnotes.xhtml#note-N" id="noteref-N" epub:type="noteref">N</a>`
4. **Generate `endnotes.xhtml`**: Build the `<ol>` with endnotes in the computed order. Each `<li>` gets `id="note-N"` and a backlink pointing to `{section-file}#noteref-N`.
5. **Register in OPF**: Add `endnotes.xhtml` to the manifest and spine (after last body chapter, before colophon if present). If it already exists, update in place.
6. **Handle unplaced endnotes**: Endnotes that exist in the sidebar but have no token in body text are still included in `endnotes.xhtml` (appended at the end, after all placed notes), but flagged with a warning to the user.

### **Anchor Placement (Copy-Paste Flow)**

1. User creates an endnote in the sidebar → gets an entry with `uid: "vr8s77g2368g"`.
2. User clicks "Copy Anchor" → clipboard gets `{{endnote:vr8s77g2368g}}`.
3. User edits a body text block in TipTap, pastes the token inline where the superscript number should go.
4. In the viewer (non-editing mode), the token renders as a styled superscript number (the current best-guess display number).
5. On save, the token is replaced with the proper `<a>` element with the final computed number.


----------------------------------------------------------------------------------------------------


## **Open Design Questions**

1. **Existing notes on import**: How do we detect and parse endnotes from wild epubs that don't follow SE conventions? (Inline `<aside>`, per-chapter notes, unlinked superscripts, etc.) For v1, we could limit detection to epubs that already have a recognizable endnotes section.
2. **Inline formatting in endnotes**: Endnote text can contain `<em>`, `<cite>`, etc. Does the modal use the same TipTap editor as body text blocks?
3. **Validation before save**: Should we warn the user if there are endnotes without placed anchors, or anchors referencing deleted endnotes?
4. **Token display in TipTap**: For now, the raw `{{endnote:uid}}` token is pasted. Later, we could render it as a styled chip/badge in the TipTap editor (custom node extension).


----------------------------------------------------------------------------------------------------


## **Decisions Made**

- **Stable 4-digit UIDs, not sequential numbers**: Each endnote gets a 4-character uid (e.g. `a3k9`). Sequential display numbers are computed at save time by walking the spine. This avoids stale references when endnotes are reordered, inserted, or deleted.
- **Plain-text placeholders, not HTML tokens or mustache brackets**: Anchors are plain text strings like `<a>placeholder-a3k9</a>` pasted into body blocks. No sanitizer changes needed, no TipTap extensions. The `<a>` tags are visible as literal text so the user knows it's a tag.
- **Placeholders are the single source of truth**: On save, the server first converts old noteref `<a>` elements from prior saves into placeholder text (using the endnotes array order for `note-N` → uid mapping), then processes all placeholders uniformly. This is critical because the client-side placeholder conversion (in `parseSectionBlocks`) only exists in the frontend's in-memory block model -- blocks the user didn't edit still have real `<a noteref>` elements in the on-disk epub. By converting old noterefs to placeholders server-side before processing, both edited and unedited blocks are handled correctly.
- **Multi-paragraph endnotes from day one**: The endnote text field stores HTML and supports multiple `<p>` elements.
- **Full overwrite on every save**: The `endnotes.xhtml` file and all noterefs in body text are regenerated from app state on each save. No incremental updates.
- **Full re-ingest on every load**: On load, the server parses `endnotes.xhtml` and returns endnotes with fresh UIDs plus a `noterefMap`. The client converts `<a epub:type="noteref">` elements back to placeholder text during block parsing (in `parseSectionBlocks`), before the user ever sees the content.
- **Endnotes sidebar is mutually exclusive with Queue sidebar**: Both use the right sidebar slot in `AppLayout`. Opening one closes the other.


----------------------------------------------------------------------------------------------------


## **Trade-Offs**

- **Sidebar vs. dedicated section view**: A sidebar keeps endnotes visible alongside the body text, which matches the workflow (read body, manage notes). The trade-off is screen real estate -- users already have a section sidebar on the left.
- **Copy-paste anchors vs. inline insertion**: Copy-paste is simpler to build. An inline "insert noteref" button in the TipTap toolbar would be slicker UX but requires a custom TipTap node extension. Good candidate for a follow-up.
- **Full overwrite vs. incremental save**: Overwriting everything on each save is simpler and guarantees consistency. The cost is that any manual edits someone made to `endnotes.xhtml` outside EasyPub would be lost. This is acceptable -- EasyPub is the source of truth for the working session.


----------------------------------------------------------------------------------------------------


## **Out of Scope**

- Footnotes (inline `<aside>` at point of reference) -- SE doesn't use them; everything is endnotes.
- `Ibid.` detection and expansion (Pillar 3 / style guide hints territory).
- Auto-detection of unlinked footnote text in messy epubs (future "convert block to endnote" feature).


----------------------------------------------------------------------------------------------------


## **SE Spec Reference**

- [SE Manual: Endnotes](https://standardebooks.org/manual/1.8.3/7-high-level-structural-patterns) (section 7)
- [SE Manual: Semantics](https://standardebooks.org/manual/1.8.3/4-semantics) (`epub:type` for `noteref`, `endnote`, `backlink`)
- [DAISY KB: Notes](https://kb.daisy.org/publishing/docs/html/notes.html) (accessibility best practices)


====================================================================================================

## Implementation


**Step 1: Create the sidebar and the ability to add, save, and export an endnote.**
- The sidebar displays on the right side of the screen.     
  - Create a folder called components/endnotesSidebar
  - The component file for the EndnotesSidebar.tsx and all of its children will live in this folder. 
  - The background of the sidebar is bg-secondary
- It can be opened and closed by clicking the "endnotes" button (secondary button) that displays in the top bar on the upper right
  - Opening and closing the bar is just a view, it does not have a save or dismiss funciton.
  
*Step 1.2: Create an endnote and save in the export*
The user can click the plus button to make a new endnote. 
Every endnote is rendered in a component called an EndnoteBlock
They can type in the end note.
The end note has a similar "save" interaction with other blocks. 
When the user saves the end note, it remains in the side bar. 
When the user "saves" the epub, the endnote is saved. 
When the user re-opens the book, the endnote appears there. 

*Step 1.3: Create a button for the anchor*
There is a "copy anchor" button in the list item in the EndnotesSidebar for each EndnoteBlock. Pressing the button copies the anchor to the user's clipboard. 
WHEN the user "saves" the epub, THEN the anchors are re-indexed in numerical order according to where they appear in the text. 

WHEN the user opens up the app again, the end notes will be in thie order that they were in the text. 
(If the user puts the same anchor in the text more than once, then the sidebar order is determined by where it FIRST appears in the text). 

Flow:
1. Copy anchor → clipboard gets <a>placeholder-vr8s77g2368g</a> (using the endnote's uid)
2. In the viewer → the user sees the literal text "<a>placeholder-vr8s77g2368g</a>" as a link in the block. No confusion about what it is.
3. On save → server finds all <a>placeholder-{uid}</a> tags, rewrites them to <a href="endnotes.xhtml#note-1" id="noteref-1" epub:type="noteref">1</a> based on spine order
4. On reload → server parses the <a epub:type="noteref"> elements, maps them back to endnotes, and rewrites them as <a>placeholder-{freshUid}</a> in the block HTML before serving to the client

the server does the conversion before the client ever sees the HTML

**Step 1: Implementation Summary**

### **Files Created**

- **`src/components/endnotesSidebar/EndnotesSidebar.tsx`** -- Sidebar panel (right side, `bg-bg-secondary`, `w-72` with `maxWidth: 18rem`). Shows endnote list with count badge and "Add Endnote" button. Props: `endnotes`, `editingEndnoteUid`, `onRequestEdit`, `onCommit`, `onCancel`, `onCreate`, `onDelete`. Mutually exclusive with `QueueSidebar` via `rightSidebar` slot in `AppLayout`.

- **`src/components/endnotesSidebar/EndnoteBlock.tsx`** -- Individual endnote display/edit component. Two modes:
  - **Display mode**: Shows `placeholder-{uid}` label + copy anchor button (top row), endnote text (below). Click to enter edit mode.
  - **Edit mode**: TipTap rich editor (same config as `TextBlockRichEditor` -- bold, italic, sup, sub), Save/Cancel/Delete buttons. Escape to cancel, Cmd+Enter to save. Empty endnotes auto-removed on cancel.
  - **Copy anchor button**: Copies `<a>placeholder-{uid}</a>` to clipboard. Shows "Copied!" tooltip for 1.5s.

### **Files Modified**

- **`src/types/reader.ts`** -- Added `Endnote` type: `{ uid: string, text: string }`.

- **`src/components/TopBar.tsx`** -- Added `endnotesOpen` / `onToggleEndnotes` props. New visible `<Button variant="secondary">` labeled "Endnotes" / "Hide Endnotes" in upper right, before "Update Epub".

- **`src/views/ReaderView.tsx`** -- Core state management:
  - State: `endnotes`, `editingEndnoteUid`, `endnotesOpen`, `noterefMapRef`.
  - Handlers: `handleCreateEndnote` (4-digit uid), `handleCommitEndnote`, `handleCancelEndnoteEdit`, `handleDeleteEndnote`.
  - `loadWorkingFile`: Fetches `GET /api/working-files/:filename/endnotes` BEFORE loading sections. Stores `noterefMap` in a ref.
  - `parseSectionBlocks`: Before extracting block HTML, replaces `<a epub:type="noteref">` elements with placeholder text using `noterefMapRef`.
  - `handleExecuteQueue`: Sends `endnotes` array alongside `actions` in the queue POST payload. `canExecute` is true if there are queue items OR endnotes with text.
  - Toggle logic: Opening Endnotes sidebar closes Queue sidebar and vice versa.

- **`server/index.js`** -- Server-side endnote handling:
  - **`GET /api/working-files/:filename/endnotes`**: Parses `endnotes.xhtml` from the epub zip. Returns `{ endnotes: [{ uid, text }], noterefMap: { "note-1": "uid1", ... } }`. Each endnote gets a fresh 4-digit uid. Backlink `<a>` elements and wrapping `<p>` tags are stripped from endnote text.
  - **`writeEndnotes(zip, opfPath, opfData, endnotes)`**: Called during queue processing. Walks all content docs in spine order. Converts old noteref `<a>` elements from prior saves into placeholder text (using endnotes array order for `note-N` → uid mapping) -- this is necessary because blocks the user didn't edit still have real `<a>` elements on disk even though the client shows placeholders. Then finds all `<a>placeholder-{uid}</a>` text patterns (both HTML-escaped and raw). Assigns sequential numbers by order of first appearance. Replaces placeholders with SE-standard `<a href="endnotes.xhtml#note-N" id="noteref-N" epub:type="noteref">N</a>` elements. Generates `endnotes.xhtml` with `<ol>` of `<li epub:type="endnote">` items, each with a `↩` backlink. Registers `endnotes.xhtml` in OPF manifest and spine.
  - Queue route (`POST /queue`): Accepts `endnotes` array in the request body alongside `actions`. Allows empty actions if endnotes are present.

### **Data Flow**

```
CREATE: User clicks "Add Endnote" → new { uid: "a3k9", text: "" } in state → edit mode

EDIT: User types in TipTap → Save → handleCommitEndnote(uid, sanitizedHtml)

ANCHOR: User clicks copy → "<a>placeholder-a3k9</a>" in clipboard → paste into body block as plain text

SAVE: POST /queue with { endnotes, actions }
  → server converts old <a noteref> elements to placeholder text (note-N → uid via endnotes array order)
  → finds ALL <a>placeholder-{uid}</a> text in spine order (both from edited blocks and converted old noterefs)
  → assigns sequential numbers (1, 2, 3...)
  → replaces placeholders with real <a> elements
  → generates endnotes.xhtml with backlinks
  → registers in OPF manifest/spine
  → writes zip

LOAD: GET /endnotes → { endnotes: [{uid, text}], noterefMap }
  → client stores noterefMap in ref
  → parseSectionBlocks replaces <a noteref> DOM elements with placeholder text
  → user sees "<a>placeholder-a3k9</a>" in blocks
  → endnotes appear in sidebar
```

### **Key Design Principle: Placeholders Are the Single Source of Truth**

On save, the server converts ALL old noteref `<a>` elements into placeholder text first (using the endnotes array order for the `note-N` → uid mapping), then processes all placeholders uniformly. This is necessary because the client-side conversion in `parseSectionBlocks` only affects the in-memory block model -- blocks the user didn't edit still have real `<a noteref>` elements in the epub file on disk. By normalizing everything to placeholders server-side before numbering, both edited and unedited blocks are handled correctly across save/reload cycles.

### **Future Steps**

- Style placeholders in the viewer (render as a badge/chip instead of raw text)
- Convert block to endnote (one-click: move block text to endnote, delete block, place anchor)
- TipTap chip/widget for inline noteref insertion
- Reordering endnotes in the sidebar
- Validation warnings (unplaced endnotes, orphaned anchors)