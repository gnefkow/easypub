# **PRD 1.6: Spellcheck and Dictionary**


----------------------------------------------------------------------------------------------------


## **What Spellcheck Is For**

EasyPub is often used on epubs sourced from OCR'd PDFs. Those files frequently contain **jammed words** -- OCR artifacts where spaces were dropped (e.g. "isa" instead of "is a", "lotof" instead of "lot of"). They also contain **intentional non-English words** -- German terms (*Dasein*, *Aufhebung*), Greek (*poiēsis*, *λόγος*), and coined philosophical terms that a spell-checker will flag even when they are correct.

Spellcheck gives the user a **three-tier word classification** in **view-mode** blocks:

1. **Known English words** -- no highlight; treated as correct.
2. **Custom dictionary words** -- **green highlight**; the user has reviewed this word and confirmed it is intentional (foreign term, proper name, coined term, etc.).
3. **Unknown words** -- **red highlight**; probably an OCR error or something that still needs review.

In **edit mode**, only tier 3 applies: red unknown underlines (no dictionary greens). See **Scope: View Mode vs Edit Mode** below.

Green is not merely "not an error." It is a positive signal: *I have seen this word before and I know what it is.* That helps when the user is working through a text over multiple sessions -- confirming spellings, checking diacritics ("poiēsis" not "poiesis"), or eventually batch-editing foreign words (e.g. italicizing all German terms).

Spellcheck is a **viewing and triage aid**. It does not modify the epub on save. All spellcheck visuals — HTML spans in view mode, ProseMirror decorations in edit mode — exist only in the app's display layer.


----------------------------------------------------------------------------------------------------


## **Scope: View Mode vs Edit Mode**

| Mode | Spellcheck behavior |
|------|---------------------|
| **View mode** (default block display) | Server-processed highlights: red unknown, green dictionary |
| **Edit mode** (TipTap `contentEditable`) | Server-derived red unknown underlines via ProseMirror decorations (debounced re-check). Browser native spellcheck disabled. No dictionary greens. |

Edit-mode underlines are a display layer only — they never modify `block.html`.

**v1 scope:** Spellcheck applies to **text blocks in the viewer** (view and edit mode). Not images, not the endnotes sidebar. Dictionary add/remove interactions are view-mode only.


----------------------------------------------------------------------------------------------------


## **Architecture: Server-Side Processing**

Spell-check runs on the **Express API** (`5174`), not in the browser.

**Why server-side?**

- `cheerio` (already a server dependency) handles messy epub HTML more reliably than browser-side fragment parsing.
- `nspell` + `dictionary-en` load once at server startup and stay in memory. The browser never downloads a ~2–3MB Hunspell dictionary.
- The client receives server spellcheck results and renders them:
  - **View mode:** `spellcheckHtml` with highlight `<span>` wrappers.
  - **Edit mode:** parse `spell-unknown` ranges from `spellcheck-block` responses and apply ProseMirror inline decorations (never browser-native spellcheck).

**Important:** Section HTML is still **loaded in the browser** via epubjs. The server is contacted **after** the client parses blocks, to spell-check them and persist the custom dictionary. Saving/updating the epub does not involve spellcheck.


----------------------------------------------------------------------------------------------------


## **The Spell-Check Engine**

On server startup, `nspell` is initialized with the `en_US` dictionary from `dictionary-en`.

For each word in a block's text content:

| Check | Result |
|-------|--------|
| Single character, all digits, or all punctuation | Skip (no highlight) |
| Word in custom dictionary (case-insensitive) | Green `<span class="spell-dictionary">` |
| Word in `en_US` via `nspell` | No highlight |
| Word in neither | Red `<span class="spell-unknown">` |

**English-only.** Foreign words are handled via the custom dictionary, not by loading additional Hunspell language packs.


----------------------------------------------------------------------------------------------------


## **Two HTML Versions Per Block**

Spellcheck never mutates the block HTML used for editing or saving.

| Field | Purpose |
|-------|---------|
| `block.html` | Original inline HTML. Used by TipTap, queue actions, and "Update Epub". |
| `block.spellcheckHtml` | Display-only HTML with highlight `<span>` wrappers. Used in view mode when spellcheck is enabled. |

Each flagged word span includes a `data-word` attribute (the original word text) for client-side dictionary interactions in view mode.


----------------------------------------------------------------------------------------------------


## **Edit-Mode Display Layer (Decorations)**

Edit mode keeps **`block.html` as the only document content** in TipTap. Spellcheck visuals are **ProseMirror inline decorations** — not marks, not spans in the saved HTML.

| Concern | Approach |
|---------|----------|
| **Source of truth** | Same server `nspell` + per-book dictionary via `/spellcheck-block` |
| **When underlines appear** | Immediately on edit entry; again after ~400ms idle while typing |
| **While re-check is pending** | Underlines are hidden (brief flash is acceptable; wrong underlines are not) |
| **Range accuracy** | Full decoration rebuild from each server response — never carry forward stale positions |
| **Browser spellcheck** | Disabled (`spellcheck="false"`) on the TipTap editor to avoid double marks |
| **Dictionary greens** | Not shown in edit mode (v1) |
| **Click to add to dictionary** | View mode only — edit-mode underlines are not clickable |

**Invariant:** Current editor HTML → `/spellcheck-block` → parse `spell-unknown` ranges → apply decorations → repeat on change.


----------------------------------------------------------------------------------------------------


## **When Spellcheck Runs**

Sections load **one at a time, on demand** -- the typical workflow is open a book, work through one section across several edit/save/reload sessions.

The client POSTs block HTML to the server when:

1. **A section is loaded** for the first time (`loadSection` in `ReaderView.tsx`).
2. **The user navigates to a section** in the sidebar that is already loaded (`handleGoToSection` re-syncs with the server).
3. **Spellcheck is toggled on** and loaded sections are missing `spellcheckHtml`.
4. **A block is saved after edit** -- single-block re-check; updates `block.spellcheckHtml` for view mode.
5. **The user enters edit mode** -- immediate `spellcheck-block` for the current TipTap HTML; decorations applied on response.
6. **The user edits in TipTap** -- debounced `spellcheck-block` (~400ms idle) on each content change; decoration set fully replaced on response.

Server-side logging (terminal, `[server]` / `[0]` output):

```
[section] load: "book.epub" index=2 href="chapter-2.xhtml" — 42 block(s)
[spellcheck] Section complete — 0 unknown words (no misspellings)
```

(or a count and word list when unknowns are found)


----------------------------------------------------------------------------------------------------


## **Custom Dictionary**

### **Per-book, not global**

Each epub gets its own dictionary file in `workingFiles/`:

```
workingFiles/
  my-heidegger-book.epub
  my-heidegger-book.epub.dictionary.json
```

The file is a JSON array of strings:

```json
["Dasein", "Aufhebung", "poiēsis", "λόγος"]
```

Different books have different vocabularies. A Heidegger text and an Aristotle text should not share a dictionary.

### **Storage, not localStorage**

Dictionary files live on the server alongside the epub, consistent with history and other per-book data. They are **not** written into the epub and **not** part of the queue/save pipeline. This also transfers cleanly to a future Ionic + local filesystem architecture.

### **Lookup rules**

- Dictionary lookup is **case-insensitive** ("Dasein" matches "dasein").
- The user's original casing is preserved in the stored array and shown in the Dictionary modal.


----------------------------------------------------------------------------------------------------


## **User Interface**

### **TopBar**

- **Spellcheck checkbox** -- toggles highlight display. When off, blocks render `block.html` as before. Spellcheck data may still be fetched in the background so toggling back on is instant.
- **Dictionary button** -- opens the Dictionary modal (available regardless of spellcheck toggle).

### **View-mode highlights**

- **Red** (`.spell-unknown`) -- wavy red underline. Clickable.
- **Green** (`.spell-dictionary`) -- subtle green background. Clickable.
- **Selected** (`.spell-selected`) -- blue outline when a highlighted word is clicked before adding to dictionary.

### **Edit-mode highlights**

- **Red** (`.spell-unknown` via ProseMirror decorations) -- same wavy red underline styling, scoped under `.tiptap`. Not clickable.
- Underlines appear on edit entry without requiring a keystroke.
- Underlines hide immediately when the user types; they reappear after the debounced server re-check completes.
- Browser-native squiggles are suppressed in the editor.

### **Adding a word to the dictionary**

1. User enables Spellcheck and sees a red-highlighted word in a view-mode block.
2. User **clicks the red word** -- it becomes selected (outline). This does **not** enter edit mode.
3. The `TextBlockToolbar` shows an **Add to Dictionary** button (BookPlus icon).
4. User clicks the button -- all matching words across visible blocks turn green instantly; the word is persisted to `{book}.dictionary.json`.

Clicking elsewhere in the block (not on a highlighted word) enters edit mode as normal.

### **Removing a word from the dictionary**

1. User clicks **Dictionary** in the TopBar.
2. A centered modal opens (existing `Modal` component: `modal-overlay` / `modal-card`).
3. Title shows word count, e.g. "Dictionary (14 words)".
4. Words are listed alphabetically, each with a **Remove** button.
5. Removing a word swaps all matching green highlights back to red in the DOM and persists the updated array to the server.

### **Empty dictionary state**

The modal shows a short message when no words have been added yet.


----------------------------------------------------------------------------------------------------


## **API Endpoints**

All under `/api/working-files/:filename/`:

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `dictionary` | Read `{filename}.dictionary.json` (returns `{ words: [] }` if missing) |
| `PUT` | `dictionary` | Write full word array `{ words: string[] }` |
| `POST` | `spellcheck-section` | Spell-check all blocks in a section; returns `{ blocks, unknownWordCount }` |
| `POST` | `spellcheck-block` | Spell-check one block's HTML; returns `{ spellcheckHtml }`. Used after save (view mode), on edit entry, and during debounced re-check while editing. |

The `spellcheck-section` request body includes `sectionIndex`, `href`, and `blocks: [{ tag, html }]`.


----------------------------------------------------------------------------------------------------


## **What Is Not Saved to the Epub**

Spellcheck highlights and the custom dictionary are **session/working-file metadata**, not epub content.

- "Update Epub" does not write highlight spans or dictionary words into xhtml files.
- Reloading the book re-fetches the dictionary from `{filename}.dictionary.json`.
- Reloading a section re-runs spellcheck against current block HTML.


----------------------------------------------------------------------------------------------------


## **Out of Scope (v1)**

- Multi-language Hunspell dictionaries (German, Greek, etc.)
- Grammar checking or suggested replacements
- Spellcheck highlights in the endnotes sidebar
- Global dictionary shared across books
- Dictionary import/export between books
- Batch operations on highlighted words (e.g. "italicize all green words")
- Custom highlights written into the saved epub


----------------------------------------------------------------------------------------------------


## **Files**

| File | Role |
|------|------|
| `server/index.js` | `nspell` init, `spellcheckBlockHtml`, `spellcheckBlocks`, dictionary read/write, API endpoints |
| `src/views/ReaderView.tsx` | Dictionary state, spellcheck toggle, section sync, Dictionary modal, add/remove handlers, `fetchSpellcheckHtml` callback |
| `src/components/viewer/TextBlock.tsx` | Renders `spellcheckHtml` in view mode; word selection click handler; passes spellcheck props to editor |
| `src/components/viewer/richText/TextBlockRichEditor.tsx` | TipTap editor; `spellcheck="false"`; registers spellcheck decoration extension |
| `src/components/viewer/richText/SpellcheckDecoration.ts` | ProseMirror plugin for inline `.spell-unknown` decorations |
| `src/components/viewer/richText/spellcheckRanges.ts` | Parses server `spellcheckHtml` into ProseMirror position ranges |
| `src/components/viewer/richText/useEditModeSpellcheck.ts` | Edit-entry fetch, debounced re-check, hide-while-stale, race-safe decoration updates |
| `src/components/viewer/TextBlockToolbar.tsx` | "Add to Dictionary" button when a word is selected |
| `src/components/TopBar.tsx` | Spellcheck checkbox and Dictionary button |
| `src/components/Modal.tsx` | Dictionary modal shell |
| `src/types/reader.ts` | `spellcheckHtml?` on `TextBlock` |
| `src/index.css` | `.spell-unknown`, `.spell-dictionary`, `.spell-selected`; `.tiptap .spell-unknown` for edit mode |
| `workingFiles/{book}.epub.dictionary.json` | Per-book custom dictionary (created on first add) |


----------------------------------------------------------------------------------------------------


## **Relationship to Other Features**

- **Viewer and TextBlock** ([PRD 1.3](PRD_1.3_Viewer_and_Text_Block.md)): Spellcheck layers on block rendering in both view and edit mode. View mode uses `spellcheckHtml` spans; edit mode uses TipTap with server-driven decorations. Clicking a highlighted word in view mode selects it for dictionary add (does not enter edit mode). Queue actions, save path, and Power Mode are otherwise unchanged.
- **Sections** (PRD 1.2): Spellcheck runs per section as sections are loaded or navigated to. The section sidebar row click triggers server sync even for already-loaded sections.
- **Endnotes** (PRD 1.4): Endnote placeholder text in body blocks is spell-checked like any other inline HTML. Endnote sidebar content is out of scope for v1.


----------------------------------------------------------------------------------------------------


## **Dev Environment Note**

EasyPub dev runs two processes: Vite on **5173** and the Express API on **5174**. If server-side features stop working after a restart, a stale process may still be holding a port. See [Johannes.md](../../0_AI-Infra/Johannes.md) (Stale dev servers section).


----------------------------------------------------------------------------------------------------


## **Tickets**

Implementation and follow-up work are tracked in:

| Ticket | Path | Status |
|--------|------|--------|
| **106 — Spellcheck Highlights** | [3_Tickets/106_Spellcheck-Highlights.md](../3_Tickets/106_Spellcheck-Highlights.md) | Implemented (view-mode highlights, dictionary, server-side spellcheck) |
| **107 — Spellcheck lines not displaying in edit mode** | [3_Tickets/107_Spellcheck-lines-not-displaying-in-edit-mode.md](../3_Tickets/107_Spellcheck-lines-not-displaying-in-edit-mode.md) | Implemented (edit-mode decorations, debounced re-check, browser spellcheck disabled) |

When in doubt about intended behavior, this PRD is the source of truth. Tickets describe how a feature was built or what still needs to be done.
