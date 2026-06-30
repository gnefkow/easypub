---
**Keywords**: indentation, text-indent, space break, hr, thematic break, easypub-styles.css, export CSS, TextBlock, add-block, TextBlockToolbar, Dropdown, Plus button, PRD 1.7, Standard Ebooks
---

This ticket is for implementation of [PRD 1.7 concerning indentation and space breaks](/2_Product-Overview-and-Requirements.md/2_PRD/PRD_1.7_Indentation-and-Space-Breaks.md).

Specifically, these are the things that need to be updated:
- CSS settings for exported Epubs. On export, epubs need to follow the exporting rules set out in the PRD. 
- Proper indentation rendered in Viewer. Text blocks should display as indented in non-edit mode if they will be indented on export. (They will not be indented when in edit mode).
- **Plus-button dropdown with four insert actions** — both **above** and **below** the current block, for both content types:
  1. Add Text Block Above
  2. Add Text Block Below
  3. Add Space Break Above
  4. Add Space Break Below

*Note: we're not going to worry about indentation overrides in this ticket yet.*


----------------------------------------------------------------------------------------------------


## **Design and Rationale**

### **Root cause**

Today EasyPub has no paragraph-indent logic anywhere:

- `easypub-styles.css` only sets hyphenation — no `text-indent` rules ([`ensureEasypubStylesheet` in `server/index.js`](../../3_App/server/index.js))
- The viewer renders all `<p>` blocks flush-left regardless of position in the section ([`TextBlock.tsx`](../../3_App/src/components/viewer/TextBlock.tsx))
- `<hr/>` is not in the allowed block tag list, so existing space breaks in source epubs are invisible and uneditable ([`parseSectionBlocks` in `ReaderView.tsx`](../../3_App/src/views/ReaderView.tsx), [`collectAllowedBlocks` in `server/index.js`](../../3_App/server/index.js))
- The `+` button only inserts a text block **below** the current block — no above/below choice, no space break ([`TextBlockToolbar.tsx`](../../3_App/src/components/viewer/TextBlockToolbar.tsx))

### **Chosen approach**

1. **Export:** Expand `easypub-styles.css` with the SE `core.css` indentation rules from the PRD (`p`, `hr`, `hr + p`, and heading-adjacent exceptions). EasyPub does not ship SE `core.css`; this stylesheet is already linked into every content doc on save.

2. **Viewer:** Compute indent per `<p>` block from its position and the **previous block's tag** — mirroring the CSS sibling selectors, not applying `text-indent` in edit mode. Pass `previousBlock` from `Section.tsx` into `TextBlock`.

3. **Space breaks:** Treat `<hr/>` as a first-class block type — parse it, render it, queue insert/delete for it. User-facing label: **Space Break**; export markup: bare `<hr/>` per PRD.

4. **Plus menu:** Replace the direct `+` click handler with a `Dropdown` offering **four** actions — above **and** below for **both** text blocks and space breaks (see list at top of ticket). Extend `add-block` to support `insertPosition: 'before' | 'after'`; add `add-space-break` with the same position parameter. Both queue actions must work in both directions; there is no “below only” fallback.

### **In scope for this ticket**

| Rule | Viewer | Export CSS |
|------|--------|------------|
| `p` after `p` | Indented | `p { text-indent: 1em }` |
| First `p` in section | Flush | `p:first-child { text-indent: 0 }` |
| `p` after `h1`–`h6` | Flush | `h2 + p, … { text-indent: 0 }` |
| `p` after `<hr/>` | Flush | `hr + p { text-indent: 0 }` |
| Space break insert above/below | Yes | Writes bare `<hr/>` at chosen position |
| Text block insert above/below | Yes | Inserts `<p>` (or `<li>`) at chosen position |

### **Out of scope**

- Block-level indent overrides (`class="continued"`, etc.)
- Poetry, letter, and figcaption indent exceptions
- SE code-style formatting (tabs, attribute order) on export
- Stripping `data-easypub-id` from output (separate gap-analysis item)
- Changing how non-`p` blocks (headings, blockquotes) look beyond indent rules


----------------------------------------------------------------------------------------------------


## **Acceptance criteria**

- WHEN a section contains consecutive `<p>` blocks, THEN all but the first (or those after a break/heading) display with `1em` first-line indent in **view mode**
- WHEN a `<p>` is in **edit mode**, THEN it displays flush-left (no first-line indent), regardless of export intent
- WHEN a `<hr/>` exists in source XHTML, THEN it appears in the viewer as a non-editable block with centered gray `<hr/>` label and can be deleted
- WHEN the user chooses **Add Text Block Above** from the `+` dropdown, THEN a new `<p>` (or `<li>` in lists) is inserted **immediately before** the anchor block, queued for save, and indent recalculates for affected paragraphs
- WHEN the user chooses **Add Text Block Below**, THEN a new `<p>` (or `<li>`) is inserted **immediately after** the anchor block, queued for save, and indent recalculates for affected paragraphs
- WHEN the user chooses **Add Space Break Above**, THEN a bare `<hr/>` is inserted **immediately before** the anchor block and queued for save
- WHEN the user chooses **Add Space Break Below**, THEN a bare `<hr/>` is inserted **immediately after** the anchor block and queued for save
- WHEN a `<p>` directly follows an inserted `<hr/>`, THEN that paragraph is flush-left in view mode and on export (`hr + p`)
- WHEN the epub is saved, THEN `easypub-styles.css` contains the PRD indentation rules and `<hr/>` elements are written as bare self-closing tags


----------------------------------------------------------------------------------------------------


## **Implementation Plan**

### **Step 1: Expand export CSS in `ensureEasypubStylesheet`**

In [`server/index.js`](../../3_App/server/index.js), replace the minimal `cssContent` string with the PRD rules:

```css
body {
  hyphens: auto;
  -webkit-hyphens: auto;
}

p {
  margin: 0;
  text-indent: 1em;
}

hr {
  border: none;
  border-top: 1px solid;
  height: 0;
  margin: 1.5em auto;
  width: 25%;
}

h2 + p,
h3 + p,
h4 + p,
h5 + p,
h6 + p,
hr + p,
p:first-child {
  text-indent: 0;
}
```

Keep `@charset` out for now unless we tackle that as part of a broader SE CSS gap — the PRD example omits it and existing epubs may already have their own stylesheets. Our rules supplement (not replace) book CSS via cascade.

**Verify:** Save an epub → open `easypub-styles.css` in the zip → confirm rules present → spot-check in an ereader or browser that consecutive paragraphs indent and paragraphs after `<hr/>` do not.


### **Step 2: Add `hr` to the block model (client + server)**

**Client — [`ReaderView.tsx`](../../3_App/src/views/ReaderView.tsx) `parseSectionBlocks`:**
- Add `'HR'` to `allowedTags`
- For `hr` elements: push a block with `tag: 'hr'`, `html: ''` (no inner content), same id/selector/href fields as other blocks

**Server — [`server/index.js`](../../3_App/server/index.js):**
- Add `'hr'` to `allowedTags` in `collectAllowedBlocks` so `findBlockByIndex`, delete, and insert logic treat `<hr/>` as a peer block

**Types — [`reader.ts`](../../3_App/src/types/reader.ts):**
- Add `'add-space-break'` to queue action union
- Add required `insertPosition: 'before' | 'after'` on both `add-block` and `add-space-break` queue items — same field name and semantics for both actions


### **Step 3: Create `paragraphIndent.ts` utility**

New file: [`3_App/src/views/reader/paragraphIndent.ts`](../../3_App/src/views/reader/paragraphIndent.ts)

```typescript
export function shouldIndentParagraph(
  tag: string,
  blockIndex: number,
  previousBlockTag: string | null
): boolean
```

Logic (matches PRD in-scope rules only):

- Return `false` if `tag !== 'p'`
- Return `false` if `blockIndex === 0` (first block in section)
- Return `false` if `previousBlockTag` is `hr` or `h1`–`h6`
- Return `true` if `previousBlockTag` is `p` (or any other tag — SE base rule indents all `p` except listed exceptions)

Add unit-style sanity checks inline or in a small test file if the project has a pattern for pure functions — optional, not required for v1.


### **Step 4: Apply indent in the viewer**

**[`Section.tsx`](../../3_App/src/components/viewer/Section.tsx):**
- When mapping blocks, pass `previousBlock={section.blocks[index - 1] ?? null}` into `TextBlock`

**[`TextBlock.tsx`](../../3_App/src/components/viewer/TextBlock.tsx):**
- Import `shouldIndentParagraph`
- In the non-edit `<p>` render path, when `!isEditing && tag === 'p'`, set `textIndent: shouldIndentParagraph(...) ? '1em' : 0` on the inline `style` object (alongside existing `textAlign` / `margin`)
- Do **not** apply indent in edit mode (`TextBlockRichEditor`) or on non-`p` tags

Use `1em` (not a px value) so indent scales with the block's typography class (`text-body-1`, etc.).


### **Step 5: Render `<hr/>` blocks in the viewer**

In [`TextBlock.tsx`](../../3_App/src/components/viewer/TextBlock.tsx), add an early branch for `tag === 'hr'`:

- **Display:** Centered gray monospace label `<hr/>` (PRD spec). Optionally render a real `<hr>` element beneath the label for visual fidelity — keep it subtle; the label helps power users confirm markup.
- **Interaction:** No click-to-edit. Click in power mode focuses the block for toolbar actions only.
- **Toolbar:** Hide tag selector and justify selector for `hr` blocks. Show delete (and See Code if useful). Consider a slim `HrBlockToolbar` or conditional props on `TextBlockToolbar` — avoid duplicating the whole toolbar.

**Edge cases:**
- Skip spellcheck fetch for `hr` blocks
- Skip append-to-previous/following actions for `hr` (disable in toolbar or no-op in handler)


### **Step 6: Queue + server handlers for insert**

**New helper file [`addSpaceBreak.ts`](../../3_App/src/views/reader/addSpaceBreak.ts)** (mirror [`addBlock.ts`](../../3_App/src/views/reader/addBlock.ts)):

- `buildAddSpaceBreakQueueItem(anchorBlock, position: 'before' | 'after')`
- `optimisticallyInsertSpaceBreak(blocks, anchorBlock, position)` — inserts a temp `hr` block
- `getAddSpaceBreakQueueItemId(anchorBlock, position)`

**Extend [`addBlock.ts`](../../3_App/src/views/reader/addBlock.ts):**

- Replace `optimisticallyInsertBlockAfter`-only API with `optimisticallyInsertBlock(blocks, anchorBlock, position: 'before' | 'after')` (keep a thin `…After` wrapper if callers prefer)
- Update `buildAddBlockQueueItem(anchorBlock, position, insertedText?)` — **`position` is required**, not optional
- Update `getAddBlockQueueItemId(anchorBlock, position)` so above/below on the same anchor are distinct queue entries

**Server — [`server/index.js`](../../3_App/server/index.js):**

Shared insert helper (recommended): given anchor element + `insertPosition`, call `target.before(node)` or `target.after(node)`.

`add-block` handler:
- Read `insertPosition` from queue item (`'before'` | `'after'`); defaulting to `'after'` is acceptable only for backward compatibility with in-flight queue items from older sessions — new UI always sends explicit position
- Insert new `<p>` / `<li>` before or after anchor accordingly

`add-space-break` handler (new):
- Same anchor lookup as `add-block`
- Create `$('<hr/>')` with `data-easypub-id` (needed for delete/undo)
- Insert before or after anchor per `insertPosition` — **both directions required**
- Write updated XHTML to zip

**[`ReaderView.tsx`](../../3_App/src/views/ReaderView.tsx):**
- Wire `handleAddSpaceBreak(sectionIndex, block, position)`
- Wire `handleAddTextBlock(sectionIndex, block, position)` — generalize existing handler
- Handle new actions in `handleSelectAction`
- Undo/queue-remove paths for optimistic temp hr blocks (mirror add-block pattern)


### **Step 7: Replace `+` button with four-option dropdown (all required)**

In [`TextBlockToolbar.tsx`](../../3_App/src/components/viewer/TextBlockToolbar.tsx):

- Remove direct `onClick={() => onSelectAction('add-block')}` from the Plus `Button` — the `+` must **only** open the dropdown; it no longer inserts below by default
- Use existing [`Dropdown`](../../3_App/src/components/Dropdown.tsx) component with the Plus icon as trigger (same pattern as the chevron menu on the right)
- **All four menu items are in scope for this ticket:**

| Label | Action id | `insertPosition` |
|-------|-----------|------------------|
| Add Text Block Above | `add-block-above` | `before` |
| Add Text Block Below | `add-block-below` | `after` |
| Add Space Break Above | `add-space-break-above` | `before` |
| Add Space Break Below | `add-space-break-below` | `after` |

- Map toolbar action ids to queue items with the correct `insertPosition` in `ReaderView` `handleSelectAction`

Remove the duplicate **Add Text Block** entry from the chevron dropdown (all insert actions live on the `+` menu). Keep See Code, Delete, Append, Break Section on the chevron menu.

**Accessibility:** Plus button needs `aria-label` update (e.g. "Add block or space break") and the dropdown should be keyboard-reachable.


### **Step 8: Queue sidebar labels**

In [`QueueSidebar.tsx`](../../3_App/src/components/QueueSidebar.tsx), add human-readable labels for all four insert variants, e.g.:

- `Add text block before P` / `Add text block after P`
- `Add space break before P` / `Add space break after P`

Use the anchor block’s tag in the label where helpful (`P`, `H2`, etc.).


### **Step 9: Manual test plan**

Prerequisites: `npm run dev` (both 5173 and 5174 — restart if server changes don't appear).

1. **Load an epub with consecutive paragraphs** → view mode shows first `p` flush, following `p` blocks indented → click into edit → indent disappears → commit/cancel → indent returns
2. **Load an epub that already contains `<hr/>`** (or insert via devtools into source xhtml temporarily) → hr block visible, not editable, deletable
3. **Add Text Block Above** → new block appears immediately **before** anchor → queue label says “before” → save → XHTML order correct
4. **Add Text Block Below** → new block appears immediately **after** anchor → queue label says “after” → save → XHTML order correct (replaces today’s sole `+` behaviour)
5. **Add Space Break Below** → hr block appears after anchor → following `<p>` flush → queue → save → `<hr/>` in XHTML at correct position
6. **Add Space Break Above** → hr block appears before anchor → `<p>` after hr is flush
7. **Indent side effects:** After each of the four insert actions, verify paragraphs that should indent still do, and paragraphs after hr/headings/first-in-section stay flush
8. **Delete hr block** → queued delete → save → `<hr/>` removed from file
9. **Regression:** Tag change, justify, append, merge, split section, spellcheck still work on normal text blocks
10. **Regression:** `hr` block does not enter edit mode on click (non-power mode)


### **Step 10: PRD update (after implementation)**

Confirm [PRD 1.7](/2_Product-Overview-and-Requirements.md/2_PRD/PRD_1.7_Indentation-and-Space-Breaks.md) matches shipped behaviour. Update if the Plus-dropdown action ids or hr viewer styling diverge from spec during implementation.


----------------------------------------------------------------------------------------------------


## **Files likely touched**

| File | Change |
|------|--------|
| `3_App/server/index.js` | Export CSS; `hr` in allowed tags; `add-space-break` handler; `add-block` before/after |
| `3_App/src/views/ReaderView.tsx` | Parse `hr`; indent not needed here; new action handlers |
| `3_App/src/views/reader/paragraphIndent.ts` | **New** — indent computation |
| `3_App/src/views/reader/addBlock.ts` | Insert before/after |
| `3_App/src/views/reader/addSpaceBreak.ts` | **New** — queue + optimistic insert |
| `3_App/src/types/reader.ts` | New queue action types |
| `3_App/src/components/viewer/TextBlock.tsx` | Indent style; hr block branch |
| `3_App/src/components/viewer/Section.tsx` | Pass `previousBlock` |
| `3_App/src/components/viewer/TextBlockToolbar.tsx` | Plus dropdown with 4 options |
| `3_App/src/components/QueueSidebar.tsx` | Labels for new actions |
