import express from 'express'
import {
  spellcheckBlockHtml,
  spellcheckBlocks,
  readDictionary,
  writeDictionary,
} from '../lib/spellcheck.js'
import { ensureSafeFilename } from '../lib/paths.js'

const router = express.Router()

router.get('/:filename/dictionary', async (req, res) => {
  const requested = decodeURIComponent(req.params.filename)
  try {
    const words = await readDictionary(requested)
    res.json({ words })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:filename/dictionary', async (req, res) => {
  const requested = decodeURIComponent(req.params.filename)
  const { words } = req.body
  if (!Array.isArray(words)) {
    res.status(400).json({ error: 'words must be an array' })
    return
  }
  try {
    await writeDictionary(requested, words)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/:filename/spellcheck-section', async (req, res) => {
  const requested = decodeURIComponent(req.params.filename)
  const { blocks, sectionIndex, href } = req.body
  const blockCount = Array.isArray(blocks) ? blocks.length : 0
  console.log(
    `[section] load: "${requested}" index=${sectionIndex ?? '?'} href="${href ?? '?'}" — ${blockCount} block(s)`
  )
  if (!Array.isArray(blocks)) {
    console.log('[section] load failed — blocks must be an array')
    res.status(400).json({ error: 'blocks must be an array' })
    return
  }
  try {
    const customDictionary = await readDictionary(requested)
    const checked = spellcheckBlocks(blocks, customDictionary)

    const misspelled = new Set()
    for (const block of checked) {
      if (!block.spellcheckHtml) continue
      const matches = block.spellcheckHtml.matchAll(/class="spell-unknown" data-word="([^"]+)"/g)
      for (const m of matches) misspelled.add(m[1])
    }
    const unknownWords = [...misspelled]
    if (unknownWords.length === 0) {
      console.log(`[spellcheck] Section complete — 0 unknown words (no misspellings)`)
    } else {
      console.log(
        `[spellcheck] Section complete — ${unknownWords.length} unknown word(s):`,
        unknownWords.slice(0, 30).join(', ')
      )
    }

    res.json({ blocks: checked, unknownWordCount: unknownWords.length })
  } catch (err) {
    console.error('[section] load error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

router.post('/:filename/spellcheck-block', async (req, res) => {
  const requested = decodeURIComponent(req.params.filename)
  const { html } = req.body
  if (typeof html !== 'string') {
    res.status(400).json({ error: 'html must be a string' })
    return
  }
  try {
    const customDictionary = await readDictionary(requested)
    const spellcheckHtml = spellcheckBlockHtml(html, customDictionary)
    const unknownMatches = [...spellcheckHtml.matchAll(/class="spell-unknown" data-word="([^"]+)"/g)]
    if (unknownMatches.length === 0) {
      console.log(`[spellcheck] Block complete — 0 unknown words (no misspellings)`)
    } else {
      const words = [...new Set(unknownMatches.map((m) => m[1]))]
      console.log(
        `[spellcheck] Block complete — ${words.length} unknown word(s):`,
        words.join(', ')
      )
    }
    res.json({ spellcheckHtml })
  } catch (err) {
    console.error('[spellcheck] Block error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
