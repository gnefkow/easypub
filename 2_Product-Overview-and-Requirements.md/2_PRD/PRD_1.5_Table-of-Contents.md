# **PRD 1.5: Table of Contents**


----------------------------------------------------------------------------------------------------


## **What the Table of Contents Is**

Every well-formed epub needs a Table of Contents so that ereaders can offer navigation. Without one, the reader has no way to jump between chapters or sections -- they're stuck scrolling linearly through the entire book.

EasyPub generates the ToC automatically on every save. The user doesn't interact with it directly -- it's built from the section names they've already set in the `SectionSidebar`. This follows the same philosophy as [Standard Ebooks](https://standardebooks.org/manual/latest/6-standard-ebooks-section-patterns), where the `se build-toc` tool auto-generates the ToC from section headings. EasyPub does the same thing, just as part of the "Update Epub" save pipeline instead of a separate CLI tool.


----------------------------------------------------------------------------------------------------


## **Two Formats: EPUB3 and EPUB2**

Ereaders come in two generations, and they look for different ToC formats:

- **EPUB3** readers use `toc.xhtml` -- an XHTML file with a `<nav epub:type="toc">` element containing an ordered list of links. This is declared in the OPF manifest with `properties="nav"`.
- **EPUB2** readers use `toc.ncx` -- an XML file with a `<navMap>` of `<navPoint>` elements. This is referenced by the `<spine toc="ncx">` attribute in the OPF.

EasyPub generates both on every save. It costs nothing to ship both, and it ensures the epub works on any ereader -- old or new.


----------------------------------------------------------------------------------------------------


## **How It Works**

The ToC generation is entirely backend work. No UI changes are involved. The user already has the ability to name sections via the `SectionSidebar` (and the `SectionBoundaryCard` rename action). Those names are written into each section's `<title>` element by the `rename-section` queue action. The ToC generation simply reads those titles back out at save time.

### **The pipeline**

The `writeToc` function in `server/index.js` runs as part of the `processQueue` save pipeline:

```
... process all queue actions (edits, splits, merges, renames) ...
... ensureEasypubStylesheet (if needed) ...
... writeEndnotes (if endnotes exist) ...
... writeToc  ← generates toc.xhtml and toc.ncx
... writeOpf
... zip.writeZip
```

`writeToc` is called **after** `writeEndnotes` intentionally. This sequencing allows it to detect whether an `endnotes.xhtml` was generated and include an "Endnotes" entry at the end of the ToC -- matching the Standard Ebooks convention where back matter sections like endnotes appear in the ToC.

### **What writeToc does**

1. **Collects entries** (`collectTocEntries`): Walks the spine in order, loads each xhtml file, and extracts the title. Uses the `<title>` element first, falls back to the first `<h1>`–`<h6>`, then to the filename. Skips the `toc.xhtml`/`toc.ncx` files themselves. Deduplicates by href. Appends "Endnotes" if `endnotes.xhtml` exists in the manifest.
2. **Generates `toc.xhtml`**: Builds the EPUB3 navigation document with a `<nav epub:type="toc">` containing an ordered list of links.
3. **Generates `toc.ncx`**: Builds the EPUB2 NCX document with `<navMap>`, `<navPoint>` entries (with `playOrder`), and `<docTitle>`. Pulls the `dtb:uid` from the OPF's `dc:identifier` metadata.
4. **Registers both in the OPF manifest**: Adds or updates manifest entries. Sets `properties="nav"` on `toc.xhtml` (stripping it from any prior nav document). Sets the `<spine toc="...">` attribute to point to the NCX.

### **Full overwrite on every save**

Same pattern as endnotes. Both ToC files are regenerated from scratch on every save. If the epub already had a `toc.xhtml` or `toc.ncx` (from a prior tool or from EasyPub's last save), they're overwritten. No state is carried between sessions -- the epub file itself is the single source of truth.


----------------------------------------------------------------------------------------------------


## **What's Included in the ToC**

Every spine item gets a ToC entry. EasyPub does not filter out titlepage, imprint, colophon, or other non-chapter sections. This keeps the behavior simple and transparent -- the user can see exactly what's in their book. If they don't want a section in the ToC, they can merge it into another section or remove it.

The structure is a flat list -- one entry per section file. There is no nested hierarchy based on heading levels within a section. SE's `se build-toc` does sophisticated nesting for multi-part works, but that level of complexity belongs to the SE toolchain. EasyPub's job is the content editing and cleanup that comes before those steps.


----------------------------------------------------------------------------------------------------


## **Files**

| File | Role |
|------|------|
| `server/index.js` | Contains `escapeXml`, `collectTocEntries`, and `writeToc`. Called from `processQueue`. |
| `src/components/sectionSidebar/` | Where the user names sections -- the titles that flow into the ToC. No changes needed here. |
| `src/views/ReaderView.tsx` | Manages `sectionMeta` and the `rename-section` queue action. No changes needed here. |


----------------------------------------------------------------------------------------------------


## **Relationship to Other Features**

- **Sections** (PRD 1.2): The ToC is derived from the section structure. Splitting, merging, and renaming sections all affect what appears in the ToC on the next save.
- **Endnotes** (PRD 1.4): The ToC generation is sequenced after endnote generation so that it can include an "Endnotes" entry when applicable.
- **Standard Ebooks Gap Analysis**: The ToC generation addresses the "File Structure & Packaging" gap for navigation documents. The flat-list approach is a pragmatic v1 -- SE volunteers can run `se build-toc` afterward for full hierarchical nesting.
