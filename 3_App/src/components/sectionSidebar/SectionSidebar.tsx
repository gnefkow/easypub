import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Button } from 'counterfoil-starter-kit'
import Card from '../Card'
import SectionListItem from './SectionListItem'

type SectionMeta = {
  index: number
  href: string
  title: string
  loading?: boolean
}

type SectionSidebarProps = {
  sections: SectionMeta[]
  displayedSections: Record<number, boolean>
  currentSectionIndex: number | null
  onToggle: (index: number) => void
  onGoTo: (index: number) => void
  onRename: (href: string, nextTitle: string) => void
  loading?: boolean
}

export default function SectionSidebar({
  sections,
  displayedSections,
  currentSectionIndex,
  onToggle,
  onGoTo,
  onRename,
  loading = false,
}: SectionSidebarProps) {
  const [isOpen, setIsOpen] = useState(true)

  if (!isOpen) {
    return (
      <div
        className="w-6 shrink-0 h-full rounded-lg bg-bg-primary hover:bg-bg-primary-hover cursor-pointer flex flex-col items-center pt-4"
        onClick={() => setIsOpen(true)}
        data-component="SectionSidebar"
      >
        <Menu size={16} />
      </div>
    )
  }

  return (
    <Card
      className="max-w-[360px] shrink-0 h-full overflow-auto font-uiTypeface bg-bg-secondary border-0"
      padding="md"
      data-component="SectionSidebar"
    >
      <div className="mb-2">
        <Button
          variant="tertiary"
          icon={<Menu size={16} />}
          iconPosition="left"
          onClick={() => setIsOpen(false)}
        >
          Sections
        </Button>
      </div>
      <div className="space-y-2 text-sm text-slate-700">
        {loading && !sections.length && (
          <>
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`skeleton-${index}`}
                className="h-14 rounded-md border border-dashed border-slate-200 bg-slate-100"
              />
            ))}
          </>
        )}
        {!loading && !sections.length && (
          <div className="rounded-md border border-dashed border-slate-200 p-3 text-xs text-slate-400">
            No sections loaded yet.
          </div>
        )}
        {sections.map((section) =>
          section.loading ? (
            <div
              key={`loading-${section.index}`}
              className="h-14 rounded-md border border-dashed border-slate-200 bg-slate-100"
            />
          ) : (
            <SectionListItem
              key={section.index}
              title={section.title}
              href={section.href}
              isDisplayed={!!displayedSections[section.index]}
              isCurrent={currentSectionIndex === section.index}
              onToggle={() => onToggle(section.index)}
              onGoTo={() => onGoTo(section.index)}
              onRename={onRename}
            />
          )
        )}
      </div>
    </Card>
  )
}
