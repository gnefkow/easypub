import type { LoadedSection } from '../../types/reader'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SplitMarker = {
  afterIndex: number
  id: string
  newTitle: string
  newHref: string
}

export type BoundaryCardAction = {
  label: string
  onClick: () => void
  disabled?: boolean
}

export type BoundaryCardProps = {
  title: string
  status?: string
  actions: BoundaryCardAction[]
  editableTitle?: boolean
  onRename?: (nextTitle: string) => void
}

export type SectionContext = {
  section: LoadedSection | null
  nextSection: LoadedSection | null
  hasGap: boolean
  missingIndices: number[]
  splitMarker: SplitMarker | undefined
  splitTitle: string
  nextTitle: string
}

type SectionData = {
  sections: LoadedSection[]
  sectionOrder: number[]
  fullOrder: number[]
  splitMarkers: SplitMarker[]
  sectionTitles: Record<number, { title: string; href: string }>
}

type BoundaryCardCallbacks = {
  isMergeQueued: (fromHref: string, toHref: string) => boolean
  onQueueMerge: (fromHref: string, toHref: string) => void
  onUndoMerge: (fromHref: string, toHref: string) => void
  onDisplayHidden: (indices: number[]) => void
  onUndoSplit: (id: string) => void
  onRenameSection: (href: string, nextTitle: string) => void
}

// ---------------------------------------------------------------------------
// deriveSectionContext
//
// Pure function that derives all the domain state the Viewer needs for a
// single position in the section list. No callbacks, no side effects.
// ---------------------------------------------------------------------------

export function deriveSectionContext(
  sectionIndex: number,
  idx: number,
  data: SectionData
): SectionContext {
  const { sections, sectionOrder, fullOrder, splitMarkers, sectionTitles } = data

  const section = sections.find((item) => item.index === sectionIndex) ?? null

  const nextSectionIndexValue = sectionOrder[idx + 1]
  const nextSection =
    typeof nextSectionIndexValue === 'number'
      ? sections.find((item) => item.index === nextSectionIndexValue) ?? null
      : null

  const currentFullIndex = fullOrder.indexOf(sectionIndex)
  const nextFullIndex =
    typeof nextSectionIndexValue === 'number'
      ? fullOrder.indexOf(nextSectionIndexValue)
      : -1

  const hasGap =
    nextFullIndex > -1 && currentFullIndex > -1
      ? nextFullIndex - currentFullIndex > 1
      : false

  const missingIndices =
    hasGap && currentFullIndex > -1 && nextFullIndex > -1
      ? fullOrder.slice(currentFullIndex + 1, nextFullIndex)
      : []

  const splitMarker = splitMarkers.find(
    (marker) => marker.afterIndex === sectionIndex
  )

  const splitTitle = splitMarker ? splitMarker.newTitle : ''

  const nextTitle = nextSection
    ? sectionTitles[nextSection.index]?.title ||
      nextSection.href.replace(/\.x?html$/i, '')
    : ''

  return {
    section,
    nextSection,
    hasGap,
    missingIndices,
    splitMarker,
    splitTitle,
    nextTitle,
  }
}

// ---------------------------------------------------------------------------
// buildBoundaryCardProps
//
// Maps a SectionContext to the props for a SectionBoundaryCard, or returns
// null when no card should render at this position.
//
// SectionBoundaryCard variants (see Section_Manage-Sections.md):
//   queued-split  – new split marker, editable title + Undo
//   break         – default boundary, "Remove content document break"
//   queued-merge  – break queued for removal, Undo
//   gap           – hidden sections between loaded ones
//   load-more     – trailing card to load next section (see buildLoadMoreCardProps)
// ---------------------------------------------------------------------------

export function buildBoundaryCardProps(
  ctx: SectionContext,
  callbacks: BoundaryCardCallbacks
): BoundaryCardProps | null {
  const {
    section,
    nextSection,
    splitMarker,
    splitTitle,
    hasGap,
    missingIndices,
    nextTitle,
  } = ctx
  const {
    isMergeQueued,
    onQueueMerge,
    onUndoMerge,
    onDisplayHidden,
    onUndoSplit,
    onRenameSection,
  } = callbacks

  if (!section) return null

  // variant: queued-split
  if (splitMarker) {
    return {
      title: splitTitle,
      status: '',
      editableTitle: true,
      onRename: (nextTitleValue) =>
        onRenameSection(splitMarker.newHref, nextTitleValue),
      actions: [
        {
          label: 'Undo',
          onClick: () => onUndoSplit(splitMarker.id),
        },
      ],
    }
  }

  // No boundary card when there is no next section
  if (!nextSection) return null

  // variant: gap
  if (hasGap) {
    return {
      title: nextTitle,
      status: 'Some sections are not displayed.',
      actions: [
        {
          label: 'Display Hidden Sections',
          onClick: () => onDisplayHidden(missingIndices),
        },
      ],
    }
  }

  // variant: queued-merge
  if (isMergeQueued(section.href, nextSection.href)) {
    return {
      title: nextTitle,
      status: 'Break queued for removal',
      actions: [
        {
          label: 'Undo',
          onClick: () => onUndoMerge(section.href, nextSection.href),
        },
      ],
    }
  }

  // variant: break (default)
  return {
    title: nextTitle,
    status: '',
    actions: [
      {
        label: 'Remove content document break',
        onClick: () => onQueueMerge(section.href, nextSection.href),
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// buildLoadMoreCardProps
//
// Produces props for the trailing "load next section" card, or null when
// there are no more sections to load.
//
// variant: load-more
// ---------------------------------------------------------------------------

export function buildLoadMoreCardProps(
  nextSectionIndex: number | null,
  isLoadingSection: boolean,
  onLoadNextSection: () => void
): BoundaryCardProps | null {
  if (nextSectionIndex === null) return null

  return {
    title: '',
    status: '',
    actions: [
      {
        label: isLoadingSection ? 'Loading section…' : 'Load next section',
        onClick: onLoadNextSection,
        disabled: isLoadingSection,
      },
    ],
  }
}
