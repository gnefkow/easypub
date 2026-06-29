EasyPub is an application that enables users to format (edit) epub files. Users:
    - Load up their epub files by selecting their working files from the [Home](/src/views/Home.tsx) view. This opens the epub in the...
    - [ReaderView](/src/views/ReaderView.tsx) where they can see the Epub in the [Viewer](/src/components/viewer/).
    - Users can queue up edits, then execute the changes to the Epub files as a batch process by pushing the "Update Epub" button.

**`Edit Session`**: An "Edit Session" refers to the full cycle of a user:
> Load Epub -> Queue Changes -> Execute changes with the "Update Epub" button. 

The viewer loads up content based on Epub Content Documents. In EasyPub, a Content Document is called `Section`
Epub Content Document = "Section"

The `Viewer` has a few elements that determin which `Sections` display, and also has some actions that can be taken on `Sections`:

**Section Displays**
By default, the first `Section`of the Epub displays in the `Viewer` 

**Section Boundary Card**
The `Section Boundary Card` (SectionBoundaryCard.tsx) displays between each `Section`. Actions on the `Section Boundary Card` enable users to:
- Load more sections into view in the `Viewer`
- Add an `Edit Action` to the `Queue` that will combine two `Sections` with the "Remove content document break" button. 
- Rename a `Section`

**TextBlocks contain HTML/XHTML Elements**
The `TextBlock` component (TextBlock.tsx) is a front-end component that:
- Displays for each HTML/XHTML Element (<p>,<h1>,<blockquote>, etc...) in the Epub
- Displays in the `Viewer` according to the `Sections` that are currently set to display. 
- Add `Edit Actions` to the `Queue`. These actions include:
    - `Delete` the `TextBlock` (which will delete the HTML/XHTML element from the Epub)
    - `Append to Previous` or `Append to Following` which will append the selected TextBlock (HTML/XHTML element) to the HTML/XHTML element that either preceeds or follows it. 
    - `Break Section Below` which will split the `section` (Epub Content Document) into two content documents after the selected HTML/XHTML element. 

**sectionSidebar**
The `Section Sidebar` (src/components/sectionSidebar folder contains the components for this component) is a component that enables users to:
- Navigate the `viewer` to show a different section (by either scrolling in the `viewer` or setting a `section` to display).
- Hide or display the `Sections` that display in the `Viewer`
- Rename a `Section`

### Edit Actions are queued, then the batch is run
Edits to Epub are batched. 
**From a user's perspective** the user can use the EasyPub `Viewer`'s `TextBlock(s)`, `SectionBoundaryCard(s)`, and `sectionSideBar` to queue up edits that will be processed on the Epub. 

WHEN the user clicks the `Update Epub` Button, THEN a process runs that re-organizes the `Queue`. It then executes the changes, then creates a new Epub file. 


# Tech Stack
---
- Frontend: React 19, TypeScript, Vite, Tailwind CSS
- Backend: Express (Node.js) — server/index.js
- EPUB parsing (client): epubjs — loads and renders EPUB content documents
- EPUB manipulation (server): adm-zip (ZIP operations), cheerio (HTML DOM manipulation), fast-xml-parser (OPF/manifest parsing)
- State management: Plain React useState in ReaderView.tsx (no Redux/Zustand)
- Routing: None — conditional rendering via showHome boolean

# High-Level File Map
---
- src/views/ReaderView.tsx — The main file. Contains all top-level state, EPUB loading, queue execution, and most handler logic. This is where most bugs will be.
- src/views/Home.tsx — File selection screen
- src/components/viewer/ — Display components (Viewer.tsx, Section.tsx, TextBlock.tsx, SectionBoundaryCard.tsx)
- src/components/sectionSidebar/ — Section navigation sidebar
- src/components/QueueSidebar.tsx — Shows queued edits
- src/components/TopBar.tsx — Header with file controls
- src/types/reader.ts — Core type definitions (TextBlock, LoadedSection, SectionMeta, QueueItem)
- server/index.js — Express backend: EPUB upload, parsing, queue execution, history/undo
- workingFiles/ — Where uploaded EPUBs are stored; .history/ subfolder for backups

# Data Flow Overview
Loading flow:
User selects file on Home → POST /api/working-files uploads to workingFiles/
loadWorkingFile() fetches the EPUB binary → epubjs parses it client-side
Each section is rendered via section.render() → parseSectionBlocks() extracts blocks using DOMParser
Blocks are stored in sections state → rendered as TextBlock components
Editing flow:
User actions on TextBlocks/SectionBoundaryCards → items added to queueItems state
User clicks "Update Epub" → handleExecuteQueue() POSTs the full queue to /api/working-files/:filename/queue
Server processes actions sequentially using cheerio to manipulate HTML and adm-zip to rewrite the EPUB
Client polls /api/working-files/:filename/progress every 500ms for progress updates
On completion → EPUB is reloaded from scratch (full re-parse)

