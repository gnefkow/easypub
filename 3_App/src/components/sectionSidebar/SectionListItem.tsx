import { Eye, EyeOff, Pencil } from 'lucide-react'
import { Button, Input } from 'counterfoil-starter-kit'
import { useEffect, useRef, useState } from 'react'

type SectionListItemProps = {
  title: string
  href: string
  isDisplayed: boolean
  isCurrent?: boolean
  onToggle: () => void
  onGoTo: () => void
  onRename: (href: string, nextTitle: string) => void
}

export default function SectionListItem({
  title,
  href,
  isDisplayed,
  isCurrent = false,
  onToggle,
  onGoTo,
  onRename,
}: SectionListItemProps) {
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
      className={`rounded-md p-3 hover:bg-[var(--bg-secondary-hover)] ${!isEditing ? 'cursor-pointer' : ''} ${isCurrent ? 'border-0 border-r-2 border-r-[var(--fg-primary)]' : 'border-0'}`}
      onClick={() => !isEditing && onGoTo()}
      data-component="SectionListItem"
    >
      <div className="flex flex-col gap-[0.75em] items-start">
        {!isEditing ? (
          <div className="flex items-center gap-[0.75em] w-full">
            <div onClick={(e) => e.stopPropagation()}>
              <Button
                variant="tertiary"
                icon={isDisplayed ? <Eye size={16} /> : <EyeOff size={16} />}
                iconPosition="left"
                aria-label={isDisplayed ? 'Hide section' : 'Show section'}
                onClick={onToggle}
              />
            </div>
            <p
              className={`text-body-1 font-semibold flex-1 ${isDisplayed ? 'text-text-primary' : 'text-text-secondary'}`}
            >
              {title}
            </p>
            <div onClick={(e) => e.stopPropagation()}>
              <Button
                variant="tertiary"
                icon={<Pencil size={16} />}
                iconPosition="right"
                aria-label="Edit section title"
                onClick={() => {
                  setDraftTitle(title)
                  setIsEditing(true)
                }}
              />
            </div>
          </div>
        ) : (
          <div
            ref={editContainerRef}
            className="space-y-[0.75em] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <Input
              value={draftTitle}
              onChange={setDraftTitle}
              type="text"
            />
            <div className="flex gap-[0.75em]">
              <Button
                variant="primary"
                onClick={() => {
                  if (!hasChanged) return
                  onRename(href, draftTitle.trim())
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
      </div>
    </div>
  )
}
