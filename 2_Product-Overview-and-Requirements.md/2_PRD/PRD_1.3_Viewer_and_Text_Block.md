# What is this page?
---
This is a detailed overview of the `Viewer` component and its children, in partcular, the **[TextBlock](/src/components/viewer/TextBlock.tsx) component. 


# About the TextBlock Component.
---
The `TextBlock` component is the primary way that users can edit each HTML/XHTML Element (<p>,<h1>,<blockquote>, etc...) in the an Epub's "Section" (Content Document). 

### Reminder on "actions"
Recall that "actions" refer to changes that users intend to make to the contents of an Epub. `Actions` are added to the `Queue`, and the actions are sequenced, then executed as a batch when the user clicks the "Update Epub" button. 

## Actions in the `TextBlock`. 
The TextBlock enables users to queue up actions to. 

 - **Change the XHTML/HTML Tag** Marks & queues content in the specified `TextBlock` (XHTML/HTML) for a tag change (between <p>, <h1>, <blockquote>, <ul>, etc...)

 - **Change the Justification** Marks  & queues the content in the `TextBlock` (XHTML/HTML element) to change alignment (right justified, centered, left justified.)

- **Delete** marks the content in the `TextBlock` (XHTML/HTML element) to be deleted.

- **Append to Previous** Marks the content in the specified `TextBlock` (XHTML/HTML element) to be appended to the `TextBlock` (XHTML/HTML element) that preceeds it. 

- **Append to Following** Marks the content in the specified `TextBlock` (XHTML/HTML element) to be appended to the `TextBlock` (XHTML/HTML element) that follows it. 

- **Add Text Block** Adds a new `TextBlock` (XHTML/HTML element) after the current text block. The new text block has text that says *New Text Block*


**Action Sequence:**
WHEN the user clicks the buttons to queue up actions, changes happen in the front end immediatley that tell the user that the action has been queued.
    - Display in `QueueSidebar`: the change that has been initiated is listed as a list item in the `QueueSidebar`
    - Changes to `TextBlock` Component: the component changes visual styles based on the specific change queued up. 
The changes aren't actually made until after the user executes the batch with the "Save Epub" button. 


# Hotkey Actions on the Viewer & Text Block. 

### **Hotkey Actions**
These hot keys should work *whether or not* the user has `PowerMode` engaged. 
- **Cmd Enter to Save TextArea (In TextBlock):** WHEN the user has the TextArea of a `TextBlock` selected, THEN they can push `Command Return` to Save changes. (The result is the same as if they selected the "Save" button). 
- **Cmd S to Update Epub:** WHEN the user is in the `Viewer` and they use `Cmd`+`S` on their keyboard, THEN it is the same as clicking the `Update Epub` Button. 


## **Power Mode**
Powermode is a mode that the user can toggle on/off. When power mode is powered on, the user can more quickly and easily navigate between `TextBlocks` to edit them.

**Engaging Power Mode**
*Power-Mode Toggle*: In the upper right corner of the `Viewer`, there is text that says: "Power Mode" and a toggle for toggling it on and off. 

**TextBlock Behaviour in Power Mode**
WHEN the user has PowerMode=on, 
THEN: 
- `TextBlock` elements have a "focus" state.
  - *One block at a time:* Only one `TextBlock` can be in focus at a time.
  - *Enter Focus State:* Users enter the focus state by clicking anywhere on the `TextBlock`. (If they click on the text, it still focuses the text input and begins editing.)
  - *Focus State Styling:* Focused blocks show an `fg-primary` border around the whole text block.
  - *Exit Focus State:* Users can exit focus on a `TextBlock` by either (1) clicking outside of all text blocks, or (2) pressing `esc` on the keyboard **while not editing**.

- **Power Mode state machine (important)**
  - **Unfocused**: no block is focused.
  - **TextBlock Focus (not editing)**: a block is focused; keyboard navigation and hotkeys apply to the block.
  - **Input Focus (editing)**: the block's textarea is focused; keystrokes apply to the textarea until the user exits editing.

- **Escape key behavior (two-phase)**
  - IF the user is in **Input Focus (editing)** and presses `esc` one time, THEN they exit editing (equivalent to Cancel) and return to **TextBlock Focus** on that same block.
  - IF the user is in **TextBlock Focus (not editing)** and presses `esc`, THEN they exit TextBlock focus (return to **Unfocused**).

- *Navigation & Hot Keys in TextBlock Focus (not editing)*
  - *Nav Up a TextBlock:* IF the user has a `TextBlock` in focus, THEN pushing `Cmd` + `up-arrow` changes the focus to the `TextBlock` above/before the currently focused one.
    - This action only navigates between blocks within the same section.
  - *Nav Down a TextBlock:* IF the user has a `TextBlock` in focus, THEN pushing `Cmd` + `down-arrow` changes the focus to the `TextBlock` below/after the currently focused one.
    - This action only navigates between blocks within the same section.
  - *Focus Input (begin editing):* IF the user has a `TextBlock` in focus, THEN pushing `return` switches to **Input Focus (editing)** on the block.
    - *On Save:* IF the user saves (via `Cmd` + `return` or the Save button), THEN focus switches from the textarea back to the `TextBlock` and is retained.
    - *On Cancel:* IF the user cancels (via `esc` or the Cancel button), THEN focus switches from the textarea back to the `TextBlock` and is retained.

- **Implementation note (guardrail for future bots)**
  - When handling `esc` inside the textarea to cancel editing, do not also trigger the "exit focus" behavior in the document-level key handler (i.e., prevent the Escape event from also clearing block focus).


----------------------------------------------------------------------------------------------------


## **Spellcheck**

Text blocks support optional spellcheck (red unknown words, green dictionary words in view mode). Spellcheck is toggled from the TopBar and does not modify saved epub content.

- **View mode:** Server-processed highlight spans in the block HTML display layer.
- **Edit mode:** TipTap (`TextBlockRichEditor`) with server-driven red underlines via ProseMirror decorations; browser native spellcheck is disabled.

Full behaviour, architecture, dictionary, API, and file map: **[PRD 1.6: Spellcheck and Dictionary](PRD_1.6_Spellcheck-and-Dictionary.md)**.

When working on spellcheck in `TextBlock` or `TextBlockRichEditor`, treat PRD 1.6 as the source of truth — not browser spellcheck defaults or ad-hoc TipTap marks.



