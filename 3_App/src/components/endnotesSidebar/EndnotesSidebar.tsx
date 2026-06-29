import { Plus } from 'lucide-react'
import { Button } from 'counterfoil-starter-kit'
import Card from '../Card'
import EndnoteBlock from './EndnoteBlock'
import type { Endnote } from '../../types/reader'

type EndnotesSidebarProps = {
  endnotes: Endnote[]
  editingEndnoteUid: string | null
  onRequestEdit: (uid: string) => void
  onCommit: (uid: string, text: string) => void
  onCancel: () => void
  onCreate: () => void
  onDelete: (uid: string) => void
}

export default function EndnotesSidebar({
  endnotes,
  editingEndnoteUid,
  onRequestEdit,
  onCommit,
  onCancel,
  onCreate,
  onDelete,
}: EndnotesSidebarProps) {
  return (
    <Card
      className="w-72 shrink-0 h-full overflow-y-auto overflow-x-hidden font-uiTypeface bg-bg-secondary border-0"
      style={{ maxWidth: '18rem' }}
      padding="md"
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
            onRequestEdit={onRequestEdit}
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
    </Card>
  )
}
