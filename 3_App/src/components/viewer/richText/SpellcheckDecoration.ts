import { Extension } from '@tiptap/core'
import type { Editor } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { ProseMirrorRange } from './spellcheckRanges'

export const spellcheckDecorationPluginKey = new PluginKey('spellcheckDecoration')

function buildDecorationSet(
  doc: Parameters<typeof DecorationSet.create>[0],
  ranges: ProseMirrorRange[],
): DecorationSet {
  if (ranges.length === 0) {
    return DecorationSet.empty
  }

  const decorations = ranges.map(({ from, to }) =>
    Decoration.inline(from, to, { class: 'spell-unknown' }),
  )
  return DecorationSet.create(doc, decorations)
}

export const SpellcheckDecoration = Extension.create({
  name: 'spellcheckDecoration',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: spellcheckDecorationPluginKey,
        state: {
          init() {
            return DecorationSet.empty
          },
          apply(tr, oldSet) {
            const meta = tr.getMeta(spellcheckDecorationPluginKey)
            if (meta !== undefined) {
              return buildDecorationSet(tr.doc, meta as ProseMirrorRange[])
            }
            if (tr.docChanged) {
              return DecorationSet.empty
            }
            return oldSet
          },
        },
        props: {
          decorations(state) {
            return spellcheckDecorationPluginKey.getState(state)
          },
        },
      }),
    ]
  },
})

export function setSpellcheckDecorations(
  editor: Editor,
  ranges: ProseMirrorRange[],
): void {
  const { tr } = editor.state
  tr.setMeta(spellcheckDecorationPluginKey, ranges)
  editor.view.dispatch(tr)
}
