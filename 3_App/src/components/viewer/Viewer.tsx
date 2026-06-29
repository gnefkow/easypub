import { Fragment, useEffect, useMemo, useRef } from 'react'
import type { LoadedSection, TextBlock } from '../../types/reader'
import Section from './Section'
import SectionBoundaryCard from './SectionBoundaryCard'
import {
  deriveSectionContext,
  buildBoundaryCardProps,
  buildLoadMoreCardProps,
} from './viewerHelpers'

type BlockRef = { sectionIndex: number; blockId: string }

type ViewerProps = {
  sections: LoadedSection[]
  powerMode: boolean
  onTogglePowerMode: () => void
  viewerLanguage: string
  focusedBlock: BlockRef | null
  editingBlock: BlockRef | null
  onRequestFocusBlock: (sectionIndex: number, blockId: string) => void
  onRequestEditBlock: (sectionIndex: number, blockId: string) => void
  onRequestCommitEdit: (draftText: string) => void
  onRequestCancelEdit: () => void
  onRequestClickOutside: () => void
  sectionOrder: number[]
  fullOrder: number[]
  splitMarkers: { afterIndex: number; id: string; newTitle: string; newHref: string }[]
  sectionTitles: Record<number, { title: string; href: string }>
  isLoading: boolean
  isLoadingSection: boolean
  nextSectionIndex: number | null
  showDebug: boolean
  codePanelBlockId: string | null
  onSelectAction: (
    sectionIndex: number,
    block: TextBlock,
    action: string
  ) => void
  onChangeTag: (sectionIndex: number, block: TextBlock, nextTag: string) => void
  onChangeJustify: (sectionIndex: number, block: TextBlock, nextJustify: string) => void
  onRestoreBlock: (sectionIndex: number, block: TextBlock) => void
  onUndoAppend: (blockId: string) => void
  onToggleCode: (blockId: string) => void
  onLoadNextSection: () => void
  isMergeQueued: (fromHref: string, toHref: string) => boolean
  onQueueMerge: (fromHref: string, toHref: string) => void
  onUndoMerge: (fromHref: string, toHref: string) => void
  onDisplayHidden: (indices: number[]) => void
  onUndoSplit: (id: string) => void
  onRenameSection: (href: string, nextTitle: string) => void
  onSectionVisible?: (index: number) => void
  spellcheckEnabled: boolean
  selectedSpellWord: string | null
  onSelectSpellWord: (word: string | null) => void
  onAddToDictionary: (word: string) => void
}

export default function Viewer({
  sections,
  powerMode,
  onTogglePowerMode,
  viewerLanguage,
  focusedBlock,
  editingBlock,
  onRequestFocusBlock,
  onRequestEditBlock,
  onRequestCommitEdit,
  onRequestCancelEdit,
  onRequestClickOutside,
  sectionOrder,
  fullOrder,
  splitMarkers,
  sectionTitles,
  isLoading,
  isLoadingSection,
  nextSectionIndex,
  showDebug,
  codePanelBlockId,
  onSelectAction,
  onChangeTag,
  onChangeJustify,
  onRestoreBlock,
  onUndoAppend,
  onToggleCode,
  onLoadNextSection,
  isMergeQueued,
  onQueueMerge,
  onUndoMerge,
  onDisplayHidden,
  onUndoSplit,
  onRenameSection,
  onSectionVisible,
  spellcheckEnabled,
  selectedSpellWord,
  onSelectSpellWord,
  onAddToDictionary,
}: ViewerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const visibilityRatiosRef = useRef<Map<number, number>>(new Map())

  const focusedBlockId = powerMode ? focusedBlock?.blockId ?? null : null

  const focusedSectionBlocks = useMemo(() => {
    if (!focusedBlock) return null
    const section = sections.find((item) => item.index === focusedBlock.sectionIndex)
    return section?.blocks ?? null
  }, [sections, focusedBlock])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || !onSectionVisible) return

    const sectionElements = container.querySelectorAll('[id^="section-"]')
    if (sectionElements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const match = entry.target.id.match(/^section-(\d+)$/)
          if (match) {
            const index = parseInt(match[1], 10)
            visibilityRatiosRef.current.set(index, entry.intersectionRatio)
          }
        }
        let maxRatio = 0
        let maxIndex: number | null = null
        visibilityRatiosRef.current.forEach((ratio, index) => {
          if (ratio > maxRatio) {
            maxRatio = ratio
            maxIndex = index
          }
        })
        if (maxIndex !== null && maxRatio > 0) {
          onSectionVisible(maxIndex)
        }
      },
      { root: container, threshold: [0, 0.25, 0.5, 0.75, 1] }
    )

    sectionElements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [sectionOrder, onSectionVisible])

  useEffect(() => {
    if (!powerMode) return
    if (!focusedBlockId) return
    const container = scrollContainerRef.current
    if (!container) return
    const escapeSelector = (value: string) => {
      try {
        return CSS.escape(value)
      } catch {
        return value.replace(/"/g, '\\"')
      }
    }
    const el = container.querySelector(
      `[data-textblock-id="${escapeSelector(focusedBlockId)}"]`
    )
    if (el && 'scrollIntoView' in el) {
      ;(el as HTMLElement).scrollIntoView({ block: 'nearest' })
    }
  }, [powerMode, focusedBlockId])

  useEffect(() => {
    if (!powerMode) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key

      if (editingBlock) {
        if (key === 'Escape') {
          e.preventDefault()
          onRequestCancelEdit()
          return
        }
        return
      }

      if (!focusedBlock) return

      if (key === 'Escape') {
        e.preventDefault()
        onRequestClickOutside()
        return
      }

      if (key === 'Enter' && !e.metaKey) {
        const blocks = focusedSectionBlocks
        if (!blocks) return
        const current = blocks.find((block) => block.id === focusedBlock.blockId)
        if (!current) return
        if (current.tag.toLowerCase() === 'img') return
        e.preventDefault()
        onRequestEditBlock(focusedBlock.sectionIndex, focusedBlock.blockId)
        return
      }

      if (key === 'Delete' || key === 'Backspace') {
        const blocks = focusedSectionBlocks
        if (!blocks) return
        const current = blocks.find((block) => block.id === focusedBlock.blockId)
        if (!current) return
        e.preventDefault()
        onSelectAction(focusedBlock.sectionIndex, current, 'delete')
        return
      }

      if (!e.metaKey) return
      if (key !== 'ArrowUp' && key !== 'ArrowDown') return
      const blocks = focusedSectionBlocks
      if (!blocks) return
      const currentIndex = blocks.findIndex((block) => block.id === focusedBlock.blockId)
      if (currentIndex === -1) return
      const nextIndex = key === 'ArrowUp' ? currentIndex - 1 : currentIndex + 1
      if (nextIndex < 0 || nextIndex >= blocks.length) return
      e.preventDefault()
      onRequestFocusBlock(focusedBlock.sectionIndex, blocks[nextIndex].id)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [
    powerMode,
    focusedBlock,
    focusedSectionBlocks,
    editingBlock,
    onRequestCancelEdit,
    onRequestClickOutside,
    onRequestEditBlock,
    onRequestFocusBlock,
    onSelectAction,
  ])

  return (
    <section className="flex h-full flex-col gap-3" data-component="Viewer">
      <div className="flex items-center justify-end gap-4">
        {isLoading && <span className="text-xs text-slate-400">Loading…</span>}
        <label className="flex items-center gap-2 text-xs text-slate-600 select-none">
          <span>Power Mode</span>
          <input
            type="checkbox"
            checked={powerMode}
            onChange={onTogglePowerMode}
            className="h-4 w-4"
            style={{ accentColor: 'var(--fg-primary)' }}
            aria-label="Toggle Power Mode"
          />
        </label>
      </div>
      <div
        ref={scrollContainerRef}
        onMouseDownCapture={(event) => {
          const target = event.target as unknown
          if (!(target instanceof Element)) return
          const insideTextBlock = target.closest('[data-textblock-id]')
          if (!insideTextBlock) {
            onRequestClickOutside()
          }
        }}
        className="relative flex-1 overflow-auto rounded-lg border-0 bg-white shadow-sm"
      >
        <div className="mx-auto max-w-[600px] space-y-6 p-4">
          {sectionOrder.map((sectionIndex, idx) => {
            const ctx = deriveSectionContext(sectionIndex, idx, {
              sections,
              sectionOrder,
              fullOrder,
              splitMarkers,
              sectionTitles,
            })
            if (!ctx.section) return null
            const ctxSectionIndex = ctx.section.index

            const boundaryProps = buildBoundaryCardProps(ctx, {
              isMergeQueued,
              onQueueMerge,
              onUndoMerge,
              onDisplayHidden,
              onUndoSplit,
              onRenameSection,
            })

            return (
              <Fragment key={ctxSectionIndex}>
                <Section
                  section={ctx.section}
                  viewerLanguage={viewerLanguage}
                  powerMode={powerMode}
                  focusedBlockId={focusedBlockId}
                  editingBlockId={editingBlock?.blockId ?? null}
                  showDebug={showDebug}
                  codePanelBlockId={codePanelBlockId}
                  spellcheckEnabled={spellcheckEnabled}
                  selectedSpellWord={selectedSpellWord}
                  onSelectAction={onSelectAction}
                  onChangeTag={onChangeTag}
                  onChangeJustify={onChangeJustify}
                  onRestoreBlock={onRestoreBlock}
                  onUndoAppend={onUndoAppend}
                  onToggleCode={onToggleCode}
                  onRequestFocusBlock={onRequestFocusBlock}
                  onRequestEditBlock={onRequestEditBlock}
                  onRequestCommitEdit={onRequestCommitEdit}
                  onRequestCancelEdit={onRequestCancelEdit}
                  onSelectSpellWord={onSelectSpellWord}
                  onAddToDictionary={onAddToDictionary}
                />
                {boundaryProps && <SectionBoundaryCard {...boundaryProps} />}
              </Fragment>
            )
          })}

          {!sections.length && !isLoading && (
            <div className="flex h-[60vh] items-center justify-center text-sm text-slate-400">
              Load an EPUB to start reading.
            </div>
          )}

          {(() => {
            const loadMoreProps = buildLoadMoreCardProps(
              nextSectionIndex,
              isLoadingSection,
              onLoadNextSection
            )
            return loadMoreProps ? (
              <SectionBoundaryCard {...loadMoreProps} />
            ) : null
          })()}
        </div>
      </div>
    </section>
  )
}
