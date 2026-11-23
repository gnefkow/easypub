import path from 'path'
import * as cheerio from 'cheerio'
import {
  getManifestItems,
  getSpineItems,
  setManifestItems,
  resolveHref,
} from './opf.js'

export const escapeXml = (str) =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export const collectTocEntries = (zip, opfPath, opfData) => {
  const manifestItems = getManifestItems(opfData)
  const spineItems = getSpineItems(opfData)
  const hrefById = new Map(manifestItems.map((item) => [item['@_id'], item['@_href']]))

  const entries = []
  const seenHrefs = new Set()

  for (const spineItem of spineItems) {
    const href = hrefById.get(spineItem['@_idref'])
    if (!href) continue
    if (href.endsWith('toc.xhtml') || href.endsWith('toc.ncx')) continue
    if (seenHrefs.has(href)) continue
    seenHrefs.add(href)

    const fullPath = resolveHref(opfPath, href)
    const entry = zip.getEntry(fullPath)
    if (!entry) continue

    let title = ''
    try {
      const xhtml = entry.getData().toString('utf-8')
      const $ = cheerio.load(xhtml, { xmlMode: true })
      title = $('title').text().trim()
      if (!title) {
        title = $('h1, h2, h3, h4, h5, h6').first().text().trim()
      }
    } catch {
      // fall through to filename fallback
    }
    if (!title) {
      title = path.posix.basename(href, '.xhtml')
    }

    entries.push({ href, title })
  }

  const endnotesItem = manifestItems.find(
    (item) => item['@_href'] && item['@_href'].endsWith('endnotes.xhtml')
  )
  if (endnotesItem && !seenHrefs.has(endnotesItem['@_href'])) {
    entries.push({ href: endnotesItem['@_href'], title: 'Endnotes' })
  }

  return entries
}

export const writeToc = (zip, opfPath, opfData) => {
  const entries = collectTocEntries(zip, opfPath, opfData)

  const tocXhtml = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
\t<title>Table of Contents</title>
</head>
<body epub:type="frontmatter">
\t<nav epub:type="toc">
\t\t<h1>Table of Contents</h1>
\t\t<ol>
${entries.map((e) => `\t\t\t<li><a href="${e.href}">${escapeXml(e.title)}</a></li>`).join('\n')}
\t\t</ol>
\t</nav>
</body>
</html>
`

  const opfDir = path.posix.dirname(opfPath)
  const tocXhtmlPath = path.posix.normalize(path.posix.join(opfDir, 'toc.xhtml'))
  const existingXhtml = zip.getEntry(tocXhtmlPath)
  if (existingXhtml) {
    zip.updateFile(tocXhtmlPath, Buffer.from(tocXhtml, 'utf-8'))
  } else {
    zip.addFile(tocXhtmlPath, Buffer.from(tocXhtml, 'utf-8'))
  }

  const metadata = opfData?.package?.metadata || {}
  const getText = (val) => {
    if (!val) return ''
    if (typeof val === 'string') return val.trim()
    return (val['#text'] ?? val['_'] ?? '').trim() || ''
  }
  const uid = getText(metadata['dc:identifier']) || getText(metadata['dc\\:identifier']) || 'urn:uuid:unknown'
  const bookTitle = getText(metadata['dc:title']) || getText(metadata['dc\\:title']) || 'Unknown Title'

  const tocNcx = `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head>
\t<meta name="dtb:uid" content="${escapeXml(uid)}"/>
</head>
<docTitle><text>${escapeXml(bookTitle)}</text></docTitle>
<navMap>
${entries.map((e, i) => `\t<navPoint id="navpoint-${i + 1}" playOrder="${i + 1}">
\t\t<navLabel><text>${escapeXml(e.title)}</text></navLabel>
\t\t<content src="${e.href}"/>
\t</navPoint>`).join('\n')}
</navMap>
</ncx>
`

  const tocNcxPath = path.posix.normalize(path.posix.join(opfDir, 'toc.ncx'))
  const existingNcx = zip.getEntry(tocNcxPath)
  if (existingNcx) {
    zip.updateFile(tocNcxPath, Buffer.from(tocNcx, 'utf-8'))
  } else {
    zip.addFile(tocNcxPath, Buffer.from(tocNcx, 'utf-8'))
  }

  const manifestItems = getManifestItems(opfData)

  for (const item of manifestItems) {
    if (item['@_properties'] && item['@_properties'].includes('nav')) {
      item['@_properties'] = item['@_properties'].replace(/\bnav\b/g, '').trim() || undefined
    }
  }

  const existingTocXhtmlItem = manifestItems.find(
    (item) => item['@_href'] && item['@_href'].endsWith('toc.xhtml')
  )
  if (existingTocXhtmlItem) {
    existingTocXhtmlItem['@_id'] = 'toc.xhtml'
    existingTocXhtmlItem['@_href'] = 'toc.xhtml'
    existingTocXhtmlItem['@_media-type'] = 'application/xhtml+xml'
    existingTocXhtmlItem['@_properties'] = 'nav'
  } else {
    manifestItems.push({
      '@_id': 'toc.xhtml',
      '@_href': 'toc.xhtml',
      '@_media-type': 'application/xhtml+xml',
      '@_properties': 'nav',
    })
  }

  let ncxItemId = 'ncx'
  const existingNcxItem = manifestItems.find(
    (item) => item['@_media-type'] === 'application/x-dtbncx+xml'
  )
  if (existingNcxItem) {
    existingNcxItem['@_href'] = 'toc.ncx'
    ncxItemId = existingNcxItem['@_id']
  } else {
    manifestItems.push({
      '@_id': 'ncx',
      '@_href': 'toc.ncx',
      '@_media-type': 'application/x-dtbncx+xml',
    })
  }

  setManifestItems(opfData, manifestItems)

  if (!opfData.package.spine) {
    opfData.package.spine = {}
  }
  opfData.package.spine['@_toc'] = ncxItemId
}
