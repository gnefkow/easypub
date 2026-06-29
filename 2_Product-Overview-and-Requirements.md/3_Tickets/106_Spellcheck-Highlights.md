---
**Keywords**: spellcheck, spell check, dictionary, custom dictionary, misspelled, highlights, view mode, nspell, Hunspell, OCR artifacts, jammed words, foreign words, Greek, German, philosophy, per-book dictionary, TextBlock, dangerouslySetInnerHTML, cheerio, text nodes, word tokenization, highlight spans, server-side, loadSection, TextBlockToolbar, Modal, TopBar, dictionary modal
---

EPUBs sourced from OCR'd PDFs frequently contain "jammed" words -- OCR artifacts where spaces were dropped (e.g. "isa" instead of "is a", "lotof" instead of "lot of"). The browser's built-in spell-check catches these in edit mode (TipTap's `contentEditable`), but in view mode blocks render as plain HTML elements with no spell-check.

Additionally, EasyPub is frequently used for classic philosophy texts (Heidegger, Aristotle, etc.) that contain intentional non-English words (German: *Dasein*, *Aufhebung*; Greek: *poiēsis*, *λόγος*) and made-up philosophical terms. These are flagged as misspelled by a spell-checker, but they're not errors -- they still need to be visible so the user can verify correctness (e.g. confirming it's "poiēsis" not "poiesis", or batch-italicizing all German words).

This ticket adds a **three-tier word highlighting system** for view-mode blocks:

1. **Known English words** -- no highlight, they're correct
2. **Custom dictionary words** -- **green highlight**, confirming "this is intentional, I've reviewed it"
3. **Unknown words** -- **red highlight**, flagging "this is probably wrong or needs review"

The custom dictionary is **per-book** because different texts have different vocabularies.


----------------------------------------------------------------------------------------------------


## **Requirements**

1. **Highlight unknown words in view-mode blocks** with a red indicator (underline or background). Only text blocks -- not images, not edit-mode blocks.
2. **Per-book custom dictionary**: Users can add words to a dictionary scoped to the current epub. Dictionary words highlight green instead of red.
3. **Add-to-dictionary interaction**: User clicks a red-highlighted word to select it, then clicks an "Add to Dictionary" button in the block's `TextBlockToolbar` to add the word. The word (and all matching words across all visible blocks) turns green.
4. **Remove-from-dictionary interaction**: User can remove words from the dictionary via the Dictionary modal (see below). Removed words revert to red highlights.
5. **Toggle on/off**: A control to enable/disable spell-check highlights. When disabled, blocks render as they do today.
6. **Dictionary persists across sessions**: Closing and reopening the same book should preserve the custom dictionary.
7. **Dictionary modal**: A "Dictionary" button in the TopBar opens a centered modal (using the existing `Modal` component with `modal-overlay` / `modal-card` styling) that displays all words in the custom dictionary. Users can remove individual words from the modal.


----------------------------------------------------------------------------------------------------


## **How It Works**

### **Server-side spell-check**

Spell-check runs on the **server**, not in the browser. The server already parses section HTML with `cheerio` when loading sections. The spell-check step happens in the same pipeline: after the server extracts block HTML, it processes each block's text to wrap flagged words in `<span>` elements before sending the response to the client.

The client receives blocks with highlight markup already baked into the HTML. No dictionary loading, no spell-check library, no HTML manipulation on the client side.

**Why server-side?**

- `cheerio` is already a server dependency and handles HTML manipulation robustly (including messy epub HTML, inline elements, entities). Browser-side `DOMParser` on HTML fragments is flakier.
- `nspell` (a well-maintained Node Hunspell library) replaces `typo.js` (an older, unmaintained browser port). The dictionary loads once on server startup and stays in memory.
- The browser never loads a 2-3MB dictionary file.
- The architecture is cleaner: the client stays dumb ("here's HTML, render it") and the server does all the heavy lifting, consistent with how endnotes and block parsing already work.

### **Spell-check engine**

`nspell` loaded with an `en_US` Hunspell dictionary. Initialized once on server startup, cached in memory. For each word in a block's text content:

- Word is in the en_US dictionary → no highlight
- Word is in the custom dictionary → green `<span class="spell-dictionary">`
- Word is in neither → red `<span class="spell-unknown">`

Words that are all-punctuation, all-digits, or single characters are skipped.

### **HTML processing (server-side with cheerio)**

Block HTML contains inline markup (`<strong>`, `<em>`, `<sup>`, `<sub>`, `<br>`, `<a>`). The spell-check processing:

1. Load block HTML into cheerio
2. Walk only **text nodes** (not element names, attributes, etc.)
3. Tokenize text nodes into words (split on whitespace and word boundaries)
4. Check each word against the en_US dictionary and the custom dictionary
5. Wrap flagged words in highlight `<span>` elements
6. Serialize back to an HTML string

The server sends **two versions** of each block's HTML to the client:

- `block.html` -- the original, unmodified HTML (used for editing, queue actions, saving)
- `block.spellcheckHtml` -- the highlighted version (used for view-mode rendering when spell-check is enabled)

This keeps spell-check completely decoupled from the edit and queue systems. The original `block.html` is never touched by spell-check.

### **When spell-check runs**

Sections are loaded **one at a time, on demand** (not the whole book at once). The typical workflow is: open a book, open one section, edit/save/reload that section across several sessions. Spell-check processes **one section per load call** -- typically 30-80 blocks, a couple thousand words. At microseconds per word lookup, this adds negligible latency (~2-5ms) to the existing section load.

Spell-check runs:

- **On section load**: When the server responds to a section load request, it includes `spellcheckHtml` alongside `html` for each block.
- **On single-block re-check after edit**: When a user edits a block and saves, the new block HTML hasn't been spell-checked. A small API call sends the new HTML to the server and gets back the highlighted version for just that one block. This is fast (~10-20ms including network round-trip on localhost).

### **Dictionary add/remove: instant on the client**

When the user adds "Dasein" to the dictionary, the client doesn't need to re-spell-check anything. The flagged words are already wrapped in `<span>` elements with classes (`spell-unknown` or `spell-dictionary`). The client simply:

1. Finds every `<span class="spell-unknown">` in the DOM whose text content matches "Dasein"
2. Swaps the class to `spell-dictionary`
3. Fires off a `PUT /dictionary` to persist the change (fire-and-forget)

The UI updates instantly. No server round-trip needed for the visual change. Same in reverse for removing a word (from the Dictionary modal).

### **UI for add/remove**

**Adding a word** happens through the block toolbar (`TextBlockToolbar`):

1. User sees a red-highlighted word in a view-mode block
2. User clicks the red word -- this "selects" it (visually indicated, e.g. a stronger highlight or outline) and **does not** enter edit mode
3. The `TextBlockToolbar` (which is already visible on hover/focus) shows an "Add to Dictionary" button
4. User clicks the button → the word is added to the dictionary, all matching words across all visible blocks turn green, the selection clears

The "Add to Dictionary" button only appears in the toolbar when a spell-highlighted word is selected. When nothing is selected, the toolbar looks the same as today.

Clicking anywhere else in the block (not on a highlighted word) enters edit mode as normal.

**Viewing and removing words** happens through the Dictionary modal:

1. User clicks a "Dictionary" button in the TopBar
2. A centered modal opens (using the existing `Modal` component, which renders via `createPortal` with `modal-overlay` / `modal-card` styling)
3. The modal title is "Dictionary" and displays the word count (e.g. "Dictionary (14 words)")
4. The modal shows the custom dictionary as a list of words, each with a "Remove" button
5. Removing a word updates the dictionary state, swaps all matching `spell-dictionary` spans back to `spell-unknown` in the DOM, and persists to the server
6. The modal closes with the X button or by clicking the overlay

### **Per-book dictionary storage**

A JSON file stored alongside each epub in the `workingFiles/` directory:

```
workingFiles/
  my-heidegger-book.epub
  my-heidegger-book.epub.dictionary.json    ← NEW
```

The dictionary file is a simple JSON array of strings:

```json
["Dasein", "Aufhebung", "Vorhandenheit", "Zuhandenheit", "poiēsis", "λόγος", "alētheia"]
```

Server endpoints handle read/write. The dictionary file is created on first add and lives independently of the epub -- saving/updating the epub does not touch it. This avoids coupling dictionary state to the queue/save pipeline.

### **Why server-side storage, not localStorage**

EasyPub may eventually be packaged as an Ionic app. `localStorage` is available in Ionic's WebView, but it's not the most robust storage for mobile (can be cleared by the OS under storage pressure, no backup/sync story). Storing per-book dictionaries as files on the server:

- Naturally scopes to each book (filename-based)
- Survives browser cache clears
- Would transfer cleanly to an Ionic + local filesystem architecture
- Keeps the pattern consistent with other per-book server data (history, endnotes)


----------------------------------------------------------------------------------------------------


## **Open Questions**

1. **Highlight styling**: Red/green underline (like browser spell-check) or red/green background highlight? Underline is subtler and familiar. Background is more scannable. The user mentioned "highlights" -- leaning toward a subtle background or a wavy underline styled via CSS.
2. **Case sensitivity in dictionary**: Is "Dasein" the same as "dasein"? Probably yes for lookup purposes (case-insensitive match), but store the user's original casing for display in the Dictionary modal.
3. **Selected-word visual indicator**: When the user clicks a red/green word to "select" it before clicking "Add to Dictionary," what does the selection look like? Options: a stronger underline/outline, a brighter background, a ring. Should be visually distinct from both `spell-unknown` and `spell-dictionary` states.
4. **Dictionary modal layout**: Should the word list be alphabetically sorted? Grouped by any criteria? For v1, alphabetical is probably fine. Could add word count (how many times the word appears across loaded blocks) later.


----------------------------------------------------------------------------------------------------


## **Decisions Made**

- **Server-side spell-check, not client-side**: Spell-check runs on the server during section load, using `cheerio` (already a dependency) for HTML manipulation and `nspell` (well-maintained Node Hunspell library) for word checking. The browser never loads a dictionary, never parses HTML for spell-check, and never runs a spell-check library. This is cleaner, more robust, and avoids the hackiness of client-side HTML string surgery.
- **Per-book dictionary, not global**: Different books have radically different vocabularies. A Heidegger text and an Aristotle text would pollute each other's dictionaries. Users can re-add common terms per book -- this is a minor cost compared to the confusion of a polluted global dictionary.
- **Two HTML versions per block**: The server sends `block.html` (original, for editing/saving) and `block.spellcheckHtml` (highlighted, for view-mode display). Spell-check never touches the original HTML. The edit and queue systems are completely unaware of spell-check.
- **Client-side class swap for dictionary changes**: Adding/removing a dictionary word is an instant DOM operation (swap `spell-unknown` ↔ `spell-dictionary` class). No server round-trip needed for the visual update. The dictionary change is persisted to the server in the background.
- **Server-side dictionary storage**: JSON files in `workingFiles/`, not `localStorage`. More portable, consistent with existing per-book data patterns, survives browser resets.
- **English-only**: One `en_US` dictionary. No multi-language spell-check. Foreign words are handled via the custom dictionary (green highlights), not by loading additional Hunspell dictionaries.
- **View-mode text blocks only (v1)**: Images, edit-mode blocks, and the endnotes sidebar are excluded from v1. These can be added as follow-ups if useful.
- **Add-to-dictionary via block toolbar**: The "Add to Dictionary" button lives in the existing `TextBlockToolbar` component (the bar that appears on hover/focus for each block). The user clicks a highlighted word to select it, then clicks the toolbar button. This keeps the interaction consistent with other block-level actions (tag changes, append, delete) and avoids introducing a new floating popover/tooltip component.
- **Dictionary modal via TopBar**: The dictionary viewer is a centered modal using the existing `Modal` component (`modal-overlay` / `modal-card` CSS, `createPortal` rendering). Opened by a "Dictionary" button in the TopBar. This is where users go to review and remove words -- a dedicated view for dictionary management, separate from the inline add-to-dictionary flow.
- **Clicking a highlighted word selects it, does not enter edit mode**: When spell-check is enabled and the user clicks a `spell-unknown` or `spell-dictionary` span, the click is intercepted before it reaches the block's edit-mode handler. The word is "selected" (visually indicated) and the toolbar shows the "Add to Dictionary" button. Clicking elsewhere in the block still enters edit mode as normal.


----------------------------------------------------------------------------------------------------


## **Trade-Offs**

- **HTML processing complexity**: Walking text nodes and wrapping words in `<span>` elements without breaking existing inline markup (`<strong>`, `<em>`, nested tags) is the trickiest part of the implementation. Edge cases include: words split across inline elements (e.g. `<em>Dase</em>in`), HTML entities, and punctuation-adjacent words. Using `cheerio` on the server is significantly more robust than browser-side `DOMParser` for HTML fragments, but edge cases will still surface. A pragmatic v1 handles the common cases and refines as needed.
- **Two HTML fields per block**: Sending both `html` and `spellcheckHtml` roughly doubles the payload size per block. For typical blocks (a paragraph of text), this is negligible. For a section with 80 blocks, the extra data is maybe 50-100KB. Not a concern for localhost, and acceptable for future networked setups.
- **Per-book vs. global dictionary**: Per-book means re-adding common terms for each new book. This is a deliberate trade-off -- global dictionaries accumulate noise. A future enhancement could offer "import dictionary from another book" or a separate "global terms" list, but v1 stays simple.
- **Single-block re-check after edit**: When a user edits and saves a block, the new HTML needs spell-checking. This requires a small API call to the server. The alternative (a lightweight client-side fallback for single blocks) would avoid the round-trip but re-introduce client-side spell-check complexity. The API call is ~10-20ms on localhost -- imperceptible -- so the server-only approach is cleaner.
- **Dictionary files on disk**: Each book gets a `.dictionary.json` file in `workingFiles/`. This could accumulate over time if many books are loaded. The files are tiny (a few KB each) so this isn't a real concern, but a future cleanup mechanism could remove dictionary files for books that are no longer in `workingFiles/`.


----------------------------------------------------------------------------------------------------


## **Out of Scope**

- Multi-language spell-check (loading German, Greek, or other Hunspell dictionaries)
- Grammar checking or style suggestions
- Auto-correct or suggested replacements for misspelled words
- Spell-check in edit mode (TipTap) -- the browser already handles this
- Spell-check in the endnotes sidebar (future follow-up)
- Global dictionary shared across books (future follow-up if needed)
- Dictionary import/export between books
- Batch operations on highlighted words (e.g. "italicize all green words")


----------------------------------------------------------------------------------------------------


## **Implementation**

### **Files to Modify**

- **`package.json`** -- Add `nspell` dependency (server-side Hunspell library)
- **`server/index.js`** -- Spell-check engine, dictionary endpoints, integration into section load pipeline, single-block re-check endpoint
- **`src/types/reader.ts`** -- Add `spellcheckHtml` field to `TextBlock` type
- **`src/components/viewer/TextBlock.tsx`** -- Render `spellcheckHtml` when spell-check is enabled, click handler to select highlighted words, selected-word state
- **`src/components/viewer/TextBlockToolbar.tsx`** -- Add "Add to Dictionary" button (shown when a highlighted word is selected)
- **`src/views/ReaderView.tsx`** -- State for custom dictionary, spell-check toggle, selected word, dictionary CRUD handlers, fetch dictionary on book load, single-block re-check after edit, dictionary modal open/close
- **`src/components/TopBar.tsx`** -- Spell-check toggle control + "Dictionary" button to open the dictionary modal
- **`src/index.css`** -- Highlight styles for `.spell-unknown` (red), `.spell-dictionary` (green), and `.spell-selected` (selected word indicator) words

### **Files to Create**

- **`server/dictionaries/en_US.aff`** and **`server/dictionaries/en_US.dic`** -- Hunspell dictionary files, loaded by `nspell` on server startup


### **Step 1: Spell-check engine on the server (`server/index.js`)**

**1a. Initialize `nspell` on startup**

Load the `en_US.aff` and `en_US.dic` files from `server/dictionaries/` and create a single `nspell` instance. This happens once when the server starts and stays in memory.

```javascript
import nspell from 'nspell'

const affData = await fs.readFile(path.join(__dirname, 'dictionaries/en_US.aff'))
const dicData = await fs.readFile(path.join(__dirname, 'dictionaries/en_US.dic'))
const spellchecker = nspell(affData, dicData)
```

**1b. Create `spellcheckBlockHtml(html, customDictionary)` function**

Takes a block's raw HTML string and the custom dictionary array. Returns the highlighted HTML string.

1. Load HTML into cheerio: `const $ = cheerio.load(html, null, false)` (fragment mode, no `<html>/<body>` wrapper)
2. Find all text nodes by walking the DOM tree recursively
3. For each text node, tokenize into words using a regex like `/[\p{L}\p{M}]+/gu` (Unicode-aware, catches Greek, German, accented characters)
4. For each word:
   - Skip if single character, all digits, or all punctuation
   - Check custom dictionary first (case-insensitive): if match → wrap in `<span class="spell-dictionary" data-word="originalWord">`
   - Check `spellchecker.correct(word)`: if true → no wrap
   - Otherwise → wrap in `<span class="spell-unknown" data-word="originalWord">`
5. Replace the text node content with the processed HTML (using cheerio's `.replaceWith()`)
6. Return `$.html()`

The `data-word` attribute stores the original word for the client-side click handler (so the client knows which word to add/remove from the dictionary without parsing the text content).

**1c. Create `spellcheckSection(blocks, customDictionary)` function**

Takes an array of parsed blocks and the custom dictionary. Returns the same array with `spellcheckHtml` populated on each text block.

```javascript
const spellcheckSection = (blocks, customDictionary) => {
  return blocks.map(block => {
    const tag = block.tag.toLowerCase()
    if (tag === 'img') return block
    return {
      ...block,
      spellcheckHtml: spellcheckBlockHtml(block.html, customDictionary),
    }
  })
}
```


### **Step 2: Dictionary API endpoints (`server/index.js`)**

Two new endpoints, following the existing `/api/working-files/:filename/` pattern:

**`GET /api/working-files/:filename/dictionary`**
- Read `{filename}.dictionary.json` from `workingFiles/`
- If file doesn't exist, return `{ words: [] }`
- If file exists, return `{ words: ["Dasein", "poiēsis", ...] }`

**`PUT /api/working-files/:filename/dictionary`**
- Accept `{ words: string[] }` in the request body
- Write to `{filename}.dictionary.json` in `workingFiles/`
- Return `{ ok: true }`

The full dictionary array is sent on every write (not individual add/remove operations). This keeps the API simple -- the frontend manages the array in state and syncs the whole thing.


### **Step 3: Single-block re-check endpoint (`server/index.js`)**

**`POST /api/working-files/:filename/spellcheck-block`**
- Accept `{ html: string }` in the request body
- Read the book's custom dictionary from `{filename}.dictionary.json`
- Run `spellcheckBlockHtml(html, customDictionary)`
- Return `{ spellcheckHtml: "..." }`

Called after a user edits and saves a block, so the new block HTML gets spell-checked without reloading the full section.


### **Step 4: Integrate into section load pipeline (`server/index.js`)**

The server already has a section-loading pathway that the client calls. After blocks are parsed from the section HTML, run `spellcheckSection(blocks, customDictionary)` before returning the response.

The dictionary for the current book is loaded from `{filename}.dictionary.json` at the start of the section load handler. If spell-check is disabled (a query parameter or client preference), skip the spell-check step and return blocks without `spellcheckHtml`.

> **Note**: The exact integration point depends on where block parsing happens. Currently, block parsing happens client-side in `parseSectionBlocks()` in `ReaderView.tsx` -- the server returns raw section HTML and the client parses it into blocks. There are two options for integration:
>
> - **Option A**: Move block parsing to the server (cleaner long-term, but a larger refactor)
> - **Option B**: Add a new endpoint that accepts already-parsed block HTML strings and returns them with spell-check highlights (smaller change, keeps block parsing client-side)
>
> Option B is the pragmatic v1 choice. The client parses blocks as it does today, then sends the block HTML strings to a spell-check endpoint. This adds one extra API call per section load but avoids restructuring the load pipeline.


### **Step 5: TextBlock type and rendering**

**`src/types/reader.ts`** -- Add `spellcheckHtml` to the `TextBlock` type:

```typescript
export type TextBlock = {
  // ... existing fields ...
  spellcheckHtml?: string
}
```

**`src/components/viewer/TextBlock.tsx`** -- In the view-mode rendering branch:

- If `spellcheckEnabled` is true and `block.spellcheckHtml` exists, use `block.spellcheckHtml` for `dangerouslySetInnerHTML` instead of `block.html`
- Add a click handler on the `<Tag>` element that intercepts clicks on highlighted words:
  - If the click target is a `.spell-unknown` or `.spell-dictionary` span: **do not enter edit mode**. Instead, "select" the word -- set `selectedSpellWord` state to the word from the span's `data-word` attribute, and add a `.spell-selected` CSS class to visually indicate the selection.
  - If the click target is anything else: proceed to edit mode as normal (existing behavior).
- Clicking outside the block (or clicking a non-highlighted area) clears the selection.

New props on `TextBlock`:

```typescript
spellcheckEnabled: boolean
selectedSpellWord: string | null
onSelectSpellWord: (word: string | null) => void
onAddToDictionary: (word: string) => void
```

These are threaded down from `ReaderView` → `Viewer` → `Section` → `TextBlock`.


### **Step 6: "Add to Dictionary" in the toolbar (`TextBlockToolbar.tsx`)**

Add an "Add to Dictionary" button to `TextBlockToolbar`. This button is **conditionally visible** -- it only appears when `selectedSpellWord` is non-null (i.e. the user has clicked a highlighted word in this block).

The button sits in the right-side action group alongside the existing buttons (Add, Append, Delete). It could use a `BookPlus` or `BookmarkPlus` icon from `lucide-react`.

New props on `TextBlockToolbar`:

```typescript
selectedSpellWord: string | null
onAddToDictionary: (word: string) => void
```

When clicked:
1. Calls `onAddToDictionary(selectedSpellWord)`
2. The parent handler adds the word to `customDictionary` state, swaps all matching `.spell-unknown` spans to `.spell-dictionary` in the DOM, persists to server, and clears `selectedSpellWord`


### **Step 7: Dictionary modal**

The Dictionary modal uses the existing `Modal` component (`src/components/Modal.tsx`). It is opened by a "Dictionary" button in the TopBar and managed by state in `ReaderView`.

**Modal content:**
- Title: "Dictionary" with a word count badge (e.g. "Dictionary (14 words)")
- Word list: Alphabetically sorted list of all words in `customDictionary`
- Each word row shows the word text and a "Remove" button (tertiary variant, small, with a `Trash2` or `X` icon)
- Clicking "Remove" removes the word from `customDictionary`, swaps all matching `.spell-dictionary` spans back to `.spell-unknown` in the DOM, and persists to server
- If the dictionary is empty, show a simple empty state message (e.g. "No words added yet. Click a highlighted word in the viewer to add it.")
- The modal closes via the X button or clicking the overlay background

The modal does **not** need its own component file -- it can be rendered inline in `ReaderView` using the existing `Modal` component, similar to how `ProgressBox` is used:

```typescript
<Modal
  open={dictionaryModalOpen}
  title={`Dictionary (${customDictionary.length} words)`}
  onClose={() => setDictionaryModalOpen(false)}
  widthClassName="max-w-lg"
>
  {/* word list with remove buttons */}
</Modal>
```


### **Step 8: State management (`ReaderView.tsx`)**

Add to `ReaderView` state:

```typescript
const [customDictionary, setCustomDictionary] = useState<string[]>([])
const [spellcheckEnabled, setSpellcheckEnabled] = useState(false)
const [selectedSpellWord, setSelectedSpellWord] = useState<string | null>(null)
const [dictionaryModalOpen, setDictionaryModalOpen] = useState(false)
```

**On book load** (`loadWorkingFile`): Fetch `GET /api/working-files/:filename/dictionary` and populate `customDictionary`.

**Add word handler**:
```typescript
const handleAddToDictionary = (word: string) => {
  const next = [...customDictionary, word]
  setCustomDictionary(next)
  setSelectedSpellWord(null)
  // instant DOM class swap: spell-unknown → spell-dictionary for all matching words
  document.querySelectorAll(`[data-word="${CSS.escape(word)}"].spell-unknown`)
    .forEach(el => { el.classList.replace('spell-unknown', 'spell-dictionary') })
  // fire-and-forget PUT to server
  fetch(`/api/working-files/${encodeURIComponent(selectedWorkingFile)}/dictionary`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ words: next }),
  })
}
```

**Remove word handler** (from Dictionary modal): Same pattern, filtering the word out of the array and swapping `spell-dictionary` → `spell-unknown`.

**After edit commit**: When `onRequestCommitEdit` fires and the block HTML changes, call `POST /api/working-files/:filename/spellcheck-block` with the new HTML, then update the block's `spellcheckHtml` in state.

Pass props down through `Viewer` → `Section` → `TextBlock`:
- `spellcheckEnabled`
- `selectedSpellWord`
- `onSelectSpellWord`
- `onAddToDictionary`


### **Step 9: TopBar updates (`TopBar.tsx`)**

Add two controls to the TopBar:

1. **Spell-check toggle**: Near the existing Language selector. A small checkbox or toggle switch labeled "Spellcheck". Props: `spellcheckEnabled`, `onToggleSpellcheck`.

2. **"Dictionary" button**: A `<Button variant="secondary">` labeled "Dictionary", placed near the "Endnotes" button. Props: `onShowDictionary`. Clicking it calls `setDictionaryModalOpen(true)` in `ReaderView`.

When spell-check is toggled off, `TextBlock` renders raw `block.html` as it does today (ignores `spellcheckHtml`). The "Dictionary" button stays visible regardless of the toggle state (the user might want to review their dictionary without highlights active).


### **Step 10: Highlight styles (`index.css`)**

Add to the `@layer components` block:

```css
.spell-unknown {
  text-decoration: underline wavy;
  text-decoration-color: var(--fg-danger, #ef4444);
  text-underline-offset: 2px;
  cursor: pointer;
}

.spell-dictionary {
  background-color: color-mix(in srgb, var(--fg-success, #22c55e) 15%, transparent);
  border-radius: 2px;
  cursor: pointer;
}

.spell-selected {
  outline: 2px solid var(--fg-primary, #3b82f6);
  outline-offset: 1px;
  border-radius: 2px;
}
```

These are starting points -- exact styling is an open question (see Open Questions above). The red wavy underline is familiar from browser spell-check. The green background is subtle enough not to be distracting but scannable when looking for foreign terms. The `.spell-selected` outline provides a clear visual indicator that a word has been clicked and is ready to be added to the dictionary.


----------------------------------------------------------------------------------------------------


## **Data Flow**

```
SECTION LOAD (server-side spell-check):
  Client calls loadSection → epubjs renders section HTML
  → client parses blocks (parseSectionBlocks, as today)
  → client sends block HTML strings to POST /spellcheck-section
  → server loads custom dictionary from {filename}.dictionary.json
  → server runs spellcheckBlockHtml on each block using nspell + cheerio
  → server returns { blocks: [{ html, spellcheckHtml }, ...] }
  → client stores spellcheckHtml on each block in state
  → TextBlock renders spellcheckHtml when spellcheckEnabled is true

DICTIONARY ADD (via block toolbar):
  User clicks red <span class="spell-unknown" data-word="Dasein">
  → word is "selected" (spell-selected class added, edit mode NOT entered)
  → toolbar shows "Add to Dictionary" button
  → user clicks "Add to Dictionary"
  → client swaps class to "spell-dictionary" on ALL matching spans in DOM (instant)
  → client adds "Dasein" to customDictionary state
  → client clears selectedSpellWord
  → client fires PUT /dictionary to persist (fire-and-forget)

DICTIONARY REMOVE (via Dictionary modal):
  User clicks "Dictionary" button in TopBar → modal opens
  → user clicks "Remove" next to "Dasein"
  → client swaps class to "spell-unknown" on ALL matching spans in DOM (instant)
  → client removes "Dasein" from customDictionary state
  → client fires PUT /dictionary to persist (fire-and-forget)

BLOCK EDIT + RE-CHECK:
  User edits block in TipTap → saves → new block.html
  → client sends POST /spellcheck-block with new HTML
  → server returns { spellcheckHtml: "..." }
  → client updates block.spellcheckHtml in state
  → TextBlock re-renders with new highlights

TOGGLE OFF:
  User disables spell-check
  → TextBlock renders block.html instead of block.spellcheckHtml
  → no server calls, no DOM manipulation
```


----------------------------------------------------------------------------------------------------


## **Summary of Changes**

| Addition | Where | Description |
|----------|-------|-------------|
| `nspell` | `package.json` | Server-side Hunspell spell-check library |
| `en_US.aff`, `en_US.dic` | `server/dictionaries/` | Hunspell dictionary files, loaded once on server startup |
| `spellcheckBlockHtml()` | `server/index.js` | Core engine: word checking + cheerio HTML highlight wrapping |
| `spellcheckSection()` | `server/index.js` | Batch spell-check for all blocks in a section |
| Dictionary endpoints | `server/index.js` | `GET` and `PUT` for per-book `{filename}.dictionary.json` |
| Spellcheck-block endpoint | `server/index.js` | `POST` for single-block re-check after edit |
| `spellcheckHtml` field | `src/types/reader.ts` | Optional highlighted HTML on `TextBlock` type |
| Spell-check state | `ReaderView.tsx` | `customDictionary`, `spellcheckEnabled`, `selectedSpellWord`, `dictionaryModalOpen`, add/remove handlers, fetch dictionary on load, re-check after edit |
| Highlight word selection | `TextBlock.tsx` | Click handler intercepts clicks on highlighted words, sets selected word, prevents edit mode |
| "Add to Dictionary" button | `TextBlockToolbar.tsx` | Conditionally visible when a highlighted word is selected |
| Dictionary modal | `ReaderView.tsx` | Inline `<Modal>` using existing component, shows word list with remove buttons |
| Toggle + Dictionary button | `TopBar.tsx` | Spell-check on/off toggle + "Dictionary" button to open modal |
| Highlight CSS | `index.css` | `.spell-unknown` (red wavy underline), `.spell-dictionary` (green background), `.spell-selected` (selection outline) |
