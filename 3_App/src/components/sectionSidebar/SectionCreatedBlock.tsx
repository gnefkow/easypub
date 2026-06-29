import { Button } from 'counterfoil-starter-kit'

type SectionCreatedBlockProps = {
  onUndo: () => void
}

export default function SectionCreatedBlock({
  onUndo,
}: SectionCreatedBlockProps) {
  return (
    <div
      className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
      data-component="SectionCreatedBlock"
    >
      <div className="flex items-center justify-between">
        <p>New Section Created</p>
        <Button variant="secondary" onClick={onUndo}>Undo</Button>
      </div>
    </div>
  )
}
