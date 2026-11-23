import express from 'express'
import path from 'path'
import { promises as fs } from 'fs'
import AdmZip from 'adm-zip'
import * as cheerio from 'cheerio'
import { randomUUID } from 'crypto'
import { workingDir, ensureSafeFilename } from '../lib/paths.js'
import { createBackup, appendHistory } from '../lib/history.js'
import { getContainerOpfPath } from '../lib/zip.js'
import {
  parseOpf,
  writeOpf,
  getManifestItems,
  setManifestItems,
  getSpineItems,
  setSpineItems,
  resolveHref,
  normalizeCoverMetadata,
} from '../lib/opf.js'
import { writeEndnotes } from '../lib/endnotes.js'
import { writeToc } from '../lib/toc.js'
import {
  ensureBlockIdsInZip,
  stripBlockIdsInZip,
  mergeHtmlBodies,
  changeElementTag,
  changeElementTagById,
  changeElementTagByIndex,
  changeElementJustifyById,
  changeElementJustifyByIndex,
  findBlockById,
  findBlockByIndex,
  findBlockIndexById,
  updateElementTextById,
  updateElementTextByIndex,
  updateElementHtmlById,
  updateElementHtmlByIndex,
  updateHtmlTitle,
  splitHtmlByIndex,
} from '../lib/html-blocks.js'
import {
  ensureEasypubStylesheet,
  linkStylesheetInContentDocs,
  ensureLangAttributes,
  normalizeTextAlignLeftInZip,
} from '../lib/styles.js'
import { progressState, yieldToEventLoop } from '../lib/progress.js'

const router = express.Router()

router.post('/:filename/queue', async (req, res) => {
  const requested = ensureSafeFilename(req.params.filename)
  const actions = req.body?.actions || []
  const endnotes = req.body?.endnotes || []
  if ((!Array.isArray(actions) || !actions.length) && (!Array.isArray(endnotes) || !endnotes.length)) {
    res.status(400).json({ error: 'No actions or endnotes provided.' })
    return
  }

  const filePath = path.join(workingDir, requested)
  try {
    await fs.access(filePath)
  } catch {
    res.status(404).json({ error: 'File not found.' })
    return
  }

  progressState.set(requested, {
    phase: 'loading-queue',
    total: actions.length,
    completed: 0,
  })

  res.status(202).json({ status: 'accepted', total: actions.length })

  const processQueue = async () => {
    try {
      const zip = new AdmZip(filePath)
      const opfPath = getContainerOpfPath(zip)
      const { data: opfData } = parseOpf(zip, opfPath)

      await createBackup(requested)

      let manifestItems = getManifestItems(opfData)
      let spineItems = getSpineItems(opfData)
      const hrefById = new Map(
        manifestItems.map((item) => [item['@_id'], item['@_href']])
      )
      const spineOrderByHref = new Map()
      spineItems.forEach((item, index) => {
        const href = hrefById.get(item['@_idref'])
        if (href) {
          spineOrderByHref.set(href, index)
          spineOrderByHref.set(decodeURI(href), index)
        }
      })

      ensureBlockIdsInZip(zip, opfPath, opfData)

  const appendSources = new Set(
    actions
      .filter((action) => action.action === 'append-block')
      .map((action) =>
        `${action.fromHref || ''}::${action.fromBlockId || ''}::${String(
          typeof action.fromIndex === 'number' ? action.fromIndex : ''
        )}::${action.fromSelector || ''}`
      )
  )

  const logQueueOrdering = () => {
    const counts = actions.reduce((acc, action) => {
      acc[action.action] = (acc[action.action] || 0) + 1
      return acc
    }, {})
    console.log('[QueueOrder] start', {
      file: requested,
      total: actions.length,
      counts,
    })
  }

  const logQueueResult = (ordered, merges) => {
    const hasMerge = merges.length > 0
    console.log('[QueueOrder] ordered', {
      total: ordered.length,
      merges: merges.length,
      nonMerges: ordered.length - merges.length,
      mergeOrder: hasMerge
        ? merges.map((action) => `${action.fromHref || '?'} -> ${action.toHref || '?'}`)
        : [],
      orderedActions: ordered.map((action) => ({
        action: action.action,
        fromHref: action.fromHref,
        toHref: action.toHref,
        blockId: action.blockId,
        fromBlockId: action.fromBlockId,
        toBlockId: action.toBlockId,
        splitBlockId: action.splitBlockId,
        blockIndex: action.blockIndex,
        fromIndex: action.fromIndex,
        toIndex: action.toIndex,
        splitIndex: action.splitIndex,
      })),
    })
  }

  logQueueOrdering()

  const mergeActions = actions.filter((action) => action.action === 'merge')
  const otherActions = actions.filter((action) => action.action !== 'merge')
  const sortedMerges = mergeActions
    .map((action, order) => ({ action, order }))
    .sort((a, b) => {
      const aHref = a.action.fromHref || ''
      const bHref = b.action.fromHref || ''
      const aIndex = spineOrderByHref.has(aHref)
        ? spineOrderByHref.get(aHref)
        : Number.NEGATIVE_INFINITY
      const bIndex = spineOrderByHref.has(bHref)
        ? spineOrderByHref.get(bHref)
        : Number.NEGATIVE_INFINITY
      if (aIndex === bIndex) {
        return a.order - b.order
      }
      return bIndex - aIndex
    })
    .map((entry) => entry.action)
  const orderedActions = [...otherActions, ...sortedMerges]
  logQueueResult(orderedActions, sortedMerges)

  for (const [index, action] of orderedActions.entries()) {
    if (action.action === 'merge') {
      const { fromHref, toHref } = action
      if (!fromHref || !toHref) {
        continue
      }

      const toItem = manifestItems.find((item) => {
        const href = item['@_href']
        return href === toHref || decodeURI(href) === decodeURI(toHref)
      })
      if (!toItem) {
        continue
      }
      const toId = toItem['@_id']

      const fromPath = resolveHref(opfPath, fromHref)
      const toPath = resolveHref(opfPath, toHref)

      const fromEntry = zip.getEntry(fromPath)
      const toEntry = zip.getEntry(toPath)
      if (!fromEntry || !toEntry) {
        continue
      }

      const fromHtml = zip.readAsText(fromEntry)
      const toHtml = zip.readAsText(toEntry)
      const mergedHtml = mergeHtmlBodies(fromHtml, toHtml)
      zip.updateFile(fromPath, Buffer.from(mergedHtml, 'utf-8'))
      zip.deleteFile(toPath)

      const updatedManifest = manifestItems.filter((item) => {
        const href = item['@_href']
        return !(href === toHref || decodeURI(href) === decodeURI(toHref))
      })
      setManifestItems(opfData, updatedManifest)
      manifestItems = updatedManifest

      const updatedSpine = spineItems.filter((item) => item['@_idref'] !== toId)
      setSpineItems(opfData, updatedSpine)
      spineItems = updatedSpine
    }

    if (action.action === 'change-tag') {
      const { fromHref, selector, toTag, blockIndex, blockId } = action
      if (!fromHref || !toTag) {
        continue
      }
      const targetPath = resolveHref(opfPath, fromHref)
      const targetEntry = zip.getEntry(targetPath)
      if (!targetEntry) {
        continue
      }
      const html = zip.readAsText(targetEntry)
      let updated = html
      if (blockId) {
        updated = changeElementTagById(html, blockId, toTag)
      } else if (typeof blockIndex === 'number') {
        updated = changeElementTagByIndex(html, blockIndex, toTag)
      } else if (selector) {
        updated = changeElementTag(html, selector, toTag)
      }
      zip.updateFile(targetPath, Buffer.from(updated, 'utf-8'))
    }

    if (action.action === 'change-justify') {
      const { fromHref, toJustify, blockIndex, blockId } = action
      if (!fromHref || !toJustify) {
        continue
      }
      const targetPath = resolveHref(opfPath, fromHref)
      const targetEntry = zip.getEntry(targetPath)
      if (!targetEntry) {
        continue
      }
      const html = zip.readAsText(targetEntry)
      let updated = html
      if (blockId) {
        updated = changeElementJustifyById(html, blockId, toJustify)
      } else if (typeof blockIndex === 'number') {
        updated = changeElementJustifyByIndex(html, blockIndex, toJustify)
      }
      zip.updateFile(targetPath, Buffer.from(updated, 'utf-8'))
    }

    if (action.action === 'add-block') {
      const {
        fromHref,
        afterBlockId,
        afterSelector,
        afterIndex,
        insertedText,
        insertPosition,
      } = action
      if (!fromHref) {
        continue
      }
      const targetPath = resolveHref(opfPath, fromHref)
      const targetEntry = zip.getEntry(targetPath)
      if (!targetEntry) {
        continue
      }
      const html = zip.readAsText(targetEntry)
      const $ = cheerio.load(html, { xmlMode: true })
      let target = null
      if (afterBlockId) {
        target = findBlockById($, afterBlockId)
      }
      if ((!target || !target.length) && afterSelector) {
        target = $(afterSelector).first()
      }
      if ((!target || !target.length) && typeof afterIndex === 'number') {
        target = findBlockByIndex($, afterIndex)
      }
      if (!target || !target.length) {
        continue
      }

      const targetTag = (target.get(0)?.name || '').toLowerCase()
      const parentTag = (target.parent()?.get(0)?.name || '').toLowerCase()
      const nextTag =
        targetTag === 'li' || parentTag === 'ul' || parentTag === 'ol' ? 'li' : 'p'

      const nextText =
        typeof insertedText === 'string' && insertedText.length
          ? insertedText
          : 'New Text Block'
      const nextElement = $(`<${nextTag}></${nextTag}>`)
      nextElement.attr('data-easypub-id', randomUUID())
      nextElement.text(nextText)
      const position = insertPosition === 'before' ? 'before' : 'after'
      if (position === 'before') {
        target.before(nextElement)
      } else {
        target.after(nextElement)
      }

      zip.updateFile(targetPath, Buffer.from($.xml(), 'utf-8'))
    }

    if (action.action === 'add-space-break') {
      const {
        fromHref,
        afterBlockId,
        afterSelector,
        afterIndex,
        insertPosition,
      } = action
      if (!fromHref) {
        continue
      }
      const targetPath = resolveHref(opfPath, fromHref)
      const targetEntry = zip.getEntry(targetPath)
      if (!targetEntry) {
        continue
      }
      const html = zip.readAsText(targetEntry)
      const $ = cheerio.load(html, { xmlMode: true })
      let target = null
      if (afterBlockId) {
        target = findBlockById($, afterBlockId)
      }
      if ((!target || !target.length) && afterSelector) {
        target = $(afterSelector).first()
      }
      if ((!target || !target.length) && typeof afterIndex === 'number') {
        target = findBlockByIndex($, afterIndex)
      }
      if (!target || !target.length) {
        continue
      }

      const hrElement = $('<hr/>')
      hrElement.attr('data-easypub-id', randomUUID())
      const position = insertPosition === 'before' ? 'before' : 'after'
      if (position === 'before') {
        target.before(hrElement)
      } else {
        target.after(hrElement)
      }

      zip.updateFile(targetPath, Buffer.from($.xml(), 'utf-8'))
    }

    if (action.action === 'delete-block') {
      const { fromHref, selector, blockIndex, blockId } = action
      if (!fromHref) {
        continue
      }
      const deleteKey = `${fromHref}::${String(
        typeof blockIndex === 'number' ? blockIndex : ''
      )}::${selector || ''}::${blockId || ''}`
      if (appendSources.has(deleteKey)) {
        continue
      }
      const targetPath = resolveHref(opfPath, fromHref)
      const targetEntry = zip.getEntry(targetPath)
      if (!targetEntry) {
        continue
      }
      const html = zip.readAsText(targetEntry)
      const $ = cheerio.load(html, { xmlMode: true })
      let element = null
      if (blockId) {
        element = findBlockById($, blockId)
      } else if (typeof blockIndex === 'number') {
        element = findBlockByIndex($, blockIndex)
      } else if (selector) {
        element = $(selector).first()
      }
      if (!element || !element.length) {
        continue
      }
      element.remove()
      zip.updateFile(targetPath, Buffer.from($.xml(), 'utf-8'))
    }

    if (action.action === 'append-block') {
      const {
        fromHref,
        toHref,
        fromSelector,
        toSelector,
        fromIndex,
        toIndex,
        direction,
        fromBlockId,
        toBlockId,
      } = action
      if (!fromHref || !toHref) {
        if (
          !fromHref ||
          !toHref ||
          typeof fromIndex !== 'number' ||
          typeof toIndex !== 'number'
        ) {
          continue
        }
      }

      const fromPath = resolveHref(opfPath, fromHref)
      const toPath = resolveHref(opfPath, toHref)
      const fromEntry = zip.getEntry(fromPath)
      const toEntry = zip.getEntry(toPath)
      if (!fromEntry || !toEntry) {
        continue
      }

      const fromHtml = zip.readAsText(fromEntry)
      const toHtml = zip.readAsText(toEntry)
      const fromDoc = cheerio.load(fromHtml, { xmlMode: true })
      const toDoc = fromPath === toPath ? fromDoc : cheerio.load(toHtml, { xmlMode: true })
      let source = null
      let target = null
      if (fromBlockId) {
        source = findBlockById(fromDoc, fromBlockId)
      } else if (typeof fromIndex === 'number') {
        source = findBlockByIndex(fromDoc, fromIndex)
      } else if (fromSelector) {
        source = fromDoc(fromSelector).first()
      }
      if (toBlockId) {
        target = findBlockById(toDoc, toBlockId)
      } else if (typeof toIndex === 'number') {
        target = findBlockByIndex(toDoc, toIndex)
      } else if (toSelector) {
        target = toDoc(toSelector).first()
      }
      if (!source || !target || !source.length || !target.length) {
        continue
      }

      const sourceHtml = source.html() || ''
      if (direction === 'previous') {
        target.append(` ${sourceHtml}`)
      } else {
        target.prepend(`${sourceHtml} `)
      }
      source.remove()

      zip.updateFile(fromPath, Buffer.from(fromDoc.xml(), 'utf-8'))
      if (fromPath !== toPath) {
        zip.updateFile(toPath, Buffer.from(toDoc.xml(), 'utf-8'))
      }
    }

    if (action.action === 'edit-text') {
      const { fromHref, blockIndex, text, blockId } = action
      if (!fromHref || typeof text !== 'string') {
        continue
      }
      const targetPath = resolveHref(opfPath, fromHref)
      const targetEntry = zip.getEntry(targetPath)
      if (!targetEntry) {
        continue
      }
      const html = zip.readAsText(targetEntry)
      let updated = html
      if (blockId) {
        updated = updateElementTextById(html, blockId, text)
      } else if (typeof blockIndex === 'number') {
        updated = updateElementTextByIndex(html, blockIndex, text)
      }
      zip.updateFile(targetPath, Buffer.from(updated, 'utf-8'))
    }

    if (action.action === 'edit-html') {
      const { fromHref, blockIndex, html, blockId } = action
      if (!fromHref || typeof html !== 'string') {
        continue
      }
      const targetPath = resolveHref(opfPath, fromHref)
      const targetEntry = zip.getEntry(targetPath)
      if (!targetEntry) {
        continue
      }
      const docHtml = zip.readAsText(targetEntry)
      let updated = docHtml
      if (blockId) {
        updated = updateElementHtmlById(docHtml, blockId, html)
      } else if (typeof blockIndex === 'number') {
        updated = updateElementHtmlByIndex(docHtml, blockIndex, html)
      }
      zip.updateFile(targetPath, Buffer.from(updated, 'utf-8'))
    }

    if (action.action === 'rename-section') {
      const { fromHref, title } = action
      if (!fromHref || !title) {
        continue
      }
      const targetPath = resolveHref(opfPath, fromHref)
      const targetEntry = zip.getEntry(targetPath)
      if (!targetEntry) {
        continue
      }
      const html = zip.readAsText(targetEntry)
      const updated = updateHtmlTitle(html, title)
      zip.updateFile(targetPath, Buffer.from(updated, 'utf-8'))
    }

    if (action.action === 'split-section') {
      const { fromHref, splitIndex, newHref, title, splitBlockId } = action
      if (!fromHref || !newHref || !title) {
        continue
      }
      const fromPath = resolveHref(opfPath, fromHref)
      const newPath = resolveHref(opfPath, newHref)
      const fromEntry = zip.getEntry(fromPath)
      if (!fromEntry) {
        continue
      }
      const html = zip.readAsText(fromEntry)
      let effectiveIndex = splitIndex
      if (splitBlockId) {
        const $ = cheerio.load(html, { xmlMode: true })
        const foundIndex = findBlockIndexById($, splitBlockId)
        if (foundIndex >= 0) {
          effectiveIndex = foundIndex
        }
      }
      if (typeof effectiveIndex !== 'number') {
        continue
      }
      const result = splitHtmlByIndex(html, effectiveIndex, title)
      if (!result) {
        continue
      }
      zip.updateFile(fromPath, Buffer.from(result.before, 'utf-8'))
      zip.addFile(newPath, Buffer.from(result.after, 'utf-8'))

      const manifestItems = getManifestItems(opfData)
      const sourceItem = manifestItems.find((item) => {
        const href = item['@_href']
        return href === fromHref || decodeURI(href) === decodeURI(fromHref)
      })
      const mediaType = sourceItem?.['@_media-type'] || 'application/xhtml+xml'
      const newId = `item-${Date.now()}`
      manifestItems.push({
        '@_id': newId,
        '@_href': newHref,
        '@_media-type': mediaType,
      })
      setManifestItems(opfData, manifestItems)

      const spineItems = getSpineItems(opfData)
      const sourceIndex = spineItems.findIndex(
        (item) => item['@_idref'] === sourceItem?.['@_id']
      )
      if (sourceIndex >= 0) {
        spineItems.splice(sourceIndex + 1, 0, { '@_idref': newId })
      } else {
        spineItems.push({ '@_idref': newId })
      }
      setSpineItems(opfData, spineItems)
    }

    progressState.set(requested, {
      phase: 'applying',
      total: actions.length,
      completed: index + 1,
    })
    await yieldToEventLoop()
  }

  const cssHref = ensureEasypubStylesheet(zip, opfPath, opfData)
  linkStylesheetInContentDocs(zip, opfPath, opfData, cssHref)

  const hasFullJustify = actions.some(
    (a) => a.action === 'change-justify' && a.toJustify === 'justify'
  )
  if (hasFullJustify) {
    ensureLangAttributes(zip, opfPath, opfData)
  }

  if (endnotes.length) {
    writeEndnotes(zip, opfPath, opfData, endnotes)
  }

  writeToc(zip, opfPath, opfData)

  progressState.set(requested, {
    phase: 'writing-epub',
    total: actions.length,
    completed: actions.length,
  })

  await yieldToEventLoop()
  normalizeTextAlignLeftInZip(zip, opfPath, opfData)
  stripBlockIdsInZip(zip, opfPath, opfData)
  normalizeCoverMetadata(opfData)
  writeOpf(zip, opfPath, opfData)
  zip.writeZip(filePath)

  progressState.set(requested, {
    phase: 'reloading',
    total: actions.length,
    completed: actions.length,
  })

  const history = await appendHistory(requested, {
    id: randomUUID(),
    action: 'queue-execute',
    timestamp: new Date().toISOString(),
    details: { actions },
  })

  progressState.set(requested, {
    phase: 'complete',
    total: actions.length,
    completed: actions.length,
    history,
  })
    } catch (err) {
      console.error('[Queue] processing error:', err)
      progressState.set(requested, {
        phase: 'error',
        total: actions.length,
        completed: 0,
        error: err?.message || 'Unknown error during queue processing.',
      })
    }
  }

  processQueue()
})

router.get('/:filename/progress', async (req, res) => {
  const requested = ensureSafeFilename(req.params.filename)
  const state = progressState.get(requested)
  res.json(
    state || {
      phase: 'idle',
      total: 0,
      completed: 0,
    }
  )
})

export default router
