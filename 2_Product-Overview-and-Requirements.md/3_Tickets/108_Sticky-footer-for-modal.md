---
**Keywords**: modal, sticky footer, ProgressBox, Update Epub, Great button, scroll, max-height, Modal.tsx, bg-primary
---

## **Intended behaviour**

WHEN the user clicks the "Update Epub" button, THEN a modal displays listing the update with a "Great" button at the bottom of it.

**Issue:** When the list is long, the "Great" button gets pushed below the fold of the page.

**Update for this ticket:**
- The "Great" button should be wrapped in a div that is the full width of the modal and has the background `bg-primary`
- The modal has a maximum height of 80% of the height of the view port in the browser
- The list of updates should be contained within a div
- WHEN the list is longer, THEN it scrolls within the list, and the button div is not pushed below the fold

----------------------------------------------------------------------------------------------------
## **Design and Rationale**

### **Root cause**

`ProgressBox` renders the step list and the "Great!" button as normal stacked content inside the shared `Modal`. When there are many steps, the modal card grows with the content and the footer button scrolls off screen. `ProgressBox` currently applies its own scroll cap (`max-h-64`) on the list, but that does not pin the footer or cap the overall modal height.

### **Chosen approach: opt-in sticky footer on `Modal`**

Extend the shared `Modal` component with an explicit sticky-footer mode rather than baking layout overrides into each caller.

**API:**
- `stickyFooter?: boolean` — defaults to `false`. When `true`, enables sticky-footer layout on the modal card.
- `footer?: ReactNode` — footer content (e.g. the "Great!" button). Only passed when the caller has footer content to show.

**Layout behaviour when `stickyFooter` is true:**
- Modal card: `max-h-[80vh]`, flex column
- **Header** (title row): fixed at top — does not scroll
- **Body** (`children`): scrollable region (`flex-1`, `overflow-auto`, `min-h-0`)
- **Footer bar**: full width, `bg-primary`, with padding — pinned at bottom; callers do not set the background themselves

**ProgressBox usage:**
- Pass `stickyFooter` and `footer` **only when `isComplete`** (update finished and "Great!" is shown)
- During in-progress phases, use the default modal layout (no sticky footer, no footer prop)
- Remove ProgressBox-specific scroll/layout classes (`max-h-64`, footer wrapper margins) — Modal owns that in sticky mode

**Out of scope for this ticket:**
- Dictionary modal in `ReaderView` — unchanged for now; can opt into `stickyFooter` later if needed
- File History modal — uses its own inline markup, not `Modal.tsx`

### **Acceptance criteria**

- WHEN the epub update completes AND the step list is long enough to overflow, THEN the modal does not exceed 80vh and the title stays visible at the top
- WHEN the list overflows, THEN the list scrolls inside the modal body and the "Great!" button remains visible in a full-width `bg-primary` footer bar
- WHEN the update is still in progress, THEN the modal behaves as today (default layout, no sticky footer)
- WHEN the Dictionary modal is opened, THEN it is unchanged (default `Modal` layout)

### **Files likely touched**

- `3_App/src/components/Modal.tsx` — new `stickyFooter` and `footer` props; conditional layout structure
- `3_App/src/index.css` — modifier class for sticky modal card (flex column, max-height, body scroll, footer bar styles using theme tokens)
- `3_App/src/components/ProgressBox.tsx` — adopt new Modal API; remove local scroll/footer layout

----------------------------------------------------------------------------------------------------
## **Implementation Plan**

### **Step 1: Add sticky-footer modifier styles in `index.css`**

Add a modifier on `.modal-card` (e.g. `.modal-card--sticky-footer`) that applies only when `stickyFooter` is true:

- `max-height: 80vh`
- `display: flex; flex-direction: column`
- `overflow: hidden` on the card (scroll lives in the body region, not the card itself)
- Adjust padding if needed so the footer bar can be edge-to-edge (footer wrapper may use negative horizontal margin or the card drops bottom padding in sticky mode — pick whichever keeps the footer flush and full width)

Add nested classes or element selectors for:
- **Body region** — `flex: 1; min-height: 0; overflow: auto`
- **Footer bar** — full width, `background-color: var(--bg-primary)` (theme token, not hard-coded hex), appropriate padding for the button

Keep existing `.modal-card` styles unchanged for the default (non-sticky) path.

### **Step 2: Extend `Modal.tsx` props and layout**

Update `ModalProps`:

```typescript
type ModalProps = {
  open: boolean
  title?: string
  onClose?: () => void
  children: ReactNode
  widthClassName?: string
  stickyFooter?: boolean   // default false
  footer?: ReactNode
}
```

When `stickyFooter` is false (default): render exactly as today — title row + `{children}`.

When `stickyFooter` is true:
1. Add `modal-card--sticky-footer` to the card class list
2. Render title row (fixed header)
3. Wrap `{children}` in a scrollable body div
4. If `footer` is provided, render it inside the full-width `bg-primary` footer bar

Do not require `footer` when `stickyFooter` is true — ProgressBox will only enable sticky mode when the footer exists anyway.

### **Step 3: Update `ProgressBox.tsx`**

1. Remove `max-h-64 overflow-auto` (and related layout classes) from the step list wrapper — scrolling is handled by Modal body in sticky mode
2. Remove the local footer wrapper (`mt-4 flex justify-end`) around "Great!"
3. When `isComplete`:
   - Pass `stickyFooter` to `Modal`
   - Pass `footer={<Button variant="primary" size="lg" onClick={onDismiss}>Great!</Button>}`
4. Keep the step list as `{children}` only

Example target shape:

```tsx
<Modal
  open={visible}
  title={displayTitle}
  onClose={onDismiss}
  stickyFooter={isComplete}
  footer={
    isComplete ? (
      <Button variant="primary" size="lg" onClick={onDismiss}>
        Great!
      </Button>
    ) : undefined
  }
>
  <div className="mt-3 space-y-2 text-xs text-slate-700" data-component="ProgressBox">
    {/* steps */}
  </div>
</Modal>
```

Align footer button horizontally (e.g. right-aligned within the footer bar) in `Modal.tsx` so callers do not repeat flex layout.

### **Step 4: Manual test plan**

Prerequisites: dev server running (`npm run dev`), a book loaded with enough queued changes to produce a long step list (or use **Show ProgressBox** from the TopBar dropdown to force the modal open, then complete the flow).

1. **Short list, complete:** Run a small update → modal completes → "Great!" appears in footer bar with `bg-primary` background
2. **Long list, complete:** Run an update with many queued changes → modal height caps at ~80vh → title stays visible → list scrolls inside body → "Great!" stays pinned at bottom
3. **In progress:** While update is running → default modal layout (no sticky footer bar)
4. **Dismiss:** Click "Great!" or close (X) → modal closes as today
5. **Dictionary modal:** Open Dictionary from TopBar → unchanged layout (no sticky footer regression)
6. **Theme:** Confirm footer bar uses theme `bg-primary` token (matches modal card background in light/dark if applicable)

### **Step 5: PRD update (if needed)**

After implementation, check whether any PRD documents describe modal behaviour. If not documented elsewhere, no PRD change required — this is a shared UI component improvement scoped to ProgressBox for v1.
