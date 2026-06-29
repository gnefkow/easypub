# **Standard Ebooks Gap Analysis**

Working note for making EasyPub a great tool for [Standard Ebooks](https://standardebooks.org/) volunteers.

**Target user:** An SE volunteer who currently uses Sigil. We want EasyPub to make them faster and more efficient -- even if it's just for a quick pass before they do fancier things.

Where the SE manual is silent, the directive is to follow the **Chicago Manual of Style**.


----------------------------------------------------------------------------------------------------


## **How We're Thinking About This**

Three pillars, in priority order:

1. **Export Compliance** -- When an epub is saved in EasyPub, is the *file itself* properly formatted according to SE standards? (Code style, structure, packaging)
2. **Editing Capabilities** -- Can users do the things they need to do to meet SE standards? (Inline tags, semantic markup, typography tools)
3. **Style Guide Hints** (later) -- Can we surface helpful hints from the SE style guide as they work?


----------------------------------------------------------------------------------------------------


## **Pillar 1: Export Compliance**

*"Does the file EasyPub writes out meet SE code-level standards?"*

These are things the user shouldn't have to think about -- EasyPub should just get them right on save.

### **XHTML Code Style**

| Rule | SE Spec | EasyPub Today | Gap? |
|------|---------|---------------|------|
| XHTML declaration | `<?xml version="1.0" encoding="utf-8"?>` as first line | Preserves whatever was in source | ❓ Need to verify |
| Indentation | Tabs, not spaces | Cheerio output likely not tab-indented | ❓ Need to verify |
| Tag names | Lowercase | Cheerio lowercases by default | ❓ Need to verify |
| Attributes | Alphabetical order | Not enforced | 🔴 Gap |
| Attribute values | Lowercase (except IETF lang tags) | Not enforced | 🔴 Gap |
| Phrasing content | Single line, no whitespace around content | Not enforced | 🔴 Gap |
| `data-easypub-id` cleanup | SE wouldn't allow non-standard attributes | **IDs persist in output** | 🔴 Gap |
| Self-closing tags | `<br/>` style | ❓ Need to verify cheerio output | ❓ Need to verify |

### **CSS Code Style**

| Rule | SE Spec | EasyPub Today | Gap? |
|------|---------|---------------|------|
| Charset declaration | `@charset "utf-8";` first two lines | `easypub-styles.css` doesn't include this | 🔴 Gap |
| Indentation | Tabs | Not enforced | 🔴 Gap |
| Selectors/properties/values | Lowercase | Not enforced | ❓ Need to verify |
| Properties | Alphabetical order | Not enforced | 🔴 Gap |
| `text-align` | Use `initial` not `left` | EasyPub writes `text-align: left` | 🔴 Gap |
| Font sizes | Never less than `1em` | N/A currently | ✅ N/A |
| Height/top/bottom | Use `vh` not `%` | N/A currently | ✅ N/A |

### **File Structure & Packaging**

| Rule | SE Spec | EasyPub Today | Gap? |
|------|---------|---------------|------|
| `epub:type` on sections | Required on all `<section>`/`<article>` | Not added by EasyPub | 🔴 Gap |
| `id` on sections | Required, matching filename | Not enforced | 🔴 Gap |
| Front/body/back matter | Proper partitioning in spine | Not enforced | 🔴 Gap |
| OPF mimetype | Uncompressed, first in ZIP | adm-zip may not preserve this | ❓ Need to verify |
| UTF-8 encoding | `utf-8` lowercase in declarations | ❓ Need to verify | ❓ Need to verify |


----------------------------------------------------------------------------------------------------


## **Pillar 2: Editing Capabilities**

*"Can the user do the things an SE volunteer needs to do?"*

These are tools and actions the user needs access to in the UI.

### **Inline Formatting (Currently: `strong`, `em`, `br`, `sup`, `sub`)**

| Element | SE Use Case | EasyPub Today | Gap? |
|---------|-------------|---------------|------|
| `<strong>` | Emphasis | ✅ Supported | ✅ |
| `<em>` | Emphasis, italics | ✅ Supported | ✅ |
| `<br/>` | Line breaks | ✅ Supported | ✅ |
| `<sup>` | Superscript | ✅ Supported | ✅ |
| `<sub>` | Subscript | ✅ Supported | ✅ |
| `<i>` | Non-English words, sounds, thoughts, book titles | 🔴 Not in allowlist | 🔴 Gap |
| `<b>` | Semantically distinct from emphasis (e.g. keywords) | 🔴 Not in allowlist | 🔴 Gap |
| `<abbr>` | Abbreviations, initialisms, acronyms, eras | 🔴 Not in allowlist | 🔴 Gap |
| `<cite>` | Citations, titles of works | 🔴 Not in allowlist | 🔴 Gap |
| `<span>` | Generic wrapper (for `epub:type`, `xml:lang`, etc.) | 🔴 Not in allowlist | 🔴 Gap |
| `<a>` | Links (endnotes, internal refs) | 🔴 Not in allowlist | 🔴 Gap |
| `<q>` | Inline quotation (for italicized thoughts) | 🔴 Not in allowlist | 🔴 Gap |

### **Attributes on Inline Elements**

| Attribute | SE Use Case | EasyPub Today | Gap? |
|-----------|-------------|---------------|------|
| `epub:type` | Semantic inflection (everywhere) | Cannot add | 🔴 Gap |
| `xml:lang` | Non-English text pronunciation | Cannot add | 🔴 Gap |
| `class` | Styling hooks (e.g. `eoc`, `name`) | Cannot add (attrs stripped) | 🔴 Gap |
| `id` | Noterefs, endnotes, figures | Cannot add | 🔴 Gap |
| `href` | Endnote links | Cannot add | 🔴 Gap |

### **Block-Level Capabilities**

| Capability | SE Use Case | EasyPub Today | Gap? |
|------------|-------------|---------------|------|
| Change tag to `<h1>`–`<h6>` | Heading hierarchy | ✅ Supported | ✅ |
| Change tag to `<p>` | Body text | ✅ Supported | ✅ |
| Change tag to `<blockquote>` | Quotations | ✅ Supported | ✅ |
| Delete block | Remove artifacts | ✅ Supported | ✅ |
| Merge blocks | Combine split paragraphs | ✅ Supported | ✅ |
| Split section | Chapter divisions | ✅ Supported | ✅ |
| `<header>` wrapping | SE requires headers in `<header>` element | 🔴 Not supported | 🔴 Gap |
| `epub:type` on blocks | Chapter semantics, epigraphs, etc. | 🔴 Not supported | 🔴 Gap |
| Poetry/verse markup | `<span>` lines inside `<p>`, specific CSS | 🔴 Not supported | 🔴 Gap |
| Letter formatting | Salutations, valedictions, postscripts | 🔴 Not supported | 🔴 Gap |
| Endnote sections | Back matter with `<ol>` of notes | 🔴 Not supported | 🔴 Gap |

### **Typography Tools**

| Tool | SE Use Case | EasyPub Today | Gap? |
|------|-------------|---------------|------|
| Smart quote conversion | Straight → curly quotes | 🔴 Not available | 🔴 Gap |
| Dash normalization | Hyphens → proper em/en/figure dashes | 🔴 Not available | 🔴 Gap |
| Ellipsis normalization | `...` → `…` with proper spacing | 🔴 Not available | 🔴 Gap |
| Double-space removal | Two spaces → one | 🔴 Not available | 🔴 Gap |
| Unicode fraction conversion | `1/2` → `½` | 🔴 Not available | 🔴 Gap |
| Titlecase tool | SE-style titlecasing for headings | 🔴 Not available | 🔴 Gap |


----------------------------------------------------------------------------------------------------


## **Pillar 3: Style Guide Hints (Future)**

*"Can EasyPub help the volunteer learn and follow SE rules as they work?"*

Not scoped yet. Ideas for later:

- Warnings when common SE violations are detected (straight quotes, wrong dash type)
- Inline suggestions ("This looks like a non-English phrase -- add `xml:lang`?")
- Checklist panel for SE compliance
- Link to relevant SE manual section from context menus


----------------------------------------------------------------------------------------------------


## **What's NOT in Scope (SE Publisher-Specific)**

These are conventions specific to Standard Ebooks as a *publisher*, not things a volunteer would expect a general editing tool to handle:

- Colophon, imprint, uncopyright page templates
- Titlepage SVG generation
- Cover image spec (dimensions, art selection)
- SE-specific metadata (`<meta>` elements)
- `se-clean` / `se build-toc` / `se create-draft` tooling

The volunteer would use SE's own toolchain for these. EasyPub's job is the content editing and cleanup that comes *before* those steps.


----------------------------------------------------------------------------------------------------


## **Reference**

- [SE Manual of Style (latest)](https://standardebooks.org/manual/latest)
- [SE Typography rules](https://standardebooks.org/manual/1.8.3/8-typography)
- [SE Code Style](https://standardebooks.org/manual/1.8.3/1-code-style)
- [SE Structure](https://standardebooks.org/manual/1.8.3/3-the-structure-of-an-ebook)
- [SE Semantics](https://standardebooks.org/manual/1.8.3/4-semantics)
- [SE General Patterns](https://standardebooks.org/manual/1.8.3/5-general-xhtml-and-css-patterns)
- [SE Section Patterns](https://standardebooks.org/manual/1.8.3/6-standard-ebooks-section-patterns)
