---
**Keywords**: justification, text-align, initial, left, center, right, justify, global justification, paragraph alignment, Standard Ebooks, SE CSS, reading system, override, change-justify, changeElementJustify, normalizeTextAlignLeft, easypub-styles.css, export, Update Epub, TextBlockToolbar, ReaderView, server/index.js, gap analysis, ticket 113
---

## **Overview**
--------------------------------------------------

EasyPub can only change paragraph justification at the individual block level. That works for real overrides (center, right, full justify), but when the user picks **Left** we write a repetitive inline style:

```html
<p style="text-align: left;">…</p>
```

That is messy EPUB code, and it conflicts with Standard Ebooks: they use `text-align: initial` (not `left`) when left-alignment must be explicit, so reading systems can still apply `justify` if the reader prefers it.

**Revised approach (no new global UI):** Keep the per-block justification control. On export, map **Left** → `text-align: initial`. Blocks with no override stay without `text-align` at all (already SE-correct). Other overrides (`right`, `center`, `justify`) keep writing as they do today.


----------------------------------------------------------------------------------------------------


## **Why this way (not a global default UI)**
--------------------------------------------------

### **What we considered**

Original ticket idea: add UI for a file-wide default justification, with per-paragraph overrides for exceptions.

### **What the standards say**

**Garrish & Gylling — *EPUB 3 Best Practices* (Ch. 3 Styling)**

- `text-align` is ordinary CSS 2.1 — apply it via stylesheets, not by repeating the same rule on every paragraph in markup.
- Reading systems often override or ignore author styles (font size, margins, sometimes justification). Content should degrade gracefully.
- Prefer shared CSS defaults + selective overrides over hacking markup.

**Standard Ebooks** ([Gap Analysis](../4_Standards/Standard-Ebooks-Gap-Analysis.md); [SE Manual CSS rules](https://standardebooks.org/manual/latest/5-general-xhtml-and-css-patterns); SE `core.css`)

| Practice | Detail |
|----------|--------|
| Body prose | No `text-align` on `body` / `p` — leave alignment to the reading system |
| Explicit left | Use `text-align: initial`, **never** `text-align: left`, so RS can still opt into justify |
| Special cases | Alignment via CSS selectors (`center` on headings/dedications, `initial` on poetry/postscripts, etc.) — not inline on every `<p>` |

The gap analysis already flags this:

> `| text-align | Use initial not left | EasyPub writes text-align: left | Gap |`

### **Conclusion**

A global “default justify” UI would fight SE’s model (defaults belong to the reading system / user prefs) and isn’t needed for clean export. The real fix is:

1. **No override** → do not emit `text-align` (already true today).
2. **User picks Left** → emit `initial`, not `left`.
3. **User picks center / right / justify** → keep per-block inline overrides.

No new UI. Small export / write-path change.


----------------------------------------------------------------------------------------------------


## **Current behavior**
--------------------------------------------------

| Case | What EasyPub does today | SE-aligned? |
|------|-------------------------|-------------|
| Block never touched | No `text-align` in XHTML; `easypub-styles.css` has none either | Yes |
| User picks Center / Right / Full Justify | Inline `text-align: center\|right\|justify` via `changeElementJustify*` | Yes (override) |
| User picks Left | Inline `text-align: left` | No — should be `initial` |

Relevant code:

- Write path: [`3_App/server/index.js`](../../3_App/server/index.js) — `changeElementJustifyById` / `changeElementJustifyByIndex` write `text-align: ${justify}` with no remapping.
- Toolbar: [`TextBlockToolbar.tsx`](../../3_App/src/components/viewer/TextBlockToolbar.tsx) — Left option is `value: 'left'`.
- Parse path: [`ReaderView.tsx`](../../3_App/src/views/ReaderView.tsx) — only matches `left|right|center|justify` when reading existing styles (does not recognize `initial` yet).


----------------------------------------------------------------------------------------------------


## **Desired behavior**
--------------------------------------------------

### **Export / queue apply**

When applying a `change-justify` action (or any other write that sets alignment):

| UI / action value | Written to EPUB |
|-------------------|-----------------|
| `left` | `text-align: initial;` |
| `right` / `center` / `justify` | unchanged (`text-align: …`) |

Optional cleanup (nice-to-have same ticket or follow-up): on Update Epub, rewrite any existing `text-align: left` in content docs to `text-align: initial` so already-saved books become SE-clean without the user re-queuing Left.

### **Viewer / UI**

- Toolbar can still label the option **Left** (clearer for users than “Initial”).
- Internally continue using `left` in queue payloads / client state if convenient; remapping happens on write (or also normalize on parse — see below).
- Viewer display: treat `initial` like left-aligned for preview purposes.

### **Parse (open / continue editing)**

When reading blocks from XHTML:

- Recognize `text-align: initial` and treat it as the Left selection in the UI (`justify === 'left'` or equivalent).
- Keep treating absent `text-align` as default (UI shows Left, no queued change).


----------------------------------------------------------------------------------------------------


## **Out of scope**
--------------------------------------------------

- New global / file-level justification UI.
- Moving center/right/justify overrides from inline styles into stylesheet classes (possible later; not required to close the SE `left` vs `initial` gap).
- Changing `easypub-styles.css` to set a default `text-align` on `p` (SE leaves that unset on purpose).


----------------------------------------------------------------------------------------------------


## **Implementation sketch**
--------------------------------------------------

1. **Server** — in `changeElementJustifyById` / `changeElementJustifyByIndex`, map `justify === 'left'` → write `initial`.
2. **Client parse** — in `ReaderView` block extraction, match `initial` as well as `left` and surface both as Left in the toolbar.
3. **(Optional)** — one-shot rewrite pass on Update Epub: `text-align:\s*left` → `text-align: initial` across content documents.
4. **Gap analysis** — after ship, mark the `text-align` row closed in [Standard-Ebooks-Gap-Analysis.md](../4_Standards/Standard-Ebooks-Gap-Analysis.md).


----------------------------------------------------------------------------------------------------


## **Acceptance**
--------------------------------------------------

- [x] Choosing Left and updating the epub writes `text-align: initial`, not `text-align: left`.
- [x] Center / right / justify still write those values inline.
- [x] Untouched paragraphs still have no `text-align` attribute/style.
- [x] Re-opening a file that already has `text-align: initial` shows **Left** in the toolbar.
- [x] No new global justification UI.
