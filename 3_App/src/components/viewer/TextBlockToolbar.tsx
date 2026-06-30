import { memo } from 'react'
import { ArrowUpToLine, ArrowDownToLine, Trash2, ChevronDown, Plus, BookPlus } from 'lucide-react'
import { Button } from 'counterfoil-starter-kit'
import Dropdown from '../Dropdown'
import Tooltip from '../Tooltip'

const TAG_OPTIONS = [
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'li', 'pre', 'figure', 'figcaption',
  'table', 'ul', 'ol', 'section', 'article', 'img',
]

const JUSTIFY_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'justify', label: 'Full Justify' },
  { value: 'center', label: 'Center' },
]

type TextBlockToolbarProps = {
  tag: string
  justify: string | undefined
  selectedSpellWord: string | null
  onChangeTag: (nextTag: string) => void
  onChangeJustify: (nextJustify: string) => void
  onSelectAction: (action: string) => void
  onAddToDictionary: (word: string) => void
}

export default memo(function TextBlockToolbar({
  tag,
  justify,
  selectedSpellWord,
  onChangeTag,
  onChangeJustify,
  onSelectAction,
  onAddToDictionary,
}: TextBlockToolbarProps) {
  const isHrBlock = tag === 'hr'

  const dropdownItems = [
    { id: 'see', label: 'See Code', onSelect: () => onSelectAction('see') },
    { id: 'delete', label: 'Delete', onSelect: () => onSelectAction('delete') },
    ...(isHrBlock
      ? []
      : [
          {
            id: 'append-prev',
            label: 'Append to previous',
            onSelect: () => onSelectAction('append-prev'),
          },
          {
            id: 'append-next',
            label: 'Append to following',
            onSelect: () => onSelectAction('append-next'),
          },
        ]),
    { id: 'break-below', label: 'Break Section Below', onSelect: () => onSelectAction('break-below') },
  ]

  const plusMenuItems = [
    {
      id: 'add-block-above',
      label: 'Add Text Block Above',
      onSelect: () => onSelectAction('add-block-above'),
    },
    {
      id: 'add-block-below',
      label: 'Add Text Block Below',
      onSelect: () => onSelectAction('add-block-below'),
    },
    {
      id: 'add-space-break-above',
      label: 'Add Space Break Above',
      onSelect: () => onSelectAction('add-space-break-above'),
    },
    {
      id: 'add-space-break-below',
      label: 'Add Space Break Below',
      onSelect: () => onSelectAction('add-space-break-below'),
    },
  ]

  return (
    <div
      className="flex min-w-0 w-full items-center gap-2 rounded-md border border-slate-200 bg-transparent p-0 text-[11px] font-semibold text-slate-600 shadow-sm"
      onClick={(event) => event.stopPropagation()}
    >
      {!isHrBlock && (
        <>
          <select
            value={tag}
            onChange={(event) => onChangeTag(event.target.value)}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600"
          >
            {TAG_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt.toUpperCase()}
              </option>
            ))}
          </select>

          <select
            value={justify || 'left'}
            onChange={(event) => onChangeJustify(event.target.value)}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600"
          >
            {JUSTIFY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </>
      )}

      {isHrBlock && (
        <span className="px-2 py-1 text-[11px] font-semibold uppercase text-slate-500">
          Space Break
        </span>
      )}

      <div className="flex-1" />

      <div className="flex min-w-0 shrink items-center gap-1">
        {selectedSpellWord && !isHrBlock && (
          <Tooltip label={`Add "${selectedSpellWord}" to dictionary`}>
            <Button
              variant="tertiary"
              size="sm"
              icon={<BookPlus size={16} />}
              aria-label="Add to dictionary"
              onClick={() => onAddToDictionary(selectedSpellWord)}
            />
          </Tooltip>
        )}

        <Tooltip label="Add block or space break">
          <div className="inline-flex">
            <Dropdown
              variant="text"
              size="sm"
              showText={false}
              showIconLeft
              iconLeft={<Plus size={16} />}
              items={plusMenuItems}
            />
          </div>
        </Tooltip>

        {!isHrBlock && (
          <>
            <Tooltip label="Append to previous">
              <Button
                variant="tertiary"
                size="sm"
                icon={<ArrowUpToLine size={16} />}
                aria-label="Append to previous"
                onClick={() => onSelectAction('append-prev')}
              />
            </Tooltip>

            <Tooltip label="Append to following">
              <Button
                variant="tertiary"
                size="sm"
                icon={<ArrowDownToLine size={16} />}
                aria-label="Append to following"
                onClick={() => onSelectAction('append-next')}
              />
            </Tooltip>
          </>
        )}

        <Tooltip label="Delete">
          <Button
            variant="tertiary"
            size="sm"
            icon={<Trash2 size={16} />}
            aria-label="Delete"
            onClick={() => onSelectAction('delete')}
          />
        </Tooltip>

        <Dropdown
          items={dropdownItems}
          variant="text"
          size="sm"
          showText={false}
          iconRight={<ChevronDown />}
        />
      </div>
    </div>
  )
})
