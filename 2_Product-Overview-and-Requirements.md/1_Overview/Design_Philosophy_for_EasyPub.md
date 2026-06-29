# design_philosophy

This philosophy outlines the pattern preferences for how our code should work in this project. 



### **Application Design Philosophy**

This project follows a **modular, parsimonious design philosophy**. When generating or modifying code, follow these rules strictly:

#### 1. File and Module Structure

- **No large “god files.”**
  - A single file should rarely exceed ~150–200 lines.
  - If a file grows, extract logic into smaller modules immediately.
- Separate concerns clearly:
  - UI components
  - state / logic (hooks, services)
  - styling abstractions
  - configuration
- Prefer **many small, boring files** over a few clever ones.

#### 2. Components

- Components should be **simple, composable, and narrowly scoped**.
- Avoid monolithic “Main.tsx” or “App.tsx” files containing full app logic.
- Each component should:
  - do *one thing*
  - accept explicit props
  - delegate logic when possible
- Favor composition over condition-heavy components.

#### 3. Styling

- **Styling is abstracted and semantic.**
- Do NOT inline raw colors, spacing values, or typography.
- Use design tokens and utility classes derived from them.
- Components should read semantically (e.g. `text-primary`, not `text-blue-500`).
- If styling logic becomes complex, extract it.

#### 4. State and Logic

- Business logic does not live inside UI components unless trivial.
- Reusable or non-visual logic should be:
  - custom hooks
  - helper modules
  - services
- Avoid tightly coupling state to rendering.

#### 5. General Code Style

- Prefer clarity over cleverness.
- Prefer explicitness over inference.
- Avoid premature abstraction, but **do not hesitate to refactor** once patterns emerge.
- Optimize for long-term readability and change, not shortest code.

#### 6. Defaults for AI-generated Code

When generating code:

- Assume this is a **real application**, not a demo or tutorial.
- Start with a reasonable folder structure.
- Ask to split files if something becomes large.
- Never place the entire app in a single file unless explicitly instructed.



### **Layout primitives**

We introduce layout primitives only to encode *rhythm and relationship*, not to replace CSS or enforce page structure. Layout components should remain simple, composable, and unsurprising.



### **Standardness over elegance.** 

Using standard protocols and packages is key to making things robust and easily fixable over time. When in doubt, we always choose the option that is the most popular because it will be understandable and supported by more human and AI developers.

- We are LESS concerned with: elegance, efficiency, speed. 

- We are MORE concerned with: standard patterns and packages, transparency, robustness.



## EasyPub Specifics

EasyPub is an application for formatting Pubs. We love Pubs because they are an open-source, standard format that is easy to read on many different devices and applications. Our principles here are:

- **Standard & Simple Pub files.** Do NOT get creative with Pub structures or formats. Our outputs should be an easy to read and sensible for anyone who works with Epub files. When planning, check w3.org/TR/epub-33/ to find patterns that will be the most standard and canonical.
- **W3C standards are core** whenever possible, use the guidelines on w3.org/TR/epub-33/
- **Garrish & Gylling: EPUB 3 Best Practices**: When something is unclear, or there are multiple possible solutions, refer to our copy of [EPUB 3 Best Practices](/0_resources/Garrish-and-Gylling%20_EPUB%203%20Best%20Practices/) for guidance. 

 