import express from 'express'
import multer from 'multer'
import path from 'path'
import { promises as fs } from 'fs'
import AdmZip from 'adm-zip'
import * as cheerio from 'cheerio'
import { randomUUID } from 'crypto'
import { workingDir, ensureSafeFilename } from '../lib/paths.js'
import { readHistory, createBackup, appendHistory, historyDirFor } from '../lib/history.js'
import { getContainerOpfPath } from '../lib/zip.js'
import {
  parseOpf,
  writeOpf,
  getManifestItems,
  setManifestItems,
  getSpineItems,
  setSpineItems,
  resolveHref,
  extractMetadataFromOpf,
} from '../lib/opf.js'
import { ensureBlockIdsInZip, mergeHtmlBodies } from '../lib/html-blocks.js'

const router = express.Router()

const storage = multer.diskStorage({
  destination: workingDir,
  filename: async (_req, file, callback) => {
    const original = file.originalname
    const ext = path.extname(original)
    const baseName = path.basename(original, ext)
    let candidate = `${baseName}${ext}`
    let counter = 1
    while (true) {
      try {
        await fs.access(path.join(workingDir, candidate))
        candidate = `${baseName}-${counter}${ext}`
        counter += 1
      } catch {
        break
      }
    }
    callback(null, candidate)
  },
})

const upload = multer({ storage })


router.get('/', async (_req, res) => {
  const entries = await fs.readdir(workingDir, { withFileTypes: true })
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.epub'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
  res.json({ files })
})

router.get('/index', async (_req, res) => {
  const entries = await fs.readdir(workingDir, { withFileTypes: true })
  const epubEntries = entries.filter(
    (entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.epub')
  )

  const books = await Promise.all(
    epubEntries.map(async (entry) => {
      const filePath = path.join(workingDir, entry.name)
      const fallbackTitle = entry.name.replace(/\.epub$/i, '')
      let title = fallbackTitle
      let author = ''
      let lastUpdated = new Date(0).toISOString()

      try {
        const stat = await fs.stat(filePath)
        lastUpdated = stat.mtime.toISOString()
      } catch {
        return { filename: entry.name, title: fallbackTitle, author: '', lastUpdated }
      }

      try {
        const zip = new AdmZip(filePath)
        const opfPath = getContainerOpfPath(zip)
        const { data: opfData } = parseOpf(zip, opfPath)
        const { title: t, author: a } = extractMetadataFromOpf(opfData)
        if (t) title = t
        if (a) author = a
      } catch {
        // use fallback title and empty author
      }

      return { filename: entry.name, title, author, lastUpdated }
    })
  )

  books.sort(
    (a, b) =>
      new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
  )

  res.json({ books })
})

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded.' })
    return
  }
  res.json({ filename: req.file.filename })
})

router.get('/:filename', async (req, res) => {
  const requested = ensureSafeFilename(req.params.filename)
  const filePath = path.join(workingDir, requested)
  try {
    await fs.access(filePath)
    res.sendFile(filePath)
  } catch {
    res.status(404).json({ error: 'File not found.' })
  }
})

router.post('/:filename/ensure-block-ids', async (req, res) => {
  const requested = ensureSafeFilename(req.params.filename)
  const filePath = path.join(workingDir, requested)
  try {
    await fs.access(filePath)
  } catch {
    res.status(404).json({ error: 'File not found.' })
    return
  }

  try {
    const zip = new AdmZip(filePath)
    const opfPath = getContainerOpfPath(zip)
    const { data: opfData } = parseOpf(zip, opfPath)
    const changed = ensureBlockIdsInZip(zip, opfPath, opfData)
    if (changed) {
      zip.writeZip(filePath)
    }
    res.json({ ok: true, changed })
  } catch (err) {
    console.error('[ensure-block-ids] error:', err)
    res.status(500).json({
      error: err?.message || 'Failed to ensure block ids.',
    })
  }
})

router.get('/:filename/history', async (req, res) => {
  const requested = ensureSafeFilename(req.params.filename)
  const history = await readHistory(requested)
  res.json({ history })
})

router.get('/:filename/endnotes', async (req, res) => {
  const requested = ensureSafeFilename(req.params.filename)
  const filePath = path.join(workingDir, requested)
  try {
    await fs.access(filePath)
  } catch {
    res.status(404).json({ error: 'File not found.' })
    return
  }

  try {
    const zip = new AdmZip(filePath)
    const opfPath = getContainerOpfPath(zip)
    const { data: opfData } = parseOpf(zip, opfPath)
    const manifestItems = getManifestItems(opfData)

    const endnotesItem = manifestItems.find(
      (item) =>
        item['@_id'] === 'endnotes.xhtml' ||
        (item['@_href'] && item['@_href'].endsWith('endnotes.xhtml'))
    )
    if (!endnotesItem) {
      res.json({ endnotes: [], noterefMap: {} })
      return
    }

    const endnotesHref = endnotesItem['@_href']
    const endnotesFullPath = resolveHref(opfPath, endnotesHref)
    const entry = zip.getEntry(endnotesFullPath)
    if (!entry) {
      res.json({ endnotes: [], noterefMap: {} })
      return
    }

    const xhtml = entry.getData().toString('utf-8')
    const $ = cheerio.load(xhtml, { xmlMode: true })
    const endnotes = []
    const noterefMap = {}

    $('li[epub\\:type="endnote"], li[id^="note-"]').each((_i, el) => {
      const $el = $(el)
      const noteId = $el.attr('id') || ''
      $el.find('a[epub\\:type="backlink"]').remove()
      const innerHtml = $el.html()?.trim() || ''
      // Strip wrapping <p> if it's the only element
      const text = innerHtml.replace(/^\s*<p>([\s\S]*)<\/p>\s*$/, '$1').trim()
      if (text) {
        const uid = randomUUID().slice(0, 4)
        endnotes.push({ uid, text })
        if (noteId) {
          noterefMap[noteId] = uid
        }
      }
    })

    res.json({ endnotes, noterefMap })
  } catch (err) {
    console.error('[Endnotes] parse error:', err)
    res.json({ endnotes: [], noterefMap: {} })
  }
})

router.post('/:filename/merge', async (req, res) => {
  const requested = ensureSafeFilename(req.params.filename)
  const { fromHref, toHref } = req.body || {}
  if (!fromHref || !toHref) {
    res.status(400).json({ error: 'fromHref and toHref are required.' })
    return
  }

  const filePath = path.join(workingDir, requested)
  await fs.access(filePath)

  const zip = new AdmZip(filePath)
  const opfPath = getContainerOpfPath(zip)
  const { data: opfData } = parseOpf(zip, opfPath)

  const manifestItems = getManifestItems(opfData)
  const toItem = manifestItems.find((item) => {
    const href = item['@_href']
    return href === toHref || decodeURI(href) === decodeURI(toHref)
  })
  if (!toItem) {
    res.status(404).json({ error: 'Target document not found in manifest.' })
    return
  }
  const toId = toItem['@_id']

  const fromPath = resolveHref(opfPath, fromHref)
  const toPath = resolveHref(opfPath, toHref)

  const fromEntry = zip.getEntry(fromPath)
  const toEntry = zip.getEntry(toPath)
  if (!fromEntry || !toEntry) {
    res.status(404).json({ error: 'Content documents not found in EPUB.' })
    return
  }

  await createBackup(requested)

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

  const spineItems = getSpineItems(opfData)
  const updatedSpine = spineItems.filter((item) => item['@_idref'] !== toId)
  setSpineItems(opfData, updatedSpine)

  writeOpf(zip, opfPath, opfData)
  zip.writeZip(filePath)

  const history = await appendHistory(requested, {
    id: randomUUID(),
    action: 'merge',
    timestamp: new Date().toISOString(),
    details: { fromHref, toHref },
  })

  res.json({ history })
})

router.post('/:filename/undo', async (req, res) => {
  const requested = ensureSafeFilename(req.params.filename)
  const filePath = path.join(workingDir, requested)
  await fs.access(filePath)

  const historyDir = await historyDirFor(requested)
  const entries = await fs.readdir(historyDir)
  const backups = entries.filter((entry) => entry.endsWith('.epub')).sort()
  const latest = backups[backups.length - 1]
  if (!latest) {
    res.status(400).json({ error: 'No undo history available.' })
    return
  }

  const backupPath = path.join(historyDir, latest)
  await fs.copyFile(backupPath, filePath)
  await fs.unlink(backupPath)

  const history = await appendHistory(requested, {
    id: randomUUID(),
    action: 'undo',
    timestamp: new Date().toISOString(),
    details: { restoredFrom: latest },
  })

  res.json({ history })
})

export default router
