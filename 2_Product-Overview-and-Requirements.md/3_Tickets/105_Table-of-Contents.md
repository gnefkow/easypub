---
**Keywords**: toc, table of contents, toc.xhtml, toc.ncx, nav, epub:type, navigation document, EPUB3, EPUB2, NCX, Standard Ebooks, spine, manifest, OPF, se build-toc, landmarks, ereader navigation, section titles, headings, export compliance, endnotes, writeToc, collectTocEntries, escapeXml, processQueue, server/index.js, navMap, navPoint, playOrder, dtb:uid, dc:identifier, properties="nav", flat list, full overwrite, no UI changes
---

Epubs need a navigation document (`toc.xhtml`) so that ereaders can display a Table of Contents in their reading UI. EasyPub does not currently generate one on save. Without it, ereaders either show no navigation or fall back to a legacy `toc.ncx` if one exists in the source file.

This is a backend-only export compliance feature. No UI changes are needed -- the user already names each section via the `SectionSidebar`, and the server already has access to section titles via the `<title>` element in each xhtml file. We just need to generate the ToC files on save and register them in the OPF manifest.


----------------------------------------------------------------------------------------------------


## **Requirements**

1. **Generate both `toc.xhtml` (EPUB3) and `toc.ncx` (EPUB2)** on every save. It costs us nothing to ship both, and it ensures compatibility with all ereaders.
2. **Include an "Endnotes" entry in the ToC** when the book has endnotes. This follows SE convention. `writeToc` runs after `writeEndnotes` and checks whether an `endnotes.xhtml` was generated.
3. **Include all spine items** in the ToC. No filtering of titlepage, imprint, colophon, or other non-chapter sections. Every spine item gets a ToC entry. The user can see exactly what's in their book, and selective filtering adds complexity with no clear benefit.


----------------------------------------------------------------------------------------------------


## **How the ToC Works in an Epub**

The EPUB3 spec requires a **navigation document** -- an xhtml file containing `<nav epub:type="toc">`. This file is declared in the OPF manifest with `properties="nav"`. It is **not** included in the spine (the user never sees it as a "page" in the book). Ereaders consume it to build their own nav UI.

Standard Ebooks omits the ToC from the spine entirely and relies on `se build-toc` to auto-generate it from the section headings.

### **What a toc.xhtml looks like**

```xml
<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Table of Contents</title>
</head>
<body epub:type="frontmatter">
  <nav epub:type="toc">
    <h1>Table of Contents</h1>
    <ol>
      <li><a href="chapter-1.xhtml">Chapter I</a></li>
      <li><a href="chapter-2.xhtml">Chapter II</a></li>
      <li><a href="chapter-3.xhtml">Chapter III</a></li>
    </ol>
  </nav>
</body>
</html>
```

Each `<a>` element points to a section file's `href` (relative to the OPF directory, same as other manifest hrefs). The link text is the section's title.


----------------------------------------------------------------------------------------------------


## **What EasyPub Should Do**

On every save ("Update Epub"), the server generates a fresh `toc.xhtml` and `toc.ncx` and writes them into the epub zip. Like `endnotes.xhtml`, this is a full overwrite on each save -- no state is carried between sessions.

### **Generation logic**

1. Walk the spine in order (same pattern used by `writeEndnotes`).
2. For each spine item, load the xhtml file and extract the title. Use the `<title>` element text. If no `<title>`, fall back to the first `<h1>`–`<h6>` text content. If no heading, fall back to the filename without extension.
3. Skip the `toc.xhtml` file itself if it appears in the spine (don't list the ToC in the ToC).
4. If an `endnotes.xhtml` exists in the manifest (written by `writeEndnotes` earlier in the pipeline), add an "Endnotes" entry at the end of the list.
5. Build the EPUB3 `toc.xhtml` with `<nav epub:type="toc">` containing an `<ol>` of links.
6. Build the EPUB2 `toc.ncx` with `<navMap>` containing `<navPoint>` entries.
7. Write both files into the zip (in the same directory as the OPF file).
8. Register both in the OPF manifest. `toc.xhtml` gets `properties="nav"`. The OPF `<spine>` element gets a `toc` attribute pointing to the NCX manifest id.


### **OPF manifest entries**

```xml
<item id="toc.xhtml" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
```

The `properties="nav"` attribute tells the ereader this is the EPUB3 navigation document. Only one manifest item can have this property.

The `<spine toc="ncx">` attribute tells EPUB2 readers where to find the NCX. If the spine already has a `toc` attribute pointing to a different id, update it.

If these items already exist in the manifest, update them in place. If they don't exist, add them.

Neither file should be added to the spine. If `toc.xhtml` is already in the spine (from a prior tool), leave it -- don't remove it.


### **What a toc.ncx looks like**

```xml
<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head>
  <meta name="dtb:uid" content="urn:uuid:placeholder"/>
</head>
<docTitle><text>Book Title</text></docTitle>
<navMap>
  <navPoint id="navpoint-1" playOrder="1">
    <navLabel><text>Chapter I</text></navLabel>
    <content src="chapter-1.xhtml"/>
  </navPoint>
  <navPoint id="navpoint-2" playOrder="2">
    <navLabel><text>Chapter II</text></navLabel>
    <content src="chapter-2.xhtml"/>
  </navPoint>
</navMap>
</ncx>
```

Each `<navPoint>` has a sequential `playOrder` and an `id`. The `<content src="..."/>` points to the section href. The `dtb:uid` should match the `dc:identifier` from the OPF metadata if available, otherwise use a placeholder.


### **Where it fits in the save pipeline**

In `processQueue` in `server/index.js`, the generation should happen after all queue actions are processed and after `writeEndnotes`, but before `writeOpf` and `zip.writeZip`. This is the same location where other generated artifacts are created:

```
... process all queue actions ...
... ensureEasypubStylesheet (if needed) ...
... writeEndnotes (if needed) ...
... writeToc  <-- NEW (generates both toc.xhtml and toc.ncx)
... writeOpf
... zip.writeZip
```


### **Function signature**

Following the pattern of `writeEndnotes`:

```javascript
const writeToc = (zip, opfPath, opfData) => { ... }
```

No additional data needs to be passed in from the client. Everything the function needs (spine order, section hrefs, titles, book identifier) is already available from the OPF data and the xhtml files in the zip.


----------------------------------------------------------------------------------------------------


## **Decisions Made**

- **One entry per spine item (flat list)**: For v1, each xhtml file in the spine gets exactly one ToC entry. No sub-heading nesting (e.g. no nested `<ol>` for `<h2>`s within a chapter). This matches what most epubs need and avoids the complexity of heading hierarchy parsing.
- **Both EPUB3 and EPUB2 formats**: Generate `toc.xhtml` (EPUB3 nav document) and `toc.ncx` (EPUB2 NCX) on every save. Costs nothing and ensures all ereaders can navigate.
- **Include all spine items**: Every spine item gets a ToC entry. No filtering of titlepage, imprint, colophon, etc. Filtering adds complexity with no clear benefit, and risks hiding things from the user.
- **Endnotes entry in ToC**: If `endnotes.xhtml` exists in the manifest after `writeEndnotes` runs, an "Endnotes" entry is appended to the ToC.
- **Full overwrite on every save**: Same pattern as endnotes. The server generates fresh `toc.xhtml` and `toc.ncx` on every save, regardless of whether they previously existed.
- **Title extraction from xhtml, not from client state**: The server reads the `<title>` element from each section file at save time. It doesn't need titles passed from the frontend -- the `rename-section` queue action already updates the `<title>` element in the xhtml file before the ToC is generated.
- **No UI changes**: Users already name sections in the `SectionSidebar`. Those names flow to the xhtml `<title>` element via the `rename-section` action. The ToC generation just reads what's already there.
- **Not in the spine**: The ToC files are navigation documents, not readable pages. They are registered in the manifest but not the spine.


----------------------------------------------------------------------------------------------------


## **Trade-Offs**

- **Flat list vs. nested hierarchy**: SE's `se build-toc` does sophisticated heading extraction (handling `<hgroup>`, multi-level Parts/Chapters, Roman numerals, etc.). EasyPub's v1 uses one entry per file, which is correct for most books but won't produce the deep nesting that SE expects for multi-part works. This is fine for now -- users can refine with SE tools later. A future version could add nesting by detecting headings within sections.
- **Overwriting existing ToC**: If someone imported an epub that already had a hand-crafted ToC with custom nesting, EasyPub will replace it with a flat auto-generated one. This is the trade-off of full overwrite. For our target users (volunteers cleaning up messy epubs), this is acceptable -- the SE toolchain will regenerate the ToC with proper nesting anyway.
- **No landmarks nav**: The SE spec also includes a `<nav epub:type="landmarks">` section in `toc.xhtml` for marking major structural divisions (bodymatter start, endnotes, etc.). v1 skips this since EasyPub doesn't yet track front/body/back matter partitioning. Could be added later once `epub:type` on sections is supported (see Gap Analysis).
- **Dual-format maintenance**: Generating both `toc.xhtml` and `toc.ncx` means two templates to maintain. But the data is identical (same title list, same hrefs), so the added complexity is minimal -- just two different XML formats for the same content.


----------------------------------------------------------------------------------------------------


## **Open Questions**

None -- all resolved. See Decisions Made above.


----------------------------------------------------------------------------------------------------


## **Out of Scope**

- Nested ToC entries based on heading hierarchy within sections (future enhancement).
- Landmarks nav (`<nav epub:type="landmarks">`) -- requires front/body/back matter partitioning that EasyPub doesn't support yet.
- Any UI for viewing or editing the ToC directly -- the section list in the sidebar already serves this purpose.
- SE-specific ToC conventions (Roman numeral `<span>` wrapping, `hgroup` handling, subtitle stripping) -- those belong to `se build-toc`.


----------------------------------------------------------------------------------------------------


## **SE Spec Reference**

- [SE Manual: Section Patterns (ToC)](https://standardebooks.org/manual/latest/6-standard-ebooks-section-patterns) -- Rules for ToC structure, entry text, landmarks
- [SE Manual: Structure](https://standardebooks.org/manual/latest/3-the-structure-of-an-ebook) -- Front/body/back matter definitions
- [EPUB3 Navigation Document spec](https://www.w3.org/TR/epub-33/#sec-nav) -- `properties="nav"`, `<nav epub:type="toc">`


----------------------------------------------------------------------------------------------------


## **Implementation**

### **Files to touch**

- **`server/index.js`** -- Add `writeToc(zip, opfPath, opfData)` function and call it in `processQueue` after `writeEndnotes`.

### **Step 1: Build the entry list**

Create a helper function `collectTocEntries(zip, opfPath, opfData)` that returns an array of `{ href, title }` objects:

1. Get manifest items and spine items from OPF data using existing `getManifestItems` and `getSpineItems` helpers.
2. Build the `hrefById` map (same pattern as `writeEndnotes`): `manifestItems.map(item => [item['@_id'], item['@_href']])`.
3. Walk the spine in order. For each spine item:
   a. Look up the href from the manifest via `hrefById`.
   b. **Skip** if the href ends with `toc.xhtml` or `toc.ncx` (don't list the ToC in the ToC).
   c. Resolve the full zip path via `resolveHref(opfPath, href)`.
   d. Read the xhtml file from the zip.
   e. Extract the title using cheerio:
      - First try `$('title').text().trim()`.
      - If empty, try `$('h1, h2, h3, h4, h5, h6').first().text().trim()`.
      - If still empty, fall back to the filename without extension: `path.posix.basename(href, '.xhtml')`.
   f. Push `{ href, title }` to the entries array.
4. **Check for endnotes**: After walking the spine, check if the manifest contains an item whose href ends with `endnotes.xhtml`. If it does, append `{ href: endnotesHref, title: 'Endnotes' }` to the entries array (unless it was already included from the spine walk).


### **Step 2: Generate toc.xhtml (EPUB3)**

Build the EPUB3 navigation document as a string:

```javascript
const tocXhtml = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
\t<title>Table of Contents</title>
</head>
<body epub:type="frontmatter">
\t<nav epub:type="toc">
\t\t<h1>Table of Contents</h1>
\t\t<ol>
${entries.map(e => `\t\t\t<li><a href="${e.href}">${escapeXml(e.title)}</a></li>`).join('\n')}
\t\t</ol>
\t</nav>
</body>
</html>`
```

Write into the zip at the correct path (`resolveHref(opfPath, 'toc.xhtml')`). Use `zip.addFile` or `zip.updateFile` depending on whether the entry already exists.

Need a small `escapeXml` helper for title text (escape `&`, `<`, `>`, `"`). Check if one already exists in the codebase; if not, add one.


### **Step 3: Generate toc.ncx (EPUB2)**

Extract the book's unique identifier from OPF metadata for the `dtb:uid` meta:

```javascript
const metadata = opfData?.package?.metadata || {}
const uid = metadata['dc:identifier']?.['#text']
  || metadata['dc:identifier']
  || metadata['dc\\:identifier']?.['#text']
  || metadata['dc\\:identifier']
  || 'urn:uuid:unknown'
```

Also extract the book title for `<docTitle>`:

```javascript
const bookTitle = metadata['dc:title']?.['#text']
  || metadata['dc:title']
  || metadata['dc\\:title']?.['#text']
  || metadata['dc\\:title']
  || 'Unknown Title'
```

Build the NCX:

```javascript
const tocNcx = `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head>
\t<meta name="dtb:uid" content="${escapeXml(String(uid))}"/>
</head>
<docTitle><text>${escapeXml(String(bookTitle))}</text></docTitle>
<navMap>
${entries.map((e, i) => `\t<navPoint id="navpoint-${i + 1}" playOrder="${i + 1}">
\t\t<navLabel><text>${escapeXml(e.title)}</text></navLabel>
\t\t<content src="${e.href}"/>
\t</navPoint>`).join('\n')}
</navMap>
</ncx>`
```

Write into the zip at `resolveHref(opfPath, 'toc.ncx')`.


### **Step 4: Register in OPF manifest**

Using existing `getManifestItems` / `setManifestItems`:

**For toc.xhtml:**
1. Strip `properties="nav"` from any existing manifest item that has it (there can only be one nav document).
2. Check if a manifest item with `@_href` ending in `toc.xhtml` already exists.
   - If yes, update its `@_id` to `'toc.xhtml'`, ensure `@_media-type` is `'application/xhtml+xml'`, set `@_properties` to `'nav'`.
   - If no, push a new item: `{ '@_id': 'toc.xhtml', '@_href': 'toc.xhtml', '@_media-type': 'application/xhtml+xml', '@_properties': 'nav' }`.

**For toc.ncx:**
1. Check if a manifest item with `@_media-type` of `'application/x-dtbncx+xml'` already exists.
   - If yes, update its `@_href` to `'toc.ncx'` and note its `@_id`.
   - If no, push a new item: `{ '@_id': 'ncx', '@_href': 'toc.ncx', '@_media-type': 'application/x-dtbncx+xml' }`.
2. Set the `toc` attribute on the `<spine>` element to point to the NCX item's `@_id`:
   ```javascript
   if (!opfData.package.spine) opfData.package.spine = {}
   opfData.package.spine['@_toc'] = ncxItemId
   ```

Call `setManifestItems(opfData, manifestItems)` to persist.


### **Step 5: Wire into processQueue**

In the `processQueue` function in `server/index.js`, add the `writeToc` call after `writeEndnotes` and before `writeOpf`:

```javascript
// existing code
if (endnotes.length) {
  writeEndnotes(zip, opfPath, opfData, endnotes)
}

// NEW
writeToc(zip, opfPath, opfData)

// existing code
writeOpf(zip, opfPath, opfData)
zip.writeZip(filePath)
```

Note: `writeToc` is called **unconditionally** on every save (unlike `writeEndnotes` which is conditional on endnotes existing). Every saved epub gets a fresh ToC.


### **Step 6: Handle edge cases**

- **Empty spine**: If the spine has zero content items (after skipping toc files), generate an empty `<ol></ol>` / `<navMap></navMap>`. Don't skip file generation -- the epub should always have a nav document.
- **Duplicate hrefs**: If the same href appears multiple times in the spine (unusual but possible), include it once in the ToC (first occurrence).
- **Non-xhtml spine items**: Some spine items might be non-xhtml (images, SVG). If cheerio can't parse the file or it has no title, use the filename fallback.
- **Existing toc.xhtml in spine**: Don't remove it. Some ereaders may have it in the spine intentionally. Just skip it when building the entry list.


### **Summary of what gets added to server/index.js**

| Addition | Description |
|----------|-------------|
| `escapeXml(str)` | Small utility -- escapes `&`, `<`, `>`, `"` for XML attribute/text values |
| `collectTocEntries(zip, opfPath, opfData)` | Walks spine, extracts titles, appends endnotes entry if present. Returns `[{ href, title }]` |
| `writeToc(zip, opfPath, opfData)` | Orchestrator: calls `collectTocEntries`, builds `toc.xhtml` and `toc.ncx` strings, writes files, registers in manifest |
| One line in `processQueue` | `writeToc(zip, opfPath, opfData)` after `writeEndnotes` |
