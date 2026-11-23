# **Indentation**
--------------------------------------------------------------------------------

Our app seeks the standards set by Standard Ebooks, which is:
> Indent 1em by default for paragraphs that follow other paragraphs, unless overridden for a specific reason. 

We therefore have our system which:
1. **Indents paragraphs that follow others by default on export.** This is built into the export CSS logic, not manually fixed by users. 
2. **Does not indent the exceptions listed below.** Again, this is built into the export CSS logic, not manually fixed by users. 
3. **Gives an override for users who want to edit special cases.** Users can edit this at the block level.

Because it would be disorientting to not show what the paragraphs look like, we display the indentation accurately for `text block`s when they are not in the edit state. 


----------------------------------------------------------------------------------------------------


## **Indentation Exceptions**

These rules follow [Standard Ebooks Typography § Indentation](https://standardebooks.org/manual/1.8.3/8-typography). Most are handled automatically by export CSS; the blockquote-continuation case is the main exception that may require a user override.

| Situation | Indented? | How SE handles it |
|-----------|-----------|-------------------|
| `p` after another `p` | Yes | Default CSS (`text-indent: 1em`) |
| First `p` in a section | No | `p:first-child` |
| `p` after heading / `hr` / `header` | No | Adjacent-sibling selectors |
| `p` continuing after `<blockquote>` | No | Manual `class="continued"` |
| Poetry lines | Special | `<span>` + negative `text-indent` (hanging indent) |
| Letters / salutations | Special | Dedicated selectors zero out indent |
| Figcaption paragraphs | Special | `figcaption p + p { text-indent: 0 }` |


## **<hr> Breaks**
----------------------------------------------------------------------------------------------------
Users can add an HR break to create a space between paragraphs.
- **What it looks like in the Viewer:** The hr break displays as a block, but it cannot be edited (it can be deleted). It has a centered "<hr/>" in gray text. 
- **Indentation:** The paragraph following the <hr/> break is not indented. 


**How users add the <hr/> Break.**
- WHEN the users hover over a block and click the "+" button, THEN a drop-down displays with these options: (1) Add Text Block Above, (2) Add Text Block Below, (3) Add Space Break Above, and (4) Add Space Break Below.
  - WHEN the user clicks one of the "Add Space Break", THEN it adds an <hr/> break either above or below the current block (based on what the user selected).


----------------------------------------------------------------------------------------------------


## **Export Markup and CSS (Standard Ebooks)**

When EasyPub writes a Space Break to the epub, it follows [SE Semantics](https://standardebooks.org/manual/1.8.3/4-semantics) and [SE Code Style](https://standardebooks.org/manual/1.8.3/1-code-style).

### **XHTML**

| Rule | SE spec | EasyPub export |
|------|---------|----------------|
| Element | `<hr/>` denotes a **thematic break** — a shift in topic, time, or scene. Not a decorative border. | Write a bare `<hr/>` |
| Attributes | No `class`, `id`, `epub:type`, or inline `style` on a standard space break. The element itself carries the meaning. | Omit all attributes |
| Placement | Block-level sibling between other blocks — typically between two `<p>` elements. Never nested inside a `<p>`. | Insert at the chosen above/below position in the block list |
| Self-closing tag | `<hr/>` style (same as `<br/>`) | `<hr/>`, not `<hr>` or `<hr></hr>` |
| Tag casing | Lowercase | Lowercase |
| Indentation | Tabs | Tabs (when we align with SE code style) |
| Cleanup | No non-standard attributes in output | Strip `data-easypub-id` on every Update Epub (re-stamp on open / Continue editing) |

**Example — what EasyPub should write:**

```xml
<p>…first paragraph…</p>
<hr/>
<p>…opening paragraph after the break (not indented)…</p>
<p>…following paragraph (indented)…</p>
```

**Do not use:**
- Empty `<p>` elements or `margin-top` on a paragraph to fake a break (loses semantic meaning for assistive tech)
- `<hr/>` for purely visual dividers unrelated to a change in context

### **CSS**

SE ships a `core.css` in every ebook. EasyPub does not bundle `core.css`, but `easypub-styles.css` must include the rules that affect indentation and break appearance. These match [SE `core.css`](https://github.com/standardebooks/jane-austen_pride-and-prejudice/blob/master/src/epub/css/core.css):

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

h1 + p,
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

| What it does | SE behavior |
|--------------|-------------|
| `body` | Enables automatic hyphenation (also used when the user sets a block to full justify) |
| `hr` | Renders a short centered rule with vertical margin (`1.5em`) — the visible “space break” in the ereader |
| `hr + p` | Resets first-line indent on the paragraph immediately following the break |
| `h1 + p` … `h6 + p`, `p:first-child` | Resets first-line indent on opening paragraphs after headings or at the start of a container |
| `p` | Indents all other consecutive paragraphs by `1em` |

**Note:** Some print editions show a break as white space only (no visible rule). SE’s default is the short rule above. EasyPub follows the SE default unless we later add a project-level CSS override — not a per-block user setting.


----------------------------------------------------------------------------------------------------


## **When and How Export CSS Runs**

Indentation is handled differently in the **viewer** vs the **saved epub**. Both should match; they use different mechanisms.

### **Viewer (in-app preview)**

- The viewer does **not** rely on `easypub-styles.css` while you edit.
- In **view mode**, each `<p>` block gets a computed `text-indent: 1em` or `0` via inline style, using the same logical rules as the export CSS (`shouldIndentParagraph` in `paragraphIndent.ts` — block order and previous block tag).
- In **edit mode**, paragraphs are always flush-left so editing is not disorienting.
- This is display-only in the app; it is not written into the epub XHTML.

### **Save pipeline (epub file)**

When the user clicks **Update Epub** (POST `/api/working-files/:filename/queue`), after all queued actions are applied the server **always** runs:

1. **`ensureEasypubStylesheet`** — writes or updates `easypub-styles.css` in the epub zip with the rules above (hyphenation + indentation + `<hr/>` styling). Adds the file to the OPF manifest if it is not there yet.
2. **`linkStylesheetInContentDocs`** — appends `<link rel="stylesheet" … href="…easypub-styles.css" />` to the `<head>` of each spine content document that does not already link it.
3. **`stripBlockIdsInZip`** — removes all `data-easypub-id` attributes from XHTML in the epub so the saved working file has no EasyPub editing residue. IDs are re-stamped on open / **Continue editing** (see [ticket 112](../3_Tickets/112_Strip-easypub-ids-on-export.md)).

This runs on **every save**, whether or not the queue includes text edits, space breaks, or justify changes. Indentation in Apple Books and other ereaders depends on the stylesheet steps — saving is required for export indent to appear outside the app. The ID strip keeps every saved epub clean for SE / handoff.

**Related, justify-only step:** If the queue includes a full-justify action (`change-justify` → `justify`), the server also runs **`ensureLangAttributes`** — sets `lang` / `xml:lang` on content documents when missing, so hyphenation can resolve correctly. That step remains justify-specific; the stylesheet and strip steps do not.

**Cascade:** `easypub-styles.css` is linked after existing book stylesheets in each content doc, so its indentation rules supplement (and typically override) book CSS at equal specificity. Books that ship Standard Ebooks `core.css` may already indent correctly; EasyPub’s stylesheet ensures consistent behavior for all epubs we touch.

Implementation: [`ensureEasypubStylesheet`, `linkStylesheetInContentDocs`, and `stripBlockIdsInZip` in `server/index.js`](../../3_App/server/index.js). Stylesheet work built in [ticket 109](../3_Tickets/109_Indentation-and-Space-Breaks.md); ID strip in [ticket 112](../3_Tickets/112_Strip-easypub-ids-on-export.md).


----------------------------------------------------------------------------------------------------


## **Tickets**

| Ticket | Path | Status |
|--------|------|--------|
| **109 — Indentation and Space Breaks** | [3_Tickets/109_Indentation-and-Space-Breaks.md](../3_Tickets/109_Indentation-and-Space-Breaks.md) | Implemented (export CSS, viewer indent, `<hr/>` blocks, plus-menu inserts) |
| **112 — Strip easypub IDs on export** | [3_Tickets/112_Strip-easypub-ids-on-export.md](../3_Tickets/112_Strip-easypub-ids-on-export.md) | Implemented (strip on save; stamp on open / Continue editing) |

When in doubt about intended behavior, this PRD is the source of truth.


