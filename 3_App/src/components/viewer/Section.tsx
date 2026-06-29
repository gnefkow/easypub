import { memo } from 'react'
import type { LoadedSection, TextBlock } from '../../types/reader'
import TextBlockComponent from './TextBlock'

type SectionProps = {
  section: LoadedSection
  viewerLanguage: string
  powerMode: boolean
  focusedBlockId: string | null
  editingBlockId: string | null
  showDebug: boolean
  codePanelBlockId: string | null
  spellcheckEnabled: boolean
  selectedSpellWord: string | null
  onSelectAction: (sectionIndex: number, block: TextBlock, action: string) => void
  onChangeTag: (sectionIndex: number, block: TextBlock, nextTag: string) => void
  onChangeJustify: (sectionIndex: number, block: TextBlock, nextJustify: string) => void
  onRestoreBlock: (sectionIndex: number, block: TextBlock) => void
  onUndoAppend: (blockId: string) => void
  onToggleCode: (blockId: string) => void
  onRequestFocusBlock: (sectionIndex: number, blockId: string) => void
  onRequestEditBlock: (sectionIndex: number, blockId: string) => void
  onRequestCommitEdit: (draftText: string) => void
  onRequestCancelEdit: () => void
  onSelectSpellWord: (word: string | null) => void
  onAddToDictionary: (word: string) => void
}

export default memo(function Section({
  section,
  viewerLanguage,
  powerMode,
  focusedBlockId,
  editingBlockId,
  showDebug,
  codePanelBlockId,
  spellcheckEnabled,
  selectedSpellWord,
  onSelectAction,
  onChangeTag,
  onChangeJustify,
  onRestoreBlock,
  onUndoAppend,
  onToggleCode,
  onRequestFocusBlock,
  onRequestEditBlock,
  onRequestCommitEdit,
  onRequestCancelEdit,
  onSelectSpellWord,
  onAddToDictionary,
}: SectionProps) {
  return (
    <div
      id={`section-${section.index}`}
      data-component="Section"
      className="viewer-section space-y-4 rounded-md"
    >
      {section.blocks.map((block) => (
        <TextBlockComponent
          key={block.id}
          block={block}
          sectionIndex={section.index}
          viewerLanguage={viewerLanguage}
          isFocused={powerMode && focusedBlockId === block.id}
          powerMode={powerMode}
          isEditing={editingBlockId === block.id}
          showDebug={showDebug}
          isCodeOpen={codePanelBlockId === block.id}
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
      ))}
    </div>
  )
})
