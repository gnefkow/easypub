# **PRD 1.4: Endnotes**


----------------------------------------------------------------------------------------------------


## **Why Endnotes, Not Footnotes**

In print books, footnotes appear at the bottom of the page where they're referenced. But ebooks have no "page" -- content reflows based on the reader's device, font size, and preferences. There is no bottom-of-the-page to anchor a footnote to.

The [Standard Ebooks Manual of Style](https://standardebooks.org/manual/latest) makes this explicit: **"Ebooks do not have footnotes, only endnotes."** When a source text has footnotes, SE volunteers convert them to endnotes. This is the convention across well-produced epubs, and EasyPub follows it.

Endnotes live in a dedicated back matter file (`endnotes.xhtml`) and are linked from the body text via `<a>` elements with `epub:type="noteref"`. This approach is compatible with ereader popup note features, screen readers, and the EPUB 3 specification.


----------------------------------------------------------------------------------------------------


## **Alignment with Standard Ebooks**

EasyPub's endnote system is designed so that an SE volunteer can use it as part of their workflow. The output conforms to SE conventions:

- **Noterefs** in body text use `<a href="endnotes.xhtml#note-N" id="noteref-N" epub:type="noteref">N</a>`.
- **Endnotes** live in a single `endnotes.xhtml` file as an ordered list of `<li id="note-N" epub:type="endnote">` elements.
- Each endnote contains a **backlink** (`↩`) pointing back to the noteref: `<a href="{section}.xhtml#noteref-N" epub:type="backlink">↩</a>`.
- Numbering is **sequential across the entire book**, not per-chapter.
- The endnotes file is registered in the OPF manifest and spine as back matter.

EasyPub does not generate the SE-specific sections like the colophon or imprint -- those belong to the SE toolchain (`se create-draft`, `se build-toc`). EasyPub handles the content editing and cleanup that comes before those steps.


----------------------------------------------------------------------------------------------------


## **Why UIDs Instead of Sequential Numbers**

Epub editing is a messy, non-linear process. Users jump between chapters, add and remove notes out of order, save and reload multiple times throughout a session. If we used sequential numbers (1, 2, 3) as the internal identifiers for endnotes, we'd face constant problems:

- **Inserting a note between 2 and 3** would require renumbering everything after it -- not just in the sidebar, but in every body text block where a noteref was pasted.
- **Deleting a note** would leave gaps or require renumbering.
- **Reordering** would break all references.
- **Multiple save/reload cycles** would compound any numbering drift.

Instead, EasyPub assigns each endnote a **stable 4-character UID** (e.g. `a3k9`). This UID never changes, regardless of how the user reorders, inserts, or deletes notes. The sequential numbers (1, 2, 3...) are a **display concern only** -- they are computed fresh on every save by walking the spine and assigning numbers based on the order each noteref actually appears in the text.

This separation of identity (UID) from presentation (sequential number) means the user can work freely without worrying about numbering. EasyPub handles the numbering at export time.


----------------------------------------------------------------------------------------------------


## **The Placeholder System**

In the editing interface, endnote anchors appear in body text as plain-text placeholder strings: `<a>placeholder-a3k9</a>`. This design was chosen for several reasons:

- **Visibility**: The user can see exactly where an anchor is and which endnote it belongs to. The `<a>` tags are intentionally visible as literal text -- no hidden metadata, no magic tokens.
- **Simplicity**: No sanitizer changes or TipTap extensions are needed. The placeholder is just text that the user pastes into a block.
- **Robustness**: On save, the server converts placeholders to real SE-standard `<a>` elements. On reload, the server converts real `<a>` elements back to placeholders. Each direction is a clean transformation with no state to carry between sessions.

The placeholder UID matches the endnote UID shown in the sidebar, so the user can always trace which placeholder belongs to which endnote.


----------------------------------------------------------------------------------------------------


## **The Save/Load Cycle**

The endnote system maintains two representations of the same data:

- **Working state** (in the app): UIDs, placeholder text in body blocks, endnote list in the sidebar.
- **File format** (in the epub): SE-standard `<a>` elements with sequential numbers, `endnotes.xhtml` with backlinks.

**On save**, the server:
1. Converts any old noteref `<a>` elements (from prior saves) into placeholder text, using the endnotes array order for the mapping. This is necessary because blocks the user didn't edit still have real `<a>` elements on disk.
2. Walks the spine in order and collects all placeholders.
3. Assigns sequential numbers based on order of first appearance.
4. Replaces placeholders with real `<a>` elements.
5. Generates `endnotes.xhtml` and registers it in the OPF.

**On load**, the server parses `endnotes.xhtml` and returns the endnotes with fresh UIDs plus a mapping of old note IDs to new UIDs. The client uses this mapping during block parsing to convert `<a>` elements back to placeholder text before the user ever sees the content.

Every save is a full overwrite. Every load is a full re-ingest. No state is carried between sessions except what's in the epub file itself.
