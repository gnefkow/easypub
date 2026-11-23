import path from 'path'
import { promises as fs } from 'fs'
import * as cheerio from 'cheerio'
import nspell from 'nspell'
import dictionary from 'dictionary-en'
import { workingDir } from './paths.js'

const spellchecker = nspell(dictionary.aff, dictionary.dic)

const WORD_RE = /[\p{L}\p{M}]+/gu

export function spellcheckBlockHtml(html, customDictionary) {
  const customSet = new Set(customDictionary.map((w) => w.toLowerCase()))
  const $ = cheerio.load(html, null, false)

  function walkTextNodes(node) {
    const children = $(node).contents()
    children.each((_i, child) => {
      if (child.type === 'text') {
        const text = $(child).text()
        const parts = []
        let lastIndex = 0
        for (const match of text.matchAll(WORD_RE)) {
          const word = match[0]
          const idx = match.index
          if (idx > lastIndex) {
            parts.push(text.slice(lastIndex, idx))
          }
          if (word.length <= 1 || /^\d+$/.test(word)) {
            parts.push(word)
          } else if (customSet.has(word.toLowerCase())) {
            parts.push(
              `<span class="spell-dictionary" data-word="${word}">${word}</span>`
            )
          } else if (spellchecker.correct(word)) {
            parts.push(word)
          } else {
            parts.push(
              `<span class="spell-unknown" data-word="${word}">${word}</span>`
            )
          }
          lastIndex = idx + word.length
        }
        if (lastIndex < text.length) {
          parts.push(text.slice(lastIndex))
        }
        if (parts.length > 0) {
          $(child).replaceWith(parts.join(''))
        }
      } else if (child.type === 'tag') {
        walkTextNodes(child)
      }
    })
  }

  walkTextNodes($.root())
  return $.html()
}

export function spellcheckBlocks(blocks, customDictionary) {
  return blocks.map((block) => {
    const tag = (block.tag || '').toLowerCase()
    if (tag === 'img') return block
    return {
      ...block,
      spellcheckHtml: spellcheckBlockHtml(block.html, customDictionary),
    }
  })
}

export async function readDictionary(filename) {
  const dictPath = path.join(workingDir, `${filename}.dictionary.json`)
  try {
    const data = await fs.readFile(dictPath, 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

export async function writeDictionary(filename, words) {
  const dictPath = path.join(workingDir, `${filename}.dictionary.json`)
  await fs.writeFile(dictPath, JSON.stringify(words, null, 2), 'utf-8')
}
