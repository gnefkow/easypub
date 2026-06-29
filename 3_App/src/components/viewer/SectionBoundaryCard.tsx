import { useEffect, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import { Button, Input } from 'counterfoil-starter-kit'

type Action = {
  label: string
  onClick: () => void
  disabled?: boolean
}

type SectionBoundaryCardProps = {
  title: string
  status?: string
  actions: Action[]
  editableTitle?: boolean
  onRename?: (nextTitle: string) => void
}

export default function SectionBoundaryCard({
  title,
  status,
  actions,
  editableTitle = false,
  onRename,
}: SectionBoundaryCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(title)
  const editContainerRef = useRef<HTMLDivElement>(null)
  const hasChanged = draftTitle.trim() !== title.trim()

  useEffect(() => {
    if (isEditing) {
      editContainerRef.current?.querySelector('input')?.focus()
    }
  }, [isEditing])

  return (
    <div
      className="w-full rounded-md border-0 bg-bg-secondary p-4 font-uiTypeface"
    >
      {title ? (
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            {!isEditing ? (
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                {editableTitle && (
                  <Button
                    icon={<Pencil size={16} />}
                    iconPosition="right"
                    aria-label="Edit section title"
                    onClick={() => {
                      setDraftTitle(title)
                      setIsEditing(true)
                    }}
                  />
                )}
              </div>
            ) : (
              <div ref={editContainerRef} className="space-y-2">
                <Input
                  value={draftTitle}
                  onChange={setDraftTitle}
                  type="text"
                />
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    onClick={() => {
                      if (!hasChanged || !onRename) {
                        return
                      }
                      onRename(draftTitle.trim())
                      setIsEditing(false)
                    }}
                    disabled={!hasChanged}
                  >
                    Save
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setDraftTitle(title)
                      setIsEditing(false)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            {status && (
              <p className="mt-1 text-sm text-slate-500">{status}</p>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {actions.map((action) => (
              <Button
                key={action.label}
                variant="secondary"
                onClick={action.onClick}
                disabled={action.disabled}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex justify-end gap-2">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant="secondary"
              onClick={action.onClick}
              disabled={action.disabled}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
