import { Button } from 'counterfoil-starter-kit'

type SectionGapIndicatorProps = {
  onDisplayHidden: () => void
}

export default function SectionGapIndicator({
  onDisplayHidden,
}: SectionGapIndicatorProps) {
  return (
    <div className="rounded-full border border-amber-200 bg-amber-50 px-4 py-1 text-[11px] font-semibold text-amber-700">
      <span className="mr-2">Some sections are not displayed.</span>
      <Button variant="secondary" onClick={onDisplayHidden}>
        Display Hidden Sections
      </Button>
    </div>
  )
}
