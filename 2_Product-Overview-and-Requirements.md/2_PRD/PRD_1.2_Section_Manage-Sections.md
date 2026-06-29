# What is this page?
---
`Section` is the EasyPub nickname for `Epub Content Documents`
This page contains expected behaviours for `Sections`.
Refer to this page to understand these expected behaviours.  This is particularly important if we are:
**1. Building something new** where we'll put the requirements, and you can also see the other existing behaviours so that we don't have collisions and errors. 
**2. Fixing bugs** so we can see what the expected behaviour is supposed to be.

### Front-End Components
View front end components that relate specifically to `Section` in the [Viewer](../src/components/viewer) and the [sectionSidebar](../src/components/sectionSidebar/)

# "Sections" Overview
---
### **Section Displays**
By default, the first `Section`of the Epub displays in the `Viewer` 


### **Section Boundary Card**
The `Section Boundary Card` (SectionBoundaryCard.tsx) displays between each `Section`. 

***Actions on the `Section Boundary Card` enable users to:***
- Load more sections into view in the `Viewer`
- Add an `Edit Action` to the `Queue` that will combine two `Sections` with the "Remove content document break" button. 
- Rename a `Section`

***Varients of the `Section Boundary Card`***
*These "variants" are only for documentation and communication, they are not programed into the [SectionBoundaryCard Component](../src/components/viewer/SectionBoundaryCard.tsx). The logic for them lives in viewerHelper.ts.
The SectionBoundaryCard appears in one of five variants depending on context:
    - **Break** — A normal boundary between two content documents (shows "Remove content document break")
    - **Gap** — Hidden sections exist between two loaded ones (shows "Display Hidden Sections")
    - **Load-More** — Appears at the bottom when more sections are available (shows "Load next section")
    - **Queued-Split** — A newly created section break (shows editable title + "Undo")
    - **Queued-Merge** — A break the user has queued for removal (shows "Break queued for removal" + "Undo")

### **sectionSidebar**
The `Section Sidebar` (src/components/sectionSidebar folder contains the components for this component) is a component that enables users to:
- Navigate the `viewer` to show a different section (by either scrolling in the `viewer` or setting a `section` to display).
- Hide or display the `Sections` that display in the `Viewer`
- Rename a `Section`


# Details
---

## Creating a section.
Out in the world, many Epub generators arbitrarily smash things together (for instance, multiple chapters) into one Content Document, where multiple is better. The EasyPub app provides a solution with the "Break Section" action. 

When users create a `Section` what they are really doing is queueing up an action that splits an existing Epub `Content Document` into two. 

How users can create a `Section`: Users can create a section by selecting a `TextBox` in the `Viewer` and using the "Break Section Below" option. WHEN users click this option, THEN:
1. The break is added to the Queue (so it can be executed when the user pushes the "UpdateEpub" button).
2. The interface immediately registers the action by: 
    -  **Displaying a [SectionBoundaryCard.tsx](../src/components/viewer/SectionBoundaryCard.tsx)**  with the `queued-split` variant.
    - **Adds a `SectionListItem`** to the `sectionSidebar`
    - **A new randomized name is created** and displays in both the `SectionListItem` for the section and in the `SectionBoundaryCard`. The name is "New Section {random number}. Users can edit the name in either the `SectionListItem` or the `SectionBoundaryCard`. 
    - IF the `QueueSidebar` is displayed, THEN a list item for the queued Content Break (Section) split is displayed.
