import { useEffect, type MutableRefObject, type RefObject } from 'react'
import { Plus } from 'lucide-react'
import { Button } from 'counterfoil-starter-kit'
import EndnoteBlock from './EndnoteBlock'
import type { Endnote } from '../../types/reader'

type EndnotesSidebarProps = {
  scrollContainerRef: RefObject<HTMLDivElement | null>
  endnoteFocusScrollTargetRef: MutableRefObject<'viewer' | 'sidebar' | null>
  endnotes: Endnote[]
  focusedEndnoteUid: string | null
  editingEndnoteUid: string | null
  onRequestEdit: (uid: string) => void
  onNavigateToViewer: (uid: string) => void
  onCommit: (uid: string, text: string) => void
  onCancel: () => void
  onCreate: () => void
  onDelete: (uid: string) => void
}

function escapeSelector(value: string) {
  try {
    return CSS.escape(value)
  } catch {
    return value.replace(/"/g, '\\"')
  }
}

export default function EndnotesSidebar({
  scrollContainerRef,
  endnoteFocusScrollTargetRef,
  endnotes,
  focusedEndnoteUid,
  editingEndnoteUid,
  onRequestEdit,
  onNavigateToViewer,
  onCommit,
  onCancel,
  onCreate,
  onDelete,
}: EndnotesSidebarProps) {
  useEffect(() => {
    if (!focusedEndnoteUid) return
    if (endnoteFocusScrollTargetRef.current !== 'sidebar') return
    endnoteFocusScrollTargetRef.current = null
    const container = scrollContainerRef.current
    if (!container) return
    const row = container.querySelector(
      `[data-endnote-uid="${escapeSelector(focusedEndnoteUid)}"]`,
    )
    if (row && 'scrollIntoView' in row) {
      ;(row as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [focusedEndnoteUid, scrollContainerRef, endnoteFocusScrollTargetRef])

  return (
    <div
      ref={scrollContainerRef}
      className="w-72 shrink-0 h-full overflow-y-auto overflow-x-hidden rounded-lg font-uiTypeface bg-bg-secondary border-0 p-4"
      style={{ maxWidth: '18rem' }}
      data-component="EndnotesSidebar"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Endnotes
        </h2>
        <span className="text-xs text-slate-400">{endnotes.length}</span>
      </div>

      <div className="space-y-1">
        {endnotes.map((endnote, index) => (
          <EndnoteBlock
            key={endnote.uid}
            endnote={endnote}
            displayNumber={index + 1}
            isEditing={editingEndnoteUid === endnote.uid}
            isFocused={
              focusedEndnoteUid === endnote.uid && editingEndnoteUid !== endnote.uid
            }
            onRequestEdit={onRequestEdit}
            onNavigateToViewer={onNavigateToViewer}
            onCommit={onCommit}
            onCancel={onCancel}
            onDelete={onDelete}
          />
        ))}
      </div>

      {!endnotes.length && (
        <p className="text-xs text-slate-400 mb-3">
          No endnotes yet.
        </p>
      )}

      <div className="mt-3">
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus size={14} />}
          iconPosition="left"
          onClick={onCreate}
        >
          Add Endnote
        </Button>
      </div>
    </div>
  )
}
