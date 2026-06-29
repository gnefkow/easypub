## What is this document?
This is an outline for an AI-generated book about Epubs. It is written according to the outline below. 

## Who is the reader?
The reader of this book is a very junior software developer. He is familiar with web code at a high level, and has spent a lot of time working with development teams as a designer and product owner. However, just developmetn skills and understanding of software is minimal. He understands a lot about html, but little about epubs. 

## Scope of this book
This book should be 60 - 100 pages in total. 

## Writing style of this book. 
This book...
- Is written in paragraphs, not bullet points. 
- It describes overarching frameworks, not just code
- It describes details with example code snippets, and explains what each part of the code snippets means. 
- It introduces "key vocabulary" in the beginning of each chapter that will be relevant to the chapter. 
- The end of each chapter has a "Common pitfalls and gotchas." section that covers relative tricky topics for the chapter. Things like: readers that strip your CSS, inconsistent font rendering, the mimetype file needing to be uncompressed and first in the ZIP, whitespace sensitivity in XHTML, and the gap between spec and reality.
- When writing a chapter, refer to the number of pages (listed below in the outline) for the chapter as a guide. If it can be explained in less pages, to not add more fluff to make it longer. If it takes more pages, it is ok to go over the suggested page count by up to 2-3 pages. 

This book is written in an objective, narrative, non-fiction style. It is not overly verbose, but it is thourough in its explanations. 





## Outline


### Part I: EPUBs in Society

**1.1. A Brief History of the EPUB Format [about 6 pages]**
- The problem EPUB was created to solve: portable, reflowable digital documents
- Predecessors: Open eBook (OEB), early digital reading formats (PDF limitations, Mobipocket, LIT)
- The founding of the IDPF (International Digital Publishing Forum) and its role
- The release timeline: OEB 1.0 (1999) → EPUB 2.0 (2007) → EPUB 3.0 (2011) → EPUB 3.3 (2023)
- The merger of IDPF into W3C (2017) and what that means for the standard's future
- How EPUB fits into the broader digital publishing revolution (Kindle, iPad, etc.)
- Key vocabulary: IDPF, W3C, OEB, reflowable, digital publishing, open standard

**1.2. EPUBs, Open Standards, and the Content Ecosystem [about 6 pages]**
- EPUB as an open standard vs proprietary formats (AZW/KF8 for Kindle, iBooks format)
- What "open standard" means in practice: who controls it, how it evolves, who can use it
- DRM (Digital Rights Management): what it is, how it works with EPUB, Adobe ADEPT, Apple FairPlay
- The tension between openness and content protection
- How EPUB relates to W3C, the Open Web Platform, and web standards (HTML, CSS, SVG)
- The role of EPUB in libraries, academic publishing, and independent publishing
- EPUB in the broader internet and content ecosystem: storefronts, distributors, aggregators
- Key vocabulary: DRM, Adobe ADEPT, FairPlay, open standard, proprietary format, sideloading, storefront

---

### Part II: EPUB Structure

**2.1. An EPUB Is a ZIP File [about 6 pages]**
- The foundational insight: an `.epub` file is a renamed `.zip` archive
- How to unzip and inspect an EPUB on any operating system
- The required `mimetype` file: what it contains, why it must be the first file in the archive, why it must be uncompressed
- The `META-INF/` directory and `container.xml`: how a reading system finds the content
- A walkthrough of unzipping a real EPUB and examining its contents
- Key vocabulary: ZIP archive, mimetype, META-INF, container.xml, OCF (Open Container Format)

**2.2. EPUB 2 vs EPUB 3 [about 6 pages]**
- Why the version distinction matters for every topic in this book
- What EPUB 2 introduced: OPF, NCX, DTBook, basic XHTML content
- What EPUB 3 changed and added: HTML5-based content documents, the nav document, media overlays, scripting, MathML, semantic enrichment
- Backwards compatibility: how EPUB 3 files can include EPUB 2 fallbacks
- Which version to target today and why (reader support landscape)
- Key vocabulary: EPUB 2, EPUB 3, OPF, NCX, nav document, media overlay, fallback

**2.3. The Overall File Structure of an EPUB [about 6 pages]**
- High-level anatomy: the container layer (ZIP + mimetype + META-INF) vs the package layer (OPF) vs the content layer (XHTML, CSS, images)
- The concept of the "spine" and reading order
- The concept of "content documents" (the actual pages/chapters)
- How all the pieces reference each other: container.xml → OPF → content documents
- A visual diagram / mental model of how the layers nest together
- Key vocabulary: spine, content document, package document, manifest, reading order, rendition

**2.4. The OPF Package Document (content.opf) [about 7 pages]**
- What the OPF file is and why it is the "brain" of the EPUB
- The three main sections of the OPF: `<metadata>`, `<manifest>`, `<spine>`
- `<metadata>`: Dublin Core elements (dc:title, dc:creator, dc:language, dc:identifier), optional metadata (dc:publisher, dc:date, dc:description), the unique-identifier attribute
- `<manifest>`: a complete inventory of every file in the EPUB, media-type declarations, the `properties` attribute (cover-image, nav, etc.)
- `<spine>`: defining the linear reading order, the `toc` attribute (NCX reference), `linear="no"` for auxiliary content
- `<guide>` (EPUB 2 legacy): cover, toc, and other landmark references
- Example OPF file with annotations explaining each element
- Key vocabulary: OPF, Dublin Core, dc:identifier, dc:title, manifest, spine, media-type, unique-identifier, ISBN, UUID

**2.5. Navigation: Table of Contents and Landmarks [about 7 pages]**
- How readers build a table of contents from the EPUB's navigation structures
- EPUB 2 approach: the NCX file (`.ncx`), `<navMap>`, `<navPoint>`, nested hierarchy
- EPUB 3 approach: the XHTML nav document, `<nav epub:type="toc">`, ordered lists as structure
- Landmarks navigation (`epub:type="landmarks"`): cover, bodymatter, bibliography, etc.
- The page-list nav: mapping to print page numbers
- How to include both NCX and nav for maximum compatibility
- Example NCX and nav document side by side
- Key vocabulary: NCX, navMap, navPoint, nav document, epub:type, landmarks, page-list, toc

**2.6. A File-by-File Breakdown of an EPUB [about 6 pages]**
- Walking through every file type you'll find inside an EPUB archive
- `mimetype` — purpose and constraints
- `META-INF/container.xml` — pointing to the OPF
- `content.opf` (or `package.opf`) — recap/cross-reference to Chapter 2.4
- `.ncx` file — recap/cross-reference to Chapter 2.5
- XHTML content documents — the actual chapter text (cross-reference to Part III)
- CSS stylesheets — how they're referenced and applied
- Image files — formats and conventions
- Font files — embedding and obfuscation
- Other assets: audio, video, JavaScript files
- Key vocabulary: content document, stylesheet, asset, resource, core media type

---

### Part III: Content and Media

**3.1. XHTML vs HTML: What the Difference Is and Why It Matters [about 6 pages]**
- HTML as a forgiving, browser-oriented language vs XHTML as strict, well-formed XML
- Why EPUB uses XHTML: parsing predictability, XML toolchain compatibility
- Practical differences: self-closing tags, case sensitivity, attribute quoting, namespace declarations
- The XHTML namespace and the `xmlns` attribute
- The `epub` namespace prefix and `epub:type` attribute in EPUB 3
- Common mistakes when writing XHTML by hand or converting from HTML
- Key vocabulary: XHTML, XML, well-formed, namespace, xmlns, self-closing tag, parser, epub:type

**3.2. Style and Formatting in EPUBs [about 7 pages]**
- CSS in EPUBs: it's the same CSS you know from the web, with caveats
- How stylesheets are linked from XHTML content documents
- Which CSS properties are widely supported across readers and which are not
- The reality of reader overrides: user font preferences, night mode, publisher vs reader control
- Page-level styling: `@page` rules, margins, page-break-before/after
- Inline styles vs external stylesheets: best practices
- Common styling patterns: drop caps, block quotes, centered text, poetry formatting
- Key vocabulary: CSS, @page, page-break, stylesheet, inline style, user override, publisher default

**3.3. Links and Cross-References in EPUBs [about 5 pages]**
- Internal links: linking between chapters/content documents using relative paths and fragment identifiers
- How the reading system resolves internal links within the ZIP structure
- External links: linking to the web (http/https), and how different readers handle them
- Footnotes and endnotes: linking patterns, `epub:type="noteref"` and `epub:type="footnote"`
- The `<a>` element in XHTML: same as HTML, but within the EPUB context
- Key vocabulary: fragment identifier, relative path, cross-reference, noteref, footnote, endnote

**3.4. Images in EPUBs [about 6 pages]**
- Supported core media types: JPEG, PNG, GIF, SVG
- How images are referenced from XHTML content documents (`<img>` tag, `src` attribute)
- Declaring images in the OPF manifest
- Cover images: conventions, the `properties="cover-image"` attribute, the cover XHTML document
- Image sizing considerations: viewport size varies wildly across devices, responsive techniques
- SVG in EPUBs: inline SVG vs referenced SVG files, use cases (scalable diagrams, decorative elements)
- Accessibility: alt text, `<figcaption>`, meaningful descriptions
- Key vocabulary: core media type, cover image, viewport, SVG, alt text, figcaption, raster vs vector

**3.5. Embedded Fonts [about 5 pages]**
- Why you might embed fonts: branding, special characters, non-Latin scripts
- How fonts are bundled: placing font files in the EPUB, declaring them in the manifest, referencing via `@font-face` in CSS
- Font obfuscation: what it is, why it exists (a lightweight DRM-adjacent mechanism), IDPF and Adobe algorithms
- The reality of font support: which readers respect embedded fonts, which ignore them, which partially support them
- Licensing considerations: not all fonts permit embedding
- Key vocabulary: @font-face, font obfuscation, WOFF, OTF, TTF, font embedding, font licensing

**3.6. Reflowable vs Fixed-Layout EPUBs [about 6 pages]**
- Reflowable content: the default EPUB paradigm, text adapts to screen size and user preferences
- Fixed-layout (FXL): content locked to exact coordinates, like a PDF or designed page
- When to use each: novels vs comics vs children's books vs textbooks
- How fixed-layout is declared: the `rendition:layout` property in the OPF metadata
- Viewport meta tag in fixed-layout content documents
- Trade-offs: accessibility, device compatibility, file size, user control
- Key vocabulary: reflowable, fixed-layout (FXL), rendition:layout, viewport, pre-paginated

**3.7. Multimedia and JavaScript in EPUB 3 [about 5 pages]**
- Audio and video: supported formats, the `<audio>` and `<video>` elements, fallback content
- Media overlays: synchronized text and audio narration, SMIL files, read-aloud functionality
- JavaScript in EPUB: what the spec allows, container-constrained vs spine-level scripting
- The reality of scripting support: very few readers support it reliably
- Progressive enhancement: designing EPUBs that work without scripting but enhance with it
- Interactive EPUBs: what's possible in theory vs what works in practice
- Key vocabulary: media overlay, SMIL, fallback, container-constrained script, spine-level script, progressive enhancement

---

### Part IV: Practical Topics

**4.1. Accessibility in EPUBs [about 7 pages]**
- Why accessibility matters: legal requirements (EAA, ADA, Section 508), ethical responsibility, broader audience
- EPUB 3 as an accessibility-forward format: built-in semantic features
- Semantic markup: `epub:type` attribute, DPUB-ARIA roles, landmark elements
- Accessibility metadata: schema.org properties (accessMode, accessibilityFeature, accessibilitySummary, accessibilityHazard)
- Practical accessibility techniques: alt text for images, logical reading order, language declarations, meaningful heading hierarchy
- WCAG and EPUB: how web accessibility guidelines apply to EPUB content
- The Ace by DAISY accessibility checker
- Key vocabulary: WCAG, ARIA, DPUB-ARIA, epub:type, semantic markup, accessibility metadata, Ace, DAISY, EAA

**4.2. Validation and Debugging [about 6 pages]**
- EPUBCheck: the official open-source EPUB validator
- Running EPUBCheck: command-line usage, GUI wrappers, online validators
- Understanding EPUBCheck output: errors vs warnings vs info messages, common error codes
- The debugging workflow: unzip → inspect → fix → re-zip → validate → repeat
- Common validation errors and how to fix them: malformed XHTML, missing manifest entries, incorrect media types, mimetype file issues
- Tools for inspecting EPUB internals: text editors, XML validators, browser dev tools (since XHTML is just web content)
- Key vocabulary: EPUBCheck, validation, well-formed, error vs warning, manifest entry, media type declaration

**4.3. Export and Packaging Best Practices [about 6 pages]**
- Building a valid EPUB archive: ZIP compression rules, mimetype file placement, no extra metadata in the ZIP
- Directory structure conventions: organizing content, styles, images, and fonts into folders
- File naming best practices: avoiding special characters, case sensitivity, path length
- Generating the OPF manifest programmatically: ensuring every file is declared
- Testing across multiple readers before publishing
- Stripping unnecessary files and metadata before final export
- Key vocabulary: packaging, ZIP deflate, store method, directory structure, manifest generation

---

### Part V: Devices, Readers, and the Real World

**5.1. Devices and App Rendering [about 7 pages]**
- The landscape of EPUB reading: dedicated e-readers, tablets, phones, desktop software
- E-ink devices: Kindle (and its EPUB limitations / KF8 conversion), Kobo, PocketBook, Onyx BOOX
- Software readers: Apple Books, Google Play Books, Adobe Digital Editions, Thorium Reader, Calibre viewer
- How different readers interpret the same EPUB differently: CSS support, font handling, pagination, JavaScript
- Amazon and the Kindle ecosystem: why Kindle doesn't natively support EPUB, the KindleGen/Kindle Previewer conversion pipeline
- Testing strategy: which readers to prioritize, how to test efficiently
- Key vocabulary: e-ink, reading system, rendering engine, KF8, KindleGen, Kindle Previewer, sideloading, Readium

**5.2. Tools for Creating and Inspecting EPUBs [about 5 pages]**
- Sigil: the open-source WYSIWYG EPUB editor, strengths and limitations
- Calibre: e-book management, format conversion, the Calibre editor
- Pandoc: converting from Markdown, HTML, DOCX, and other formats to EPUB programmatically
- Adobe InDesign: the publishing industry standard, EPUB export capabilities
- Programmatic generation: building EPUBs with code (Python libraries like ebooklib, JavaScript libraries, custom tooling)
- Choosing the right tool for your workflow
- Key vocabulary: Sigil, Calibre, Pandoc, InDesign, ebooklib, EPUB generation, format conversion

**5.3. Internationalization and Global Considerations [about 5 pages]**
- Right-to-left (RTL) text: Arabic, Hebrew — the `dir` attribute, `writing-mode` CSS property
- Vertical writing modes: CJK languages (Chinese, Japanese, Korean)
- Unicode support and character encoding in XHTML (always UTF-8)
- Language declarations: the `xml:lang` attribute and why it matters for accessibility and rendering
- Ruby annotations for East Asian text
- Key vocabulary: RTL, writing-mode, dir attribute, xml:lang, UTF-8, Unicode, ruby annotation

**5.4. Annotations, Highlights, and Reading Position [about 5 pages]**
- What user highlights and annotations are in the EPUB ecosystem
- How highlights are stored: reading system responsibility, not EPUB file contents
- CFI (EPUB Canonical Fragment Identifiers): addressing specific locations in an EPUB
- The W3C Web Annotation Data Model and its relationship to EPUB
- How different reading apps handle annotation storage and sync
- Exporting and sharing annotations: portability challenges
- Reading position and bookmarks: how readers track where you left off
- Key vocabulary: CFI, annotation, highlight, bookmark, reading position, Web Annotation Data Model