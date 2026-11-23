## **Overview**
--------------------------------------------------
Easypub adds an id to each elememnt to enable smooth handline and manipulation of those blocks. Today, the id is retained on export. However, this results in unecessary artifacts that are inconsistent with our principle of exporting clean files. This ticket resolves that issue by adding a process to the export to strip these ids out on export. 

```
<p data-easypub-id="08d0ca72-0db6-440a-8e8c-a7a396cfa47e" style="text-align: justify;">
    The roots of Heidegger&apos;s thinking lie deep in the Western philosophical tradition. Yet that thinking is unique in many of its aspects, in its language and in its literary expression. In the development of his thought Heidegger has been taught chiefly by the Greeks, by German idealism, by phenomenology, and by the scholastic theological tradition. These and other elements have been fused by his genius of sensitivity and intellect into very individual philosophical expression.</p>
```

## **New Process Flow**
--------------------------------------------------

`data-easypub-id` is an editing aid only — not permanent book data. Same UUID across sessions does not matter. What matters: IDs exist for the whole time the user is building and applying a queue, so rearrange/delete/multi-action batches stay correctly targeted.

There is one working file: the zipped `.epub` in `workingFiles/` (opened in memory via AdmZip, overwritten on save). No separate unzipped working tree.

----------------------------------------------------------------------------------------------------

### **1. Open / start editing**

- User opens a book (or returns via **Continue editing**).
- Stamp `data-easypub-id` onto content blocks so the client can attach real `blockId`s to queue actions.
- User queues edits as today (IDs present → safe targeting for rearranges, deletes, multi-action batches).

### **2. Update Epub (save)**

1. User clicks **Update Epub** (or Cmd+S).
2. Queue starts → `ensureBlockIdsInHtml` stamps any missing IDs.
3. Apply queued actions (using those IDs).
4. **Strip** all `data-easypub-id` attributes from content docs.
5. Write zip → working `.epub` on disk is **clean**.
6. Show completion modal (blocking: no X, no click-outside, no Esc).

### **3. After save — three exits**

| User action | What happens | File on disk |
|-------------|--------------|--------------|
| **Continue editing** | Re-stamp IDs → reload reader → dismiss modal | Has IDs again (ready for next queue) |
| **Back Home** | Navigate to Home; do **not** re-stamp | Stays clean |
| Close the app / tab (no button) | Nothing else runs | Stays clean |

**Great!** goes away. The modal’s only intentional exits are **Continue editing** and **Back Home**.

----------------------------------------------------------------------------------------------------

### **Flow diagram**

```
Open book / Continue editing
        │
        ▼
  Stamp IDs (editing session armed)
        │
        ▼
  Queue edits (blockIds on actions)
        │
        ▼
  Update Epub
        │
        ├─ ensure IDs
        ├─ apply actions
        ├─ strip IDs
        └─ write zip  ──────────────►  clean .epub on disk
                │
                ▼
        Completion modal
           /         \
          /           \
 Continue editing   Back Home (or close app)
        │                 │
        ▼                 ▼
  Re-stamp + reload   Leave clean; go Home
  (stay in reader)
```

## **Implementation Plan**

### **Step 1: Server — strip helper + call it before write**

In [`server/index.js`](../../3_App/server/index.js):

- Add `stripBlockIdsInHtml(html)` — cheerio walk (same block set as `collectAllowedBlocks` / `ensureBlockIdsInHtml`), remove `data-easypub-id` from every matched element, return updated markup.
- Add `stripBlockIdsInZip(zip, opfPath, opfData)` — walk spine content docs, strip IDs in each, `zip.updateFile` when changed.
- In the queue processor, **after** all actions / endnotes / TOC / stylesheet work and **immediately before** `writeOpf` + `zip.writeZip(filePath)`, call `stripBlockIdsInZip`.
- Keep existing `ensureBlockIdsInHtml` at the **start** of queue processing (unchanged role: arm IDs for this apply batch).

Result: every successful Update Epub leaves a clean working `.epub` on disk.

----------------------------------------------------------------------------------------------------

### **Step 2: Server — explicit “stamp IDs” endpoint**

Add `POST /api/working-files/:filename/ensure-block-ids`:

- Open the working zip, run the same spine walk as today’s queue-start ensure (`ensureBlockIdsInHtml` per content doc), write zip if anything changed.
- Return `{ ok: true }` (or similar).

Call sites (client):

1. **Open book** from Home / file picker — stamp **before** `loadWorkingFile`, so parsed blocks get real `blockId`s.
2. **Continue editing** after save — stamp, then reload.

Do **not** call this on **Back Home** or when the user closes the app.

----------------------------------------------------------------------------------------------------

### **Step 3: Client — change post-save modal + exits**

[`ProgressBox.tsx`](../../3_App/src/components/ProgressBox.tsx) + [`Modal.tsx`](../../3_App/src/components/Modal.tsx) + [`ReaderView.tsx`](../../3_App/src/views/ReaderView.tsx):

- Replace **Great!** with two footer actions:
  - **Continue editing** (primary)
  - **Back Home** (secondary)
- Completion modal is **blocking**: omit `onClose` (no X). Do not dismiss on overlay click / Esc for this state (Modal already only shows X when `onClose` is passed; keep it that way).
- Wire handlers in `ReaderView`:
  - **Continue editing:** `POST .../ensure-block-ids` → `loadWorkingFile(selected)` → dismiss modal / `phase: idle`
  - **Back Home:** clear reader state so `showHome` is true (`book` null, clear queue/selection as on a fresh home) → dismiss modal — **no** ensure-block-ids call

Adjust `handleExecuteQueue` timing:

- Today: server complete → client auto-`loadWorkingFile` → then `phase: complete`.
- New options (pick one in impl; prefer A):
  - **A (preferred):** After server complete, set `phase: complete` **without** stamping. Optionally still reload the **clean** zip under the modal so the viewer matches disk, or defer reload until Continue / Back Home. Continue editing always stamps then loads.
  - **B:** Keep auto-reload of clean file under the modal; Continue editing stamps + reloads again.

Either way: do **not** stamp IDs as part of the automatic post-save path — only on Continue editing (and on open from Home).

----------------------------------------------------------------------------------------------------

### **Step 4: Client — stamp on open**

In `handleWorkingFileSelect` / upload-success path (anywhere that enters the reader for a book):

1. `POST .../ensure-block-ids`
2. Then `loadWorkingFile(filename)`

So the first queue of a session always has `blockId`s on actions (rearrange-safe).

----------------------------------------------------------------------------------------------------

### **Step 5: Docs / gap list**

- Update [`Future-Features.md`](../2_PRD/Future-Features.md) item about `data-easypub-id` residue — mark resolved by this ticket’s save+modal flow (or remove once shipped).
- Update [`Standard-Ebooks-Gap-Analysis.md`](../4_Standards/Standard-Ebooks-Gap-Analysis.md) row for `data-easypub-id` cleanup from 🔴 Gap → done (or note “stripped on every Update Epub”).
- Optionally align [`PRD_1.7`](../2_PRD/PRD_1.7_Indentation-and-Space-Breaks.md) cleanup line with this behavior.

----------------------------------------------------------------------------------------------------

### **Out of scope**

- Broader SE export cleanup (attribute order, indentation style, etc.)
- Separate “Clean for export” menu item (this ticket makes every save clean)
- Changing how `blockId` vs selector/index fallbacks work beyond ensuring IDs exist while editing

----------------------------------------------------------------------------------------------------

### **Acceptance criteria**

- WHEN Update Epub finishes, THEN no content doc in the working `.epub` contains `data-easypub-id`
- WHEN the completion modal is shown, THEN there is no X / dismiss path other than the footer buttons
- WHEN the user chooses **Continue editing**, THEN IDs are stamped, the reader reloads, and subsequent queued actions carry `blockId`s
- WHEN the user chooses **Back Home**, THEN they land on Home and the working `.epub` remains without `data-easypub-id`
- WHEN the user closes the app on the completion modal, THEN the working `.epub` remains without `data-easypub-id`
- WHEN the user opens a book from Home, THEN IDs are stamped before the reader parses sections
- WHEN a multi-action queue includes deletes/reorders, THEN actions still target the correct blocks (IDs present for the session)
