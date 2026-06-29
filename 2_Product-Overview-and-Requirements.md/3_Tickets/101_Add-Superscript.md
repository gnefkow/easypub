In this ticket, we add superscript and sub-script text to the edit bar on the text edit block of the `TextBlock`. 
The Superscript Button and SubScript button should both be next to the Italics button. 


## Plan: Add Superscript and Subscript to Text Edit Bar

### Context
- **Location**: The inline format toolbar lives in `InlineFormatToolbar.tsx` and is shown when editing a `TextBlock` (inside `TextBlockRichEditor`). It currently has Bold and Italic; Superscript and Subscript buttons go next to Italic.
- **Stack**: TipTap editor (v3.20.x), React, TypeScript. Output must remain standard HTML for EPUB (W3C / EPUB 3); `<sup>` and `<sub>` are valid and preferred.
- **Design**: Follow Design Philosophy: small modules, semantic styling, no inline magic values; keep toolbar component simple and explicit.

### Steps

1. **Add TipTap extensions**
   - Install `@tiptap/extension-superscript` and `@tiptap/extension-subscript` (versions compatible with existing `@tiptap/*` ^3.20.0).
   - In `TextBlockRichEditor.tsx`, register `Superscript` and `Subscript` in the `useEditor` `extensions` array (alongside existing StarterKit). No custom HTML attributes needed for standard `<sup>` / `<sub>` output.

2. **Toolbar UI**
   - In `InlineFormatToolbar.tsx`, add two buttons immediately after the Italic button:
     - **Superscript**: icon (e.g. Lucide `Superscript`), `aria-label="Superscript"`, `editor.isActive('superscript')`, `editor.chain().focus().toggleSuperscript().run()`, same tertiary/sm styling and pressed state as Bold/Italic.
     - **Subscript**: icon (e.g. Lucide `Subscript`), `aria-label="Subscript"`, `editor.isActive('subscript')`, `editor.chain().focus().toggleSubscript().run()`, same pattern.
   - Wrap each in `Tooltip` with short labels (e.g. "Superscript", "Subscript"). Optional: add keyboard shortcuts in tooltips if the extensions define them (e.g. Ctrl+, for subscript) and document in tooltip.

3. **Sanitizer**
   - In `sanitizeInlineHtml.ts`, add `sup` and `sub` to `ALLOWED_TAGS` so committed HTML preserves superscript/subscript when saving the block. This keeps output valid for EPUB and avoids stripping these tags.

4. **Verify**
   - In the viewer, focus a text block and enter edit mode: confirm Bold, Italic, Superscript, Subscript appear in that order and toggle correctly.
   - Type text, apply superscript/subscript, save; re-open the block and confirm the formatting persists.
   - Confirm saved section HTML in the EPUB uses `<sup>` and `<sub>` (e.g. via See Code or by inspecting the updated content document).

### Files to touch
- `package.json` — add dependencies (or run install command that updates it).
- `src/components/viewer/richText/TextBlockRichEditor.tsx` — register Superscript and Subscript extensions.
- `src/components/viewer/richText/InlineFormatToolbar.tsx` — add Superscript and Subscript buttons after Italic.
- `src/components/viewer/richText/sanitizeInlineHtml.ts` — allow `sup` and `sub` in `ALLOWED_TAGS`.

### Out of scope
- Keyboard shortcuts are optional; the ticket only requires the buttons. If added, keep them consistent with existing toolbar tooltips.
- No changes to block-level actions (tag, justify, delete, append, etc.); only the inline format toolbar in the text edit block is in scope.