# **Output Standards**
This chapter discusses the outputted document that is created when the user clicks the "Save Epub" button in the interface. 

### **Governing Philosophy**
Our goal is for users to create clean, vanilla epubs with our application. As part of this we strive to align default outputs that align as close as possible with industry standards. 


----------------------------------------------------------------------------------------------------


## **Paragraph alignment (`text-align`)**

By default, body paragraphs leave alignment alone — we do **not** stamp `text-align` on every `<p>`. That matches Standard Ebooks and EPUB best practice: let the reading system (and the reader’s preferences) decide body justification. Per-block Center, Right, and Full Justify still write those values as inline overrides when the user chooses them.

When the user explicitly picks **Left**, export writes `text-align: initial`, never `text-align: left`. SE requires `initial` so reading systems can still apply justify if the user prefers it. On Update Epub we also rewrite any legacy `text-align: left` in content XHTML to `initial`. See [Ticket 113](../3_Tickets/113_Global-Justification.md) and the [Standard Ebooks Gap Analysis](../4_Standards/Standard-Ebooks-Gap-Analysis.md).


----------------------------------------------------------------------------------------------------


## **Cover image metadata (EPUB 2 + EPUB 3)**

On **Update Epub**, EasyPub checks the package document (`content.opf`) for cover declarations and normalizes them when needed so the same cover works across EPUB 2– and EPUB 3–oriented reading systems (including desktop thumbnails in Finder / Explorer and e-reader library shelves such as PocketBook).

There is one conceptual cover image. It is declared two ways:

| Version | Declaration |
|---------|-------------|
| EPUB 3 | `properties="cover-image"` on the cover image’s manifest item |
| EPUB 2 | `<meta name="cover" content="<manifest-item-id>"/>` |

If exactly one of those declarations is present, EasyPub adds the missing one so both point at the same manifest item `id`. If neither exists, or they disagree, the package is left unchanged. Cover image files are not renamed. See [Ticket 114](../3_Tickets/114_Cover-image-backward-compatible-normalizaiton.md).
