---
**Keywords**: cover, cover image, cover-image, meta name cover, EPUB 2, EPUB 3, package document, content.opf, opfData, normalizeCoverMetadata, Finder thumbnail, PocketBook, library shelf, reading system, Update Epub, export, backward compatible, output standards, ticket 114, server/index.js
---

## **Goal: Consistent cover image rendering.**
We want to make sure that EasyPub normalizes cover images so they will be rendered across all epub2 and epub3 platforms. Sometimes an epub uses the epub2 standard, but not the 3 (or visa versa). This means that one some devices, the cover will not render. 


| Epub Version | Standard |
|---|---|
| Epub2 | <meta name="cover" content="…"/> |
| Epub3 | `properties="cover-image"` on the cover image’s manifest item |


### **What this ticket does**
This ticket ensures that the metadata for ALL epubs updated with EasyPub have:
- Ensure one manifest item has `properties="cover-image"`
- Ensure `<meta name="cover" content="…"/>` points at that item’s `id`


### **How it works**

| IF | THEN |
| --- | --- |
| `properties="cover-image"` is present on a manifest image item, but `<meta name="cover">` is absent | Add the EPUB 2 `<meta name="cover" content="…"/>` pointing at that item’s `id`. |
| `<meta name="cover" content="…"/>` points at a real manifest image, but no manifest item has `properties="cover-image"` | Add `properties="cover-image"` to that manifest item. |
| Neither `<meta name="cover">` nor `properties="cover-image"` is present | Do nothing. |
| There is a mismatch between `<meta name="cover">` and `properties="cover-image"` | Do nothing. |


----------------------------------------------------------------------------------------------------


## **Implementation Plan**

Server-only. Same pattern as tickets 112 / 113: normalize package data on **Update Epub**, then let existing `writeOpf` persist it. No UI. No file renames.

----------------------------------------------------------------------------------------------------

### **Step 1: Helper — `normalizeCoverMetadata(opfData)`**

In [`server/index.js`](../../3_App/server/index.js), near the other OPF helpers (`getManifestItems`, `writeOpf`, etc.):

1. **Read cover-image candidate**
   - Walk `getManifestItems(opfData)`.
   - Find items whose `@_properties` token list includes `cover-image` (properties can be space-separated; don’t assume it’s the only token).
   - Prefer items whose `@_media-type` starts with `image/` (JPEG/PNG/SVG/GIF/WebP).

2. **Read EPUB 2 cover meta**
   - From `opfData.package.metadata`, normalize `meta` to an array (fast-xml-parser may return one object or an array).
   - Find an entry with `@_name === "cover"` (and a `@_content` value).

3. **Apply the decision table**
   - **Has cover-image item, no `name="cover"` meta** → append  
     `{ "@_name": "cover", "@_content": "<that-item-id>" }`  
     to metadata `meta` (create `meta` array if missing).
   - **Has `name="cover"` whose `@_content` matches a real manifest image `@_id`, and no cover-image property** → add `cover-image` to that item’s `@_properties` (append to existing space-separated list if present).
   - **Neither** → return unchanged.
   - **Both present but point at different ids (mismatch)** → return unchanged.
   - If more than one `cover-image` item exists (invalid EPUB) → do nothing for this pass (keep it simple).

4. Mutate `opfData` in place; no zip I/O in this helper.

----------------------------------------------------------------------------------------------------

### **Step 2: Call it on Update Epub, before write**

In the queue processor path (same block as ticket 112/113 cleanup):

```
normalizeTextAlignLeftInZip(zip, opfPath, opfData)
stripBlockIdsInZip(zip, opfPath, opfData)
normalizeCoverMetadata(opfData)   // NEW
writeOpf(zip, opfPath, opfData)
zip.writeZip(filePath)
```

Must run **before** `writeOpf`. Does not depend on XHTML transforms. No client changes.

----------------------------------------------------------------------------------------------------

### **Step 3: Manual verify with Artifacts**

1. Open [`4_testing/Do Artifacts Have Politics.epub`](../../4_testing/Do%20Artifacts%20Have%20Politics.epub) in EasyPub (or copy into working files).
2. Confirm current OPF has `properties="cover-image"` on the cover image and **no** `<meta name="cover" …/>`.
3. Make a trivial edit (or empty/minimal queue if supported) → **Update Epub**.
4. Unzip / inspect `content.opf`: both declarations present, same manifest `id`.
5. Spot-check on PocketBook library shelf (and Finder if convenient).

Optional second case: an EPUB that only has `<meta name="cover">` and no `cover-image` → after save, that image item should gain `properties="cover-image"`.

----------------------------------------------------------------------------------------------------

### **Step 4: Docs after ship**

- Add a short note to [`PRD_1.2_Output-Standards.md`](../2_PRD/PRD_1.2_Output-Standards.md): on Update Epub, EasyPub syncs EPUB 2 + EPUB 3 cover declarations when exactly one side is present.
- Optionally mention under Pillar 1 packaging in the [Standard Ebooks Gap Analysis](../4_Standards/Standard-Ebooks-Gap-Analysis.md) only if useful — this is not an SE house-style rename (`cover.jpg`); it’s cross-reader compatibility.

----------------------------------------------------------------------------------------------------

### **Out of scope**

- Guessing a cover when **neither** declaration exists (no scrape of `cover.xhtml`, no filename heuristics)
- Resolving mismatches between the two declarations
- Renaming images to `cover.jpg` / changing paths or hrefs
- Cover page XHTML / SVG wrapper changes
- UI to “set cover”
- SE cover dimensions / SVG cover pipeline

----------------------------------------------------------------------------------------------------

### **Acceptance criteria**

- WHEN an EPUB has `properties="cover-image"` but no `<meta name="cover">`, and the user runs Update Epub, THEN the saved OPF includes `<meta name="cover" content="<that-id>"/>`
- WHEN an EPUB has `<meta name="cover" content="<id>"/>` pointing at a real image item but no `cover-image` property, and the user runs Update Epub, THEN that item gains `properties="cover-image"` (preserving any other property tokens)
- WHEN neither declaration is present, THEN Update Epub does not invent cover metadata
- WHEN the two declarations disagree, THEN Update Epub leaves them unchanged
- WHEN Update Epub runs, THEN no cover image file is renamed or moved