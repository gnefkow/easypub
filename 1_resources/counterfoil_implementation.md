# Counterfoil Implementation

Token-efficient reference for AI bots. Use `@0_resources/counterfoil_implementation.md` when working on UI to avoid loading node_modules or the full package README.

When making changes to the code that involve Counterfoil, make sure to ask whether a update should also be made to this readme.
---

## Overview

Counterfoil-starter-kit is a modular React component library with semantic design tokens, built with TypeScript and Tailwind CSS. Source: `github:gnefkow/counterfoil-kit`. easy-pub uses all available components; custom UI components are deprecated in favor of counterfoil.

---

## Setup

- **CSS:** [src/index.css](src/index.css) — Option A: `semanticTokens.css` + `CounterfoilComponents.css`
- **Tailwind:** [tailwind.config.ts](tailwind.config.ts) — preset + content scanning for `node_modules/counterfoil-starter-kit/dist/**`
- **Tokens:** Custom components use `var(--bg-primary)`, `var(--border-tertiary)`, etc. (see [src/index.css](src/index.css) `@layer components`)

---

## Components Reference

### Primitives

| Component | Props | Usage |
|-----------|-------|-------|
| Button | variant, size, width, icon, iconPosition, disabled | Primary/secondary/tertiary actions; icon-only (tertiary) |
| Card | children | Surface container; use Stack inside for layout |
| Stack | gap (xs/sm/m/lg/xl), className | Vertical layout |
| Inline | gap, align | Horizontal layout |
| Text | hierarchy, size, weight | Typography; use instead of raw spans |

### Form

| Component | Use when | Props |
|-----------|----------|-------|
| Input | Raw control (inline edit) | value, onChange, type |
| InputField | Labeled form field | label, value, onChange, type, description, errorText |
| Textarea | Raw multiline | value, onChange, rows |
| TextareaField | Labeled multiline | label, value, onChange, rows |
| Checkbox / CheckboxField | Boolean toggle | checked, onChange |
| Radio / RadioField | Single-select from options | name, value, checked, onChange |

### Data

| Component | Usage |
|-----------|-------|
| Table, TableHeader, TableBody, TableRow, TableHeaderCell, TableCell, TableFooter, TableEmptyState | Tabular data; Table accepts stickyHeader, density, maxHeight |

### Navigation

| Component | Props | Usage |
|-----------|-------|-------|
| Tab | label, selected, icon, iconPosition, size | Single tab |
| TabBar | tabs, selectedId, onSelect, size | Tab container |

---

## Conventions

- **Icons:** Import from `lucide-react` (e.g. `import { Pencil, Eye } from 'lucide-react'`). Pass `size={16}` for sm/md buttons.
- **Button variants:** primary (main action), secondary (cancel/undo), tertiary (icon-only, subtle)
- **Layout:** Card does not control spacing; wrap content in `Stack` or `Inline` inside Card
- **Design tokens:** Use `var(--token-name)` in custom CSS; avoid hardcoded colors when tokens exist

---

## Design Tokens Quick Reference

- Backgrounds: `--bg-primary`, `--bg-primary-hover`, `--bg-secondary`, `--bg-secondary-hover`, `--bg-tertiary`, `--bg-surface`
- Text: `--text-primary`, `--text-secondary`, `--text-tertiary`, `--fg-primary`
- Borders: `--border-primary`, `--border-secondary`, `--border-tertiary`
- Button tokens: `--button-primary-bg`, etc. (override in `:root` for theming)

See `node_modules/counterfoil-starter-kit/styles/semanticTokens.css` for the complete list.

---

## Migration Notes

- **Card:** Custom [src/components/Card.tsx](src/components/Card.tsx) is deprecated. Replace with counterfoil `Card` + `Stack` for padding/layout. Example: `<Card><Stack gap="m">{children}</Stack></Card>` with padding via Stack or className.
- **TagBadge:** Consider migrating to counterfoil `Text` with appropriate hierarchy/size, or keep as custom if it serves a distinct purpose.

---

## Implementation Log

- **2025-02-10:** Document created
  - Button, Input, Textarea in use (SectionBoundaryCard, SectionListItem, TextBlock, QueueSidebar, SectionGapIndicator, SectionCreatedBlock, ProgressBox, TopBar, Dropdown)
  - Card migration planned; custom Card still in use (QueueSidebar, SectionSidebar)
