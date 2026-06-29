# Cover Not Loading: Issue Summary & Proposed Fixes

## The Problem

When a user loads a book via the TopBar selector, the first section (typically the cover) often displays nothing—or shows a broken image icon—instead of the cover art. The user must click "Load next section" to see the first visible content.

## Root Cause Analysis

The issue is **not a single bug** but **multiple interrelated problems** that manifest differently depending on how each EPUB structures its cover. Research was conducted by inspecting the actual cover files of several EPUBs in `workingFiles/`.

---

## Cover Structure Variations (What We Found)

### Variation 1: SVG with `<image>` (No blocks extracted)

**Affected EPUBs:** Aquinas, Conrad (Heart of Darkness)

**Structure:**
```html
<body>
  <div>
    <svg xmlns="http://www.w3.org/2000/svg" ...>
      <image xlink:href="cover.jpeg" width="393" height="616"/>
    </svg>
  </div>
</body>
```

**Why it fails:** The `parseSectionBlocks` function in `ReaderView.tsx` only extracts blocks from a specific allowlist of tags: `P`, `H1`–`H6`, `LI`, `BLOCKQUOTE`, `PRE`, `FIGURE`, `TABLE`, `UL`, `OL`, `SECTION`, `ARTICLE`, `IMG`. 

- `DIV` is not in the allowlist
- `SVG` is not in the allowlist  
- SVG’s `<image>` element (in the SVG namespace) is not the same as HTML’s `<img>`—it uses `xlink:href`, not `src`

The DOM walker recurses into the div, never finds an allowed tag, and returns zero blocks. **Result: Empty section, nothing displayed.**

**File locations:**
- Aquinas: `titlepage.xhtml` (first spine item)
- Conrad: `OEBPS/wrap0000.xhtml` (first spine item)

---

### Variation 2: HTML `<img>` inside `<div>` (Block extracted, but empty or broken)

**Affected EPUBs:** Bailyn (The Ideological Origins of the American Revolution)

**Structure:**
```html
<body>
  <div>
    <a id="cover"/>
    <img alt="image" src="../images/9780674975651.jpg" style="height:100%; text-align:center;"/>
  </div>
</body>
```

**Why it fails:** With `IMG` added to the allowlist, the parser correctly extracts an IMG block. The block is rendered. **But the image breaks** because the `src` is a relative path (`../images/9780674975651.jpg`). When the browser renders this via `dangerouslySetInnerHTML`, it resolves the URL relative to the **page URL** (e.g. `http://localhost:5173/`), not relative to the EPUB package. The browser requests something like `http://localhost:5173/images/9780674975651.jpg`—which does not exist—so the image fails to load.

**Result: Broken image icon.**

**File location:** `OEBPS/xhtml/cover.xhtml` (first spine item)

---

### Variation 3: HTML `<img>` inside `<p>` (Should work)

**Affected EPUBs:** Crystallizing Public Opinion (Edward Bernays)

**Structure:**
```html
<body>
  <p class="cover"><img alt="image" src="../images/cover.jpg"/></p>
</body>
```

**Status:** The `<p>` tag is in the allowlist, so a P block is extracted with `innerHTML` containing the img. The img is rendered as part of the P block. If this still fails to display, the cause is likely the same URL resolution issue as Variation 2 (relative `src` resolving against the wrong base).

---

## Technical Context

### How sections are loaded

1. `loadWorkingFile` in `ReaderView.tsx` loads the EPUB via the API
2. The first spine item index is used: `firstIndex = metas[0]?.index ?? 0`
3. `loadSection(firstIndex, nextBook, true, true)` is called
4. `section.render(activeBook.load.bind(activeBook))` returns an HTML string
5. `parseSectionBlocks(output, section.href, index)` parses the HTML and extracts blocks
6. Blocks are rendered by `Section` → `TextBlock`

### The `parseSectionBlocks` walker logic

- When the walker hits an **allowed tag**, it adds a block (using `innerHTML`, or `outerHTML` for IMG) and **returns without recursing into children**
- When it hits a **non-allowed tag**, it recurses into children
- This means: images inside `<p>` or `<figure>` are never seen as standalone—they’re part of the parent’s innerHTML. The IMG allowlist only helps when the img is inside something we don’t add (e.g. a div).

### epubjs URL resolution

The app uses `ePub(arrayBuffer, { replacements: 'blobUrl' })` and passes `activeBook.load.bind(activeBook)` to `section.render()`. In theory, epubjs should replace relative URLs with blob URLs in the rendered output. If Bailyn still shows broken images, either:

- The replacement isn’t happening for that EPUB
- The replacement happens in a different rendering path than we use
- Blob URLs are invalid or expired by the time we render

---

## Proposed Fixes

### Fix 1: Add SVG cover support

**For:** Variation 1 (Aquinas, Conrad)

**Approach:** Detect and handle SVG-based covers. Options:

- **Option A:** Add `SVG` to the allowlist and use `outerHTML` for SVG elements (similar to IMG). The SVG (with its embedded `<image>`) would be rendered as a block. Ensure `TextBlock` can safely render SVG markup.

- **Option B:** Add logic to detect `<image>` elements in the SVG namespace (` document.querySelector('image')` or checking `localName`/namespace). When found, create a block whose `html` is the outer HTML of the containing `<svg>` or `<div>` so the full SVG is preserved.

- **Option C:** Add `DIV` to the allowlist when it contains an svg>image structure. The div’s innerHTML would include the full SVG. Simpler but could create many div blocks in other content.

### Fix 2: Resolve image URLs relative to the section

**For:** Variation 2 & 3 (Bailyn, possibly Crystallizing)

**Approach:** Before storing or rendering block HTML, rewrite `src` (and `xlink:href` for SVG) attributes to use resolved URLs. The epubjs `load` function or `packaging.generate` APIs may provide a way to resolve a path relative to a section’s base URL. We’d need to:

1. When parsing, capture the section’s base URL (from `section.href`)
2. For each `img` and SVG `image`, resolve the resource path via the book’s resolver
3. Replace the attribute with the resolved URL (e.g. blob URL) before rendering

### Fix 3: Use EPUB cover metadata as fallback

**For:** All variations

**Approach:** Many EPUBs declare the cover in metadata, e.g. `<meta name="cover" content="cover-image-id"/>` with a manifest item for the image. When the first section yields **zero blocks** (or only empty blocks), fall back to:

1. Reading the EPUB’s metadata for the cover image ID
2. Loading that image via the book’s resource API
3. Displaying it as a dedicated cover block or placeholder

This wouldn’t fix Bailyn’s broken image (block exists, URL wrong), but would help SVG-only covers where nothing is extracted.

### Fix 4: Add DIV to allowlist (with care)

**For:** Variation 1, and potentially other div-wrapped content

**Approach:** Add `DIV` to the allowlist. SVG covers like `<div><svg><image/></svg></div>` would produce a DIV block with the full SVG as innerHTML. 

**Risk:** Many EPUBs use divs for layout. Adding DIV could create many blocks (e.g. one per div) and change the structure of existing content. May need to restrict this to divs that contain only a single svg, or divs with specific classes/types (e.g. `epub:type="cover"`).

---

## Files to Modify

- **`src/views/ReaderView.tsx`** – `parseSectionBlocks` (allowlist, special handling for SVG/IMG), and possibly URL resolution logic
- **`src/components/viewer/TextBlock.tsx`** – Rendering of SVG blocks, or any special handling for blob/resolved URLs

---

## Test EPUBs for Validation

| EPUB | Cover structure | Current behavior |
|------|-----------------|------------------|
| Aquinas A Beginners Guide | div > svg > image | Nothing |
| Conrad, Heart of Darkness | div > svg > image | Nothing |
| Crystallizing Public Opinion | p > img | Unknown (may work or have URL issues) |
| Bailyn, Ideological Origins | div > img | Broken image icon |

---

## References

- EPUB cover typically uses `<div><img src="cover.jpg"/></div>` or SVG
- SVG `<image>` uses `xlink:href`, not `src`
- epubjs `replacements: 'blobUrl'` is intended to resolve assets
- `section.render(load)` returns HTML; it may or may not include resolved URLs depending on epubjs version and usage
