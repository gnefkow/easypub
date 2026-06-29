import { useCallback, useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { setSpellcheckDecorations } from './SpellcheckDecoration'
import {
  extractUnknownTextRanges,
  textRangesToProseMirrorPositions,
} from './spellcheckRanges'

const DEBOUNCE_MS = 400

type UseEditModeSpellcheckOptions = {
  editor: Editor | null
  spellcheckEnabled: boolean
  fetchSpellcheckHtml: (html: string) => Promise<string | null>
}

export default function useEditModeSpellcheck({
  editor,
  spellcheckEnabled,
  fetchSpellcheckHtml,
}: UseEditModeSpellcheckOptions): void {
  const generationRef = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const applyDecorations = useCallback(
    async (html: string, generation: number) => {
      if (!editor || !spellcheckEnabled) return

      try {
        const spellcheckHtml = await fetchSpellcheckHtml(html)
        if (generation !== generationRef.current) return

        if (!spellcheckHtml) {
          setSpellcheckDecorations(editor, [])
          return
        }

        const textRanges = extractUnknownTextRanges(spellcheckHtml)
        const pmRanges = textRangesToProseMirrorPositions(
          editor.state.doc,
          textRanges,
        )
        setSpellcheckDecorations(editor, pmRanges)
      } catch {
        if (generation === generationRef.current) {
          setSpellcheckDecorations(editor, [])
        }
      }
    },
    [editor, spellcheckEnabled, fetchSpellcheckHtml],
  )

  useEffect(() => {
    if (!editor) return

    if (!spellcheckEnabled) {
      setSpellcheckDecorations(editor, [])
      return
    }

    generationRef.current += 1
    const generation = generationRef.current
    void applyDecorations(editor.getHTML(), generation)
  }, [editor, spellcheckEnabled, applyDecorations])

  useEffect(() => {
    if (!editor || !spellcheckEnabled) return

    const onUpdate = () => {
      setSpellcheckDecorations(editor, [])
      generationRef.current += 1
      const generation = generationRef.current

      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      debounceRef.current = setTimeout(() => {
        void applyDecorations(editor.getHTML(), generation)
      }, DEBOUNCE_MS)
    }

    editor.on('update', onUpdate)

    return () => {
      editor.off('update', onUpdate)
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      setSpellcheckDecorations(editor, [])
    }
  }, [editor, spellcheckEnabled, applyDecorations])
}
