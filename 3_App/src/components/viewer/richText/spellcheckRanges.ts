import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

export type TextRange = { start: number; end: number }
export type ProseMirrorRange = { from: number; to: number }

export function extractUnknownTextRanges(spellcheckHtml: string): TextRange[] {
  const doc = new DOMParser().parseFromString(
    `<div>${spellcheckHtml}</div>`,
    'text/html',
  )
  const root = doc.body.firstElementChild
  if (!root) return []

  const ranges: TextRange[] = []
  walkForUnknownRanges(root, 0, ranges)
  return ranges
}

function walkForUnknownRanges(node: Node, offset: number, ranges: TextRange[]): number {
  if (node.nodeType === Node.TEXT_NODE) {
    return offset + (node.textContent?.length ?? 0)
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return offset
  }

  const el = node as Element
  if (el.classList.contains('spell-unknown')) {
    const length = el.textContent?.length ?? 0
    if (length > 0) {
      ranges.push({ start: offset, end: offset + length })
    }
    return offset + length
  }

  for (const child of el.childNodes) {
    offset = walkForUnknownRanges(child, offset, ranges)
  }
  return offset
}

export function textOffsetToProseMirrorPos(
  doc: ProseMirrorNode,
  targetOffset: number,
): number | null {
  let textOffset = 0
  let found: number | null = null

  doc.descendants((node, pos) => {
    if (found !== null) return false
    if (!node.isText || node.text === undefined) return
    const length = node.text.length
    if (textOffset + length >= targetOffset) {
      found = pos + (targetOffset - textOffset)
      return false
    }
    textOffset += length
  })

  return found
}

export function textRangesToProseMirrorPositions(
  doc: ProseMirrorNode,
  ranges: TextRange[],
): ProseMirrorRange[] {
  const result: ProseMirrorRange[] = []

  for (const range of ranges) {
    const from = textOffsetToProseMirrorPos(doc, range.start)
    const to = textOffsetToProseMirrorPos(doc, range.end)
    if (from !== null && to !== null && from < to) {
      result.push({ from, to })
    }
  }

  return result
}
