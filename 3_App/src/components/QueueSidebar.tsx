import type { QueueItem } from '../types/reader'
import Card from './Card'
import { Button } from 'counterfoil-starter-kit'

type QueueSidebarProps = {
  items: QueueItem[]
  onRemove: (id: string) => void
}

export default function QueueSidebar({ items, onRemove }: QueueSidebarProps) {
  return (
    <Card
      className="w-64 shrink-0 h-full overflow-auto"
      padding="md"
      data-component="QueueSidebar"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Queue
        </h2>
        <span className="text-xs text-slate-400">{items.length}</span>
      </div>
      <div className="mt-3 space-y-2 text-sm text-slate-700">
        {!items.length && (
          <div className="rounded-md border border-dashed border-slate-200 p-3 text-xs text-slate-400">
            No queued changes yet.
          </div>
        )}
        {items.map((item) => (
          <div key={item.id} className="rounded-md border border-slate-200 p-3">
            <p className="text-xs font-semibold text-slate-600">
              {item.action === 'merge'
                ? 'Content Break Removal'
                : item.action === 'change-tag'
                ? 'Tag Change'
                : item.action === 'append-block'
                ? 'Append Block'
                : item.action === 'add-block'
                ? 'Add Block'
                : item.action === 'delete-block'
                ? 'Delete Block'
                : item.action === 'split-section'
                ? 'Split Section'
                : item.action === 'edit-text'
                ? 'Edit Text'
                : item.action === 'edit-html'
                ? 'Edit Text'
                : item.action}
            </p>
            <p className="text-xs text-slate-500">{item.label}</p>
            {(item.action === 'edit-text' || item.action === 'edit-html') && (
              <p className="text-[10px] text-slate-400">
                {item.fromHref} · {(item.html?.length ?? item.text?.length ?? 0)} chars
              </p>
            )}
            <div className="mt-2">
              <Button variant="secondary" onClick={() => onRemove(item.id)}>
                Undo
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
