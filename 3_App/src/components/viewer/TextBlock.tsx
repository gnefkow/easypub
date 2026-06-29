import type { CSSProperties, ElementType, MouseEvent as ReactMouseEvent } from 'react'
import { memo, useRef, useState } from 'react'
import type { TextBlock as TextBlockType } from '../../types/reader'
import { Button } from 'counterfoil-starter-kit'
import TextBlockToolbar from './TextBlockToolbar'
import TextBlockRichEditor from './richText/TextBlockRichEditor'

type TextBlockProps = {
  block: TextBlockType
  sectionIndex: number
  viewerLanguage: string
  isFocused: boolean
  powerMode: boolean
  isEditing: boolean
  showDebug: boolean
  isCodeOpen: boolean
  spellcheckEnabled: boolean
  selectedSpellWord: string | null
  onSelectAction: (sectionIndex: number, block: TextBlockType, action: string) => void
  onChangeTag: (sectionIndex: number, block: TextBlockType, nextTag: string) => void
  onChangeJustify: (sectionIndex: number, block: TextBlockType, nextJustify: string) => void
  onRestoreBlock: (sectionIndex: number, block: TextBlockType) => void
  onUndoAppend: (blockId: string) => void
  onToggleCode: (blockId: string) => void
  onRequestFocusBlock: (sectionIndex: number, blockId: string) => void
  onRequestEditBlock: (sectionIndex: number, blockId: string) => void
  onRequestCommitEdit: (draftText: string) => void
  onRequestCancelEdit: () => void
  onSelectSpellWord: (word: string | null) => void
  onAddToDictionary: (word: string) => void
  fetchSpellcheckHtml: (html: string) => Promise<string | null>
}

export default memo(function TextBlock({
  block,
  sectionIndex,
  viewerLanguage,
  isFocused,
  powerMode,
  isEditing,
  showDebug,
  isCodeOpen,
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
  fetchSpellcheckHtml,
}: TextBlockProps) {
  const tag = block.tag.toLowerCase()
  const Tag = tag as ElementType
  const isAppendingTarget = !!block.queuedWithAppend
  const [isHovered, setIsHovered] = useState(false)
  const shouldAutoCommitRef = useRef(true)

  const tagTypographyClass: Record<string, string> = {
    h1: 'text-h-1 font-heavy',
    h2: 'text-h-2 font-heavy',
    h3: 'text-h-3 font-heavy',
    h4: 'text-h-4 font-heavy',
    h5: 'text-h-5 font-heavy',
    h6: 'text-h-6 font-heavy',
    p: 'text-body-1',
    blockquote: 'text-body-1 italic',
    li: 'text-body-1',
    pre: 'text-body-1 font-mono whitespace-pre-wrap',
    figure: 'text-body-1',
    figcaption: 'text-body-2 italic',
    table: 'text-body-1',
    ul: 'text-body-1',
    ol: 'text-body-1',
    section: 'text-body-1',
    article: 'text-body-1',
    img: 'block',
  }
  const textareaTypographyClass = tagTypographyClass[tag] ?? 'text-body-1'

  const bgClass =
    powerMode && isFocused
      ? 'textblock-bg-hover'
      : isHovered
        ? 'textblock-bg-hover'
        : 'textblock-bg'

  const shouldHyphenate =
    !isEditing && block.justify === 'justify' && tag !== 'img' && tag !== 'pre'

  const useSpellcheckHtml =
    spellcheckEnabled && !isEditing && !!block.spellcheckHtml && !isAppendingTarget

  const displayHtml = useSpellcheckHtml ? block.spellcheckHtml! : block.html

  const handleBlockClick = () => {
    if (powerMode) {
      onRequestFocusBlock(sectionIndex, block.id)
      return
    }
    if (!isEditing && tag !== 'img') {
      onSelectSpellWord(null)
      onRequestEditBlock(sectionIndex, block.id)
    }
  }

  const handleContentClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (powerMode) {
      if (tag === 'img') return
      const target = event.target as unknown
      if (
        target instanceof Element &&
        target.closest('button, a, input, select, textarea')
      ) {
        return
      }
      event.stopPropagation()
      onRequestFocusBlock(sectionIndex, block.id)
      onRequestEditBlock(sectionIndex, block.id)
      return
    }

    if (!useSpellcheckHtml) return

    const target = event.target
    if (!(target instanceof Element)) return

    const spellSpan = target.closest('.spell-unknown, .spell-dictionary')
    if (spellSpan) {
      event.stopPropagation()
      const word = spellSpan.getAttribute('data-word')
      if (word) {
        document.querySelectorAll('.spell-selected').forEach((el) => {
          el.classList.remove('spell-selected')
        })
        spellSpan.classList.add('spell-selected')
        onSelectSpellWord(word)
      }
    }
  }

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleBlockClick}
      data-component="TextBlock"
      data-textblock-id={block.id}
      style={
        powerMode && isFocused ? { backgroundColor: 'var(--fg-primary)' } : undefined
      }
      className={`relative rounded-md border border-transparent px-[1.5em] pt-0 pb-[.25em] transition ${bgClass} ${
        powerMode && isFocused ? 'textblock-focused' : ''
      } ${block.queuedForDelete ? 'opacity-20' : ''}`}
    >
      {showDebug && (
        <div className="mb-2 rounded-md border border-dashed border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-500">
          <div>id: {block.id}</div>
          <div>tag: {block.tag}</div>
          <div>order: {block.order}</div>
          <div>href: {block.href}</div>
          <div>selector: {block.selector}</div>
          <div>queuedForDelete: {String(!!block.queuedForDelete)}</div>
          <div>queuedWithAppend: {String(!!block.queuedWithAppend)}</div>
          <div>appendedFromId: {block.appendedFromId ?? 'none'}</div>
          <div>appendedPosition: {block.appendedPosition ?? 'none'}</div>
          <div>appendedHtml length: {block.appendedHtml?.length ?? 0}</div>
        </div>
      )}

      {!isEditing && (
        <div
          className={
            isHovered || (powerMode && isFocused)
              ? ''
              : 'pointer-events-none opacity-0'
          }
          aria-hidden={!(isHovered || (powerMode && isFocused))}
        >
          <TextBlockToolbar
            tag={tag}
            justify={block.justify}
            selectedSpellWord={selectedSpellWord}
            onChangeTag={(nextTag) => onChangeTag(sectionIndex, block, nextTag)}
            onChangeJustify={(nextJustify) => onChangeJustify(sectionIndex, block, nextJustify)}
            onSelectAction={(action) => onSelectAction(sectionIndex, block, action)}
            onAddToDictionary={onAddToDictionary}
          />
        </div>
      )}

      {isEditing ? (
        <TextBlockRichEditor
          initialHtml={block.html}
          typographyClass={textareaTypographyClass}
          spellcheckEnabled={spellcheckEnabled}
          fetchSpellcheckHtml={fetchSpellcheckHtml}
          onCommit={(nextHtml) => {
            shouldAutoCommitRef.current = false
            onRequestCommitEdit(nextHtml)
          }}
          onCancel={() => {
            shouldAutoCommitRef.current = false
            onRequestCancelEdit()
          }}
        />
      ) : tag === 'img' ? (
        <div
          className={`text-slate-900 font-contentTypeface ${tagTypographyClass[tag] ?? 'text-body-1'}`}
        >
          <span dangerouslySetInnerHTML={{ __html: block.html }} />
        </div>
      ) : (
        <Tag
          className={`m-0 text-slate-900 font-contentTypeface ${textareaTypographyClass} ${
            shouldHyphenate ? 'easypub-hyphenate' : ''
          }`}
          style={{
            textAlign: (block.justify as CSSProperties['textAlign']) || undefined,
            margin: 0,
          }}
          lang={shouldHyphenate ? viewerLanguage : undefined}
          onClick={handleContentClick}
        >
          {isAppendingTarget ? (
          block.appendedPosition === 'append' ? (
            <>
              <span
                dangerouslySetInnerHTML={{
                  __html: block.originalHtml ?? block.html,
                }}
              />
              <span> </span>
              <button
                type="button"
                onClick={() => onUndoAppend(block.id)}
                className="mx-2 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-black"
              >
                Undo
              </button>
              <span> </span>
              <span
                className="text-emerald-600 font-medium"
                style={{ color: '#059669' }}
                dangerouslySetInnerHTML={{ __html: block.appendedHtml ?? '' }}
              />
            </>
          ) : (
            <>
              <span
                className="text-emerald-600 font-medium"
                style={{ color: '#059669' }}
                dangerouslySetInnerHTML={{ __html: block.appendedHtml ?? '' }}
              />
              <span> </span>
              <button
                type="button"
                onClick={() => onUndoAppend(block.id)}
                className="mx-2 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-black"
              >
                Undo
              </button>
              <span> </span>
              <span
                dangerouslySetInnerHTML={{
                  __html: block.originalHtml ?? block.html,
                }}
              />
            </>
          )
          ) : (
            <span dangerouslySetInnerHTML={{ __html: displayHtml }} />
          )}
        </Tag>
      )}

      {block.queuedForDelete && (
        <div className="mt-2">
          <Button variant="secondary" size="sm" onClick={() => onRestoreBlock(sectionIndex, block)}>
            Restore
          </Button>
        </div>
      )}

      {isCodeOpen && (
        <div className="absolute left-full top-0 ml-4 w-72 rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
            <span>{tag.toUpperCase()}</span>
            <button
              type="button"
              onClick={() => onToggleCode(block.id)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Close
            </button>
          </div>
          <div className="max-h-64 overflow-auto px-3 py-2 text-xs text-slate-700">
            <pre className="whitespace-pre-wrap break-words font-mono">
              {tag === 'img' ? block.html : `<${tag}>${block.html}</${tag}>`}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
})
