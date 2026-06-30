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
| Cleanup | No non-standard attributes in output | Strip `data-easypub-id` on save |

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

hr + p {
	text-indent: 0;
}
```

| What it does | SE behavior |
|--------------|-------------|
| `hr` | Renders a short centered rule with vertical margin (`1.5em`) — the visible “space break” in the ereader |
| `hr + p` | Resets first-line indent on the paragraph immediately following the break |
| `p` | Indents all other consecutive paragraphs by `1em` |

**Note:** Some print editions show a break as white space only (no visible rule). SE’s default is the short rule above. EasyPub follows the SE default unless we later add a project-level CSS override — not a per-block user setting.


