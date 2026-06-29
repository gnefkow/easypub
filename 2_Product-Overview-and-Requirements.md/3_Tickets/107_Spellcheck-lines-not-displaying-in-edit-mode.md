---
**Keywords**: spellcheck, edit mode, view mode, TipTap, contentEditable, browser spell-check, red squiggles, spell-unknown, spell-dictionary, highlights disappear, TextBlock, TextBlockRichEditor, spellcheckHtml, block.html, inline editing, dictionary, PRD 1.6, ticket 106
---

## **Intended behaviour:**
WHEN the user switches a block to "edit mode," THEN they should continue to see spellcheck lines. 

What happens now:
- 1 -> WHEN the user is in default, they can see the red squiggles for mispelled words (this is good, it is our spellchecks system)
- 2 -> WHEN a user first clicks into edit mode, THEN the red squiggles do not render (this is bad, we want to see them). However...
- 3 -> WHEN the user is in edit mode and they make one spelling correction, THEN the red squiggles display on all of the other mispelled words. (this is good)

Note that we have two systems, the non-edit-mode text blocks are using our spellchecksystem from the back end while the edit modes (I believe) is using the front-end logic. 

That is fine, for fixing the issues described in #2 above, we should probably be using the front-end markings (if that is easiest). However, we want them to show up immediately when switching to edit mode, not after the first correction is made. 

--------------------------------------------------------------------------------
## **Design and Rationalle**

### **Root cause**

View mode and edit mode use different spellcheck mechanisms today:

- **View mode** renders server-processed `block.spellcheckHtml` with `.spell-unknown` CSS underlines.
- **Edit mode** mounts `TextBlockRichEditor` with plain `block.html` and relies on browser-native spellcheck on TipTap's `contentEditable`.

That handoff is intentional (PRD 1.6), but browser spellcheck on `contentEditable` is lazy — it often does not paint squiggles until the document is mutated (e.g. the user fixes one word). Hence behaviour #2 above: no lines on entry, lines appear after the first correction.

Layout shift on edit entry (padding, border, hyphenation) is expected and out of scope. This ticket is only about **underlines appearing on the correct words** in edit mode.

### **Chosen approach: server-driven decorations (not document markup)**

Use **ProseMirror inline decorations** in edit mode — a display layer only, not part of the saved document.

We explicitly **reject** initializing TipTap from `spellcheckHtml` or adding a `spell-unknown` mark inside the document model. That would collapse the content/display boundary and invite edge cases (cursor behaviour, copy/paste, undo, marks surviving edits, double underlines if browser spellcheck is still on).

Instead, preserve the same architectural split view mode already uses:

| Layer | View mode | Edit mode |
|-------|-----------|-----------|
| **Content** | `block.html` (via `spellcheckHtml` wrapper in DOM) | `block.html` only in TipTap |
| **Spell visuals** | `.spell-unknown` spans in HTML | ProseMirror **decorations** (overlay) |
| **Source of truth** | Server nspell + dictionary | Same — server nspell + dictionary |

Set **`spellcheck="false"`** on the TipTap editor so browser squiggles do not stack on top of server underlines.

**PRD 1.6 amendment:** Edit mode uses server-derived unknown-word underlines (decorations), not browser-native spellcheck. Dictionary greens remain view-mode only for v1.

### **Why decorations stay on the right words**

Decorations attach to **character positions in the live TipTap document**, not to pixels from view mode. Layout reflow between modes does not cause misalignment.

In a book editor, users will repeat words, insert/delete text, rearrange words, and add or remove line breaks. **Static overlays from edit entry alone would lie almost immediately.** Underlines are correct only when derived from a spellcheck run against the **exact HTML the editor currently holds**.

**Invariant:**

> Current editor HTML → `/spellcheck-block` → parse `spell-unknown` ranges from response → apply decorations → repeat on change.

### **Requirements**

1. **On edit entry:** Immediately POST current block HTML to `/spellcheck-block` and render underlines from the response. Do not rely on cached `spellcheckHtml` unless it was computed from the same HTML the editor is mounting.

2. **While editing:** Debounced re-check (~300–500ms idle) on every content change, sending `editor.getHTML()`. **Replace the entire decoration set** on each response — do not incrementally map old decoration positions across transactions.

3. **During debounce window:** **Hide underlines** until the fresh response arrives. A brief flash without underlines is acceptable; underlines on the wrong word are not.

4. **Range parsing:** Derive ranges by walking `spell-unknown` spans in the server response in document order and mapping plain-text offsets to ProseMirror positions. Do **not** match by word string + occurrence index on the client. Each server-wrapped instance is its own range (handles duplicate words correctly).

5. **Save path unchanged:** `sanitizeInlineHtml` continues to strip all non-inline tags on commit. Decorations never touch `block.html`.

6. **Scope:** Red unknown underlines only in edit mode. No dictionary greens in edit mode for v1.

7. **Performance:** A block is always a single paragraph or heading — typically well under a couple hundred words. Debounced per-block server spellcheck is expected to be fast enough; no client-side nspell or length-based optimisations needed for v1.

### **Acceptance criteria**

- WHEN spellcheck is enabled AND the user enters edit mode, THEN unknown-word underlines appear immediately (without requiring a first keystroke or correction).
- WHEN the user edits text (typing, deleting, line breaks, rearranging), THEN underlines disappear during the debounce window and reappear on the correct words after the server response.
- WHEN the same misspelled word appears multiple times, THEN only the instances flagged by the server are underlined.
- WHEN the user saves, THEN saved HTML contains no spellcheck markup (unchanged from today).
- Browser-native squiggles do not appear alongside server underlines in edit mode.

### **Files likely touched**

- `3_App/src/components/viewer/richText/TextBlockRichEditor.tsx` — decoration plugin, debounced spellcheck, `spellcheck="false"`.
- `3_App/src/components/viewer/TextBlock.tsx` — pass `spellcheckEnabled`, book filename (or a spellcheck callback) into the editor.
- `3_App/src/index.css` — reuse existing `.spell-unknown` styling for decoration class if needed.
- `2_Product-Overview-and-Requirements.md/2_PRD/PRD_1.6_Spellcheck-and-Dictionary.md` — update edit-mode row in scope table.

--------------------------------------------------------------------------------
## **Implementation Plan**

No server changes required — `/api/working-files/:filename/spellcheck-block` already exists and returns `{ spellcheckHtml }`.

### **Step 1: Update PRD 1.6**

In `2_PRD/PRD_1.6_Spellcheck-and-Dictionary.md`, update the **Scope: View Mode vs Edit Mode** table:

| Mode | Spellcheck behavior |
|------|---------------------|
| **View mode** | Server-processed highlights: red unknown, green dictionary |
| **Edit mode** | Server-derived red unknown underlines via ProseMirror decorations (debounced re-check). Browser native spellcheck disabled. No dictionary greens. |

Add a short note under that table: edit-mode underlines are a display layer only — they never modify `block.html`.


### **Step 2: Range parser utility (`spellcheckRanges.ts`)**

Create `3_App/src/components/viewer/richText/spellcheckRanges.ts`.

Two exported functions:

**`extractUnknownTextRanges(spellcheckHtml: string): { start: number; end: number }[]`**

Walk the parsed HTML fragment in document order, maintaining a plain-text character offset (same order a user reads the text — text nodes and `.spell-unknown` span contents only, no block-element separators unless they produce text in the DOM). For each `.spell-unknown` span, push `{ start, end }` where `start`/`end` are plain-text offsets covering the span's text content.

Do **not** look up words by string. Each span in the server response is one range.

**`textRangesToProseMirrorPositions(doc: ProseMirrorNode, ranges: { start: number; end: number }[]): { from: number; to: number }[]`**

Walk the ProseMirror document's text nodes in order, map plain-text offsets to `{ from, to }` PM positions. Skip ranges that fall outside the doc (defensive — should not happen if the spellcheck HTML was computed from this editor state).

Add a small unit-style test or inline dev assertion if the project has no test runner for utilities — at minimum, manually verify with a string like `"the the"` where only one instance is wrapped.


### **Step 3: TipTap spellcheck decoration extension (`SpellcheckDecoration.ts`)**

Create `3_App/src/components/viewer/richText/SpellcheckDecoration.ts`.

A TipTap `Extension` wrapping a ProseMirror `Plugin` that:

- Holds plugin state: `DecorationSet` (initially empty).
- Exposes a command or meta transaction type `setSpellcheckDecorations(ranges: { from: number; to: number }[])` that rebuilds the full `DecorationSet` from inline decorations:

```typescript
Decoration.inline(from, to, { class: 'spell-unknown' })
```

- On `setSpellcheckDecorations([])`, clears all underlines (used during debounce window).
- Does **not** map decorations across transactions — only replaces via the meta dispatch.

Register this extension in `TextBlockRichEditor`'s `useEditor` extensions array.


### **Step 4: Spellcheck fetch hook (`useEditModeSpellcheck.ts`)**

Create `3_App/src/components/viewer/richText/useEditModeSpellcheck.ts`.

Props: `editor`, `spellcheckEnabled`, `fetchSpellcheckHtml: (html: string) => Promise<string | null>`.

Behaviour:

1. **On mount / when `spellcheckEnabled` becomes true:** immediately call `fetchSpellcheckHtml(editor.getHTML())`, parse ranges, dispatch `setSpellcheckDecorations`.
2. **On `editor.on('update')`:** clear decorations immediately (hide underlines), start/restart a debounce timer (~400ms). When the timer fires, call `fetchSpellcheckHtml(editor.getHTML())`, parse ranges, dispatch decorations.
3. **On unmount:** cancel pending debounce, clear decorations.
4. **When `spellcheckEnabled` is false:** clear decorations, do not fetch.
5. **Race safety:** track a request generation counter; ignore responses from stale requests (user typed again while fetch was in flight).
6. **Errors:** silently clear decorations on fetch failure (same as save-path `.catch(() => {})` pattern in `ReaderView`).

The hook does not call `fetch` directly — it receives a callback so `ReaderView` owns the API URL and filename.


### **Step 5: Wire props through the component tree**

**`ReaderView.tsx`**

Add a stable callback (e.g. `useCallback`):

```typescript
const fetchSpellcheckHtml = useCallback(async (html: string) => {
  const filename = selectedWorkingFileRef.current
  if (!filename || !spellcheckEnabled) return null
  const res = await fetch(
    `/api/working-files/${encodeURIComponent(filename)}/spellcheck-block`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html }) }
  )
  const data = await res.json()
  return data?.spellcheckHtml ?? null
}, [spellcheckEnabled])
```

Thread `spellcheckEnabled` and `fetchSpellcheckHtml` through `Viewer` → `Section` → `TextBlock` → `TextBlockRichEditor` (same pattern as existing spellcheck props from ticket 106).

**`TextBlock.tsx`**

Pass to `TextBlockRichEditor`:

```typescript
spellcheckEnabled={spellcheckEnabled}
fetchSpellcheckHtml={fetchSpellcheckHtml}
```


### **Step 6: Update `TextBlockRichEditor.tsx`**

1. Accept new props: `spellcheckEnabled`, `fetchSpellcheckHtml`.
2. Register `SpellcheckDecoration` extension.
3. Call `useEditModeSpellcheck({ editor, spellcheckEnabled, fetchSpellcheckHtml })`.
4. Add `spellcheck="false"` to `editorProps.attributes` to suppress browser-native squiggles.
5. No changes to save/cancel/commit logic — `sanitizeInlineHtml` already strips spell markup.


### **Step 7: CSS (if needed)**

Existing `.spell-unknown` in `index.css` should apply to decoration spans inside `.tiptap`. Verify in the browser — ProseMirror inline decoration spans render inside the contenteditable.

If underlines do not appear (specificity or inheritance issue), add a scoped rule:

```css
.tiptap .spell-unknown {
  text-decoration: underline wavy;
  text-decoration-color: #ef4444;
  text-underline-offset: 2px;
}
```

Do not add `cursor: pointer` in edit mode — these are not clickable dictionary targets.


### **Step 8: Manual test plan**

Prerequisites: dev server running (`npm run dev`), spellcheck toggle on, a block with known misspellings visible in view mode.

1. **Immediate on entry:** Click into a block with red underlines in view mode → underlines appear in edit mode without typing.
2. **No browser squiggles:** Confirm only wavy red server underlines appear (no double marks from browser spellcheck).
3. **Typing debounce:** Type a character → underlines disappear → after ~400ms idle, underlines reappear on correct words.
4. **Duplicate words:** Block containing the same misspelled word twice where only one is wrong (or both are) → only flagged instances underlined.
5. **Fix a word:** Correct a misspelling → after debounce, that word's underline is gone; others remain.
6. **Add/remove text:** Insert a word, delete a paragraph break → underlines track correctly after debounce.
7. **Save:** Save the block → view mode shows updated `spellcheckHtml`; saved HTML in code view has no `.spell-unknown` spans.
8. **Spellcheck off:** Toggle spellcheck off while editing → underlines clear; toggle on → underlines return after fetch.
9. **Cancel:** Escape out of edit mode → no side effects on `block.html` or decorations leaking to view mode.
10. **Server logging:** Terminal `[server]` shows `[spellcheck] Block complete` on edit entry and debounced re-checks.