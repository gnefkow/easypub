import type { LoadedSection, TextBlock } from '../types/reader'

function blockHtmlContainsEndnoteUid(block: TextBlock, uid: string): boolean {
  const needle = `placeholder-${uid}`
  const fields = [block.html, block.originalHtml, block.appendedHtml, block.spellcheckHtml]
  return fields.some((html) => html?.includes(needle))
}

/** First loaded section (spine order in `sections` array) that references this endnote uid. */
export function findSectionIndexForEndnoteUid(
  sections: LoadedSection[],
  uid: string,
): number | null {
  for (const section of sections) {
    if (section.blocks.some((block) => blockHtmlContainsEndnoteUid(block, uid))) {
      return section.index
    }
  }
  return null
}