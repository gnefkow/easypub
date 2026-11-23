---
**Status**: Completed (2026-11-22)
**Keywords**: make-endnote, Make Endnote, convert block to endnote, TextBlock, TextBlockToolbar, ReaderView, handleMakeEndnoteFromBlock, handleSelectAction, EndnotesSidebar, Endnote, delete-block, handleQueueDeleteBlock, queuedForDelete, stripNoterefAnchorsFromBlockHtml, sanitizeInlineHtml, Viewer, powerMode, Cmd+Shift+E, EndnoteBlock, ticket 104, ticket 116
---

## **Overview**
Often times, the text that needs to become an endnote is directly in a `TextBlock`. It is annoying for users to have to copy and paste the text into a new endnote. This makes it easier.

## **How it works**
On hover, each `TextBlock` shows `TextBlockToolbar`. In the toolbar’s trailing `Dropdown` (chevron / more-actions menu — same `dropdownItems` list as **See Code** and **Delete**), we add a **Make Endnote** option.

WHEN the menu item is clicked, THEN `ReaderView`’s `handleSelectAction` runs a new action (e.g. `make-endnote`) that batches:
- Append a new `Endnote` to the `endnotes` state (same pattern as `handleCreateEndnote`), at the bottom of the list in `EndnotesSidebar`. Seed the new note’s `text` from the source block’s `block.html` (inline HTML, like existing endnote editing in `EndnoteBlock` / `handleCommitEndnote`).
- Mark the `TextBlock` for deletion the same way as the existing **Delete** path: `handleDeleteBlock` plus `handleQueueDeleteBlock`, which sets `queuedForDelete` on the block and adds a `delete-block` item to `queueItems` (visible in `QueueSidebar` until **Update Epub** runs the queue).

### **Power mode shortcut**
When `powerMode` is on (`usePowerModeState` → `Viewer`), **⌘⇧E** (in `Viewer.tsx`’s `handleKeyDown`, same listener as Delete / arrow focus) runs the same `make-endnote` batch for the **focused** `TextBlock` (`focusedBlock`), via `onSelectAction` — only when not in block edit mode (mirror the Delete / Backspace guard pattern).

Nothing in this ticket is new functionality. It is a `TextBlockToolbar` menu item and a power-mode shortcut that batch existing `ReaderView` handlers together.


----------------------------------------------------------------------------------------------------


## **Implementation plan**


### **Design choices**

| Topic | Decision |
|-------|----------|
| Shared handler | One `handleMakeEndnoteFromBlock(sectionIndex, block)` in `ReaderView.tsx`; both toolbar and `Viewer` call it via `handleSelectAction(..., 'make-endnote')`. |
| Endnote text | Run `sanitizeInlineHtml(block.html)` (same as `handleSaveHtml`) so the new `Endnote.text` matches inline endnote HTML allowed in `EndnoteBlock` / `sanitizeInlineHtml`. |
| Create vs edit | Append to `endnotes` like `handleCreateEndnote`, but **do not** set `editingEndnoteUid` — content is already filled. **Do** call `setEndnotesOpen(true)` so the user sees the new row in `EndnotesSidebar`. |
| Noterefs in source | Strip noteref / placeholder `<a>` elements from block html before `sanitizeInlineHtml` so endnote body is text only (typical misplaced footnote paragraph). |
| Empty source | If sanitized text is empty or whitespace-only, **no-op** (no new endnote, no delete). |
| Noteref anchor | **Out of scope** — no automatic noteref insertion in body text (ticket 104 “Later”). |
| Delete batch | Call `handleDeleteBlock` then `handleQueueDeleteBlock` with the same args as the existing `delete` branch in `handleSelectAction`. |
| Ineligible blocks | No-op for `hr` and `img` (mirror edit / append constraints). Hide **Make Endnote** in `TextBlockToolbar` when `isHrBlock`; skip shortcut when focused block is `hr` or `img`. |
| Undo / Restore | **Restore** on a `queuedForDelete` block only removes the `delete-block` queue item (`handleRestore`); it does **not** remove the new endnote. Acceptable for v1 (matches “create endnote + delete block” done manually). Document in test plan; do not add coupled undo unless Nefko asks. |
| Server | No server changes — endnotes and `delete-block` already persist on **Update Epub**. |


### **Step 1: Core batch handler (`ReaderView.tsx`)**

- Add `handleMakeEndnoteFromBlock(sectionIndex, block)`:
  1. If `block.tag` is `hr` or `img`, return.
  2. Strip noteref / placeholder `<a>` tags from `block.html` (small helper, e.g. DOM walk or regex aligned with load-time placeholder pattern).
  3. `const text = sanitizeInlineHtml(strippedHtml)`; if `!text.trim()`, return.
  4. `const uid = crypto.randomUUID().slice(0, 4)`; `setEndnotes((prev) => [...prev, { uid, text }])`; `setEndnotesOpen(true)`.
  5. `handleDeleteBlock(sectionIndex, block.id)`.
  6. `handleQueueDeleteBlock(block.href, block.selector, block.tag, block.order, block.blockId)`.
- In `handleSelectAction`, add `if (action === 'make-endnote') { handleMakeEndnoteFromBlock(sectionIndex, block); return }`.
- Fix `handleSelectAction` dependency array if the project uses exhaustive deps for this callback (include the new helper or inline calls like the `delete` branch).


### **Step 2: Chevron menu (`TextBlockToolbar.tsx`)**

- Add to `dropdownItems` (chevron `Dropdown`): `{ id: 'make-endnote', label: 'Make Endnote', onSelect: () => onSelectAction('make-endnote') }`.
- Place it near **Delete** (logical “remove from body” cluster).
- Omit from toolbar when `isHrBlock` (same block as append options). Consider omitting when `tag === 'img'` if the toolbar is shown for image blocks today.


### **Step 3: Power mode shortcut (`Viewer.tsx`)**

- In the existing `powerMode` `keydown` listener (after the Delete / Backspace block, before arrow navigation):
  - `if (e.metaKey && e.shiftKey && (key === 'e' || key === 'E'))`
  - Resolve `current` block from `focusedBlock` / `focusedSectionBlocks` (same as Delete).
  - Guard: not `hr` / `img`; `e.preventDefault()`; `onSelectAction(focusedBlock.sectionIndex, current, 'make-endnote')`.
- Do not fire while `editingBlock` is set (listener already returns early in that branch).


### **Step 4: Manual test plan**

Prerequisites: `npm run dev` (5173 + 5174). Open a working file with body text and the endnotes sidebar available.

1. **Menu — paragraph with text** → **Make Endnote** → block fades (`queuedForDelete`) → new row at bottom of `EndnotesSidebar` with matching text → `QueueSidebar` shows `Delete … block`.
2. **Update Epub** → block removed from section XHTML → endnote appears in saved `endnotes.xhtml` on reload.
3. **Bold/italic in block** → endnote preview keeps allowed inline markup after sanitize.
4. **Restore** on deleted block → block visible again, delete queue item gone → endnote **remains** (expected v1).
5. **Remove** delete item from queue without Restore → confirm UI state stays consistent (block still marked deleted in viewer until Restore — same as plain Delete).
6. **`hr` block** → no **Make Endnote** in chevron menu.
7. **Power mode** → focus a `p` block → **⌘⇧E** → same outcome as menu.
8. **Power mode** → while editing a block, **⌘⇧E** does nothing.
9. **Regression** → plain Delete, Create Endnote, append, spellcheck toolbar unchanged.


### **Step 5: Wrap-up (after ship)**

- Add ticket **Keywords** metadata (e.g. `make-endnote`, `Make Endnote`, `TextBlockToolbar`, `Viewer`, `powerMode`, `handleMakeEndnoteFromBlock`, `EndnotesSidebar`, `sanitizeInlineHtml`, ticket 116`).
- PRD: update [104_Endnotes.md](./104_Endnotes.md) “Later” bullet if this ships; touch [PRD endnotes doc](../2_PRD/) only if behaviour differs from that stub.


----------------------------------------------------------------------------------------------------


## **Files likely touched**

| File | Change |
|------|--------|
| `3_App/src/views/ReaderView.tsx` | `handleMakeEndnoteFromBlock`; `make-endnote` in `handleSelectAction` |
| `3_App/src/components/viewer/TextBlockToolbar.tsx` | **Make Endnote** in chevron `dropdownItems` |
| `3_App/src/components/viewer/Viewer.tsx` | **⌘⇧E** in power-mode `handleKeyDown` |
| `3_App/src/components/viewer/richText/sanitizeInlineHtml.ts` | `stripNoterefAnchorsFromBlockHtml` |


----------------------------------------------------------------------------------------------------


## **Shipped (2026-11-22)**

- **Make Endnote** in chevron `Dropdown` on `TextBlockToolbar` (not for `hr` / `img`).
- `handleMakeEndnoteFromBlock` in `ReaderView.tsx`: strip noterefs → sanitize → skip empty → append endnote → open sidebar → queue delete.
- Power mode **⌘⇧E** in `Viewer.tsx`.
- **Restore** remains decoupled from the new endnote (v1).
- No server changes.

